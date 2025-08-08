import openai
import anthropic
from google import genai
from typing import Dict, List, Any, AsyncGenerator
import logging

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIProviderService:
    def __init__(self):
        pass

    async def get_completion(
        self,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """获取AI完成响应"""
        logger.info(f"开始处理请求: provider={provider}, model={model}")
        
        try:
            if provider == "openai":
                # 判断是否使用 Responses API
                if self._is_openai_responses_api(model):
                    return await self._openai_responses_completion(model, messages, api_key, thinking_mode)
                else:
                    return await self._openai_chat_completion(model, messages, api_key, stream, thinking_mode)
            elif provider == "anthropic":
                return await self._anthropic_completion(model, messages, api_key, thinking_mode)
            elif provider == "google":
                return await self._google_completion(model, messages, api_key, thinking_mode)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
        except Exception as e:
            logger.error(f"AI服务调用失败: {str(e)}")
            raise

    def _is_openai_responses_api(self, model: str) -> bool:
        """判断是否为 OpenAI Responses API 模型"""
        responses_api_models = [
            'chatgpt-4o-latest',
            'gpt-4o-realtime-preview',
            'gpt-4o-realtime-preview-2024-10-01'
        ]
        return model in responses_api_models

    async def _openai_chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """OpenAI Chat Completions API 调用"""
        logger.info(f"调用OpenAI API: model={model}")
        
        try:
            client = openai.AsyncOpenAI(api_key=api_key)
            
            # o1 系列模型特殊处理
            if thinking_mode and model in ["o1-preview", "o1-mini"]:
                filtered_messages = [msg for msg in messages if msg["role"] != "system"]
                response = await client.chat.completions.create(
                    model=model,
                    messages=filtered_messages
                )
            else:
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    stream=stream,
                    temperature=0.7,
                    max_tokens=4000
                )
            
            result = response.model_dump()
            logger.info("OpenAI API调用成功")
            return result
        except Exception as e:
            logger.error(f"OpenAI API调用失败: {str(e)}")
            raise

    async def _openai_responses_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """OpenAI Responses API 调用"""
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # 构建 Responses API 请求
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            # Responses API 特有参数
            modalities=["text"],
            temperature=0.7
        )
        
        return response.model_dump()

    async def _anthropic_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """Anthropic Claude API 调用"""
        logger.info(f"调用Anthropic API: model={model}")
        
        try:
            client = anthropic.AsyncAnthropic(api_key=api_key)
            
            system_message = ""
            anthropic_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    anthropic_messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
            
            if thinking_mode:
                system_message += "\n\nPlease think through this step by step before providing your final answer."
            
            response = await client.messages.create(
                model=model,
                max_tokens=4000,
                system=system_message,
                messages=anthropic_messages
            )
            
            result = {
                "id": response.id,
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": response.content[0].text
                    }
                }],
                "usage": {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                }
            }
            logger.info("Anthropic API调用成功")
            return result
        except Exception as e:
            logger.error(f"Anthropic API调用失败: {str(e)}")
            raise

    async def _google_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """Google Gemini API 调用"""
        logger.info(f"调用Google API: model={model}")
        
        try:
            genai.configure(api_key=api_key)
            model_instance = genai.GenerativeModel(model)
            
            # 转换消息格式
            chat_history = []
            for msg in messages[:-1]:  # 除了最后一条消息
                if msg["role"] == "user":
                    chat_history.append({"role": "user", "parts": [msg["content"]]})
                elif msg["role"] == "assistant":
                    chat_history.append({"role": "model", "parts": [msg["content"]]})
            
            # 最后一条用户消息
            user_message = messages[-1]["content"]
            if thinking_mode:
                user_message = f"Please think through this step by step before providing your final answer.\n\n{user_message}"
            
            chat = model_instance.start_chat(history=chat_history)
            response = await chat.send_message_async(user_message)
            
            result = {
                "id": f"gemini_{hash(response.text)}",
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": response.text
                    }
                }],
                "usage": {
                    "prompt_tokens": 0,  # Gemini API 不提供具体 token 计数
                    "completion_tokens": 0,
                    "total_tokens": 0
                }
            }
            logger.info("Google API调用成功")
            return result
        except Exception as e:
            logger.error(f"Google API调用失败: {str(e)}")
            raise

    async def stream_completion(
        self,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式完成 - 为WebSocket提供支持"""
        logger.info(f"开始流式处理: provider={provider}, model={model}")
        
        try:
            if provider == "openai":
                async for chunk in self._openai_stream_completion(model, messages, api_key, thinking_mode):
                    yield chunk
            elif provider == "anthropic":
                async for chunk in self._anthropic_stream_completion(model, messages, api_key, thinking_mode):
                    yield chunk
            else:
                # 对于不支持流式的提供商，模拟流式响应
                response = await self.get_completion(provider, model, messages, api_key, False, thinking_mode)
                content = response["choices"][0]["message"]["content"]
                
                # 分块发送
                words = content.split()
                for i, word in enumerate(words):
                    yield {
                        "choices": [{
                            "delta": {
                                "content": word + " " if i < len(words) - 1 else word
                            }
                        }]
                    }
        except Exception as e:
            logger.error(f"流式处理失败: {str(e)}")
            yield {"error": str(e)}

    async def _openai_stream_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """OpenAI 流式完成"""
        client = openai.AsyncOpenAI(api_key=api_key)
        
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=4000
        )
        
        async for chunk in stream:
            yield chunk.model_dump()

    async def _anthropic_stream_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Anthropic 流式完成"""
        client = anthropic.AsyncAnthropic(api_key=api_key)
        
        system_message = ""
        anthropic_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        if thinking_mode:
            system_message += "\n\nPlease think through this step by step before providing your final answer."
        
        async with client.messages.stream(
            model=model,
            max_tokens=4000,
            system=system_message,
            messages=anthropic_messages
        ) as stream:
            async for chunk in stream:
                if chunk.type == "content_block_delta":
                    yield {
                        "choices": [{
                            "delta": {
                                "content": chunk.delta.text
                            }
                        }]
                    }