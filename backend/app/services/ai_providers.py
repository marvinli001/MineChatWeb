import openai
import anthropic
from google import genai
from typing import Dict, List, Any, AsyncGenerator
import asyncio
import logging

logger = logging.getLogger(__name__)

class AIProviderService:
    def __init__(self):
        # 设置超时时间
        self.timeout = 60  # 60秒超时
        
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
        logger.info(f"开始调用 {provider} API, 模型: {model}")
        
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
                raise ValueError(f"不支持的提供商: {provider}")
                
        except asyncio.TimeoutError:
            logger.error(f"{provider} API调用超时")
            raise Exception(f"{provider} API调用超时，请稍后重试")
        except Exception as e:
            logger.error(f"{provider} API调用失败: {str(e)}")
            raise

    def _is_openai_responses_api(self, model: str) -> bool:
        """判断是否为 OpenAI Responses API 模型"""
        responses_api_models = [
            'chatgpt-4o-latest',
            'gpt-4o-realtime-preview',
            'gpt-4o-realtime-preview-2024-10-01'
        ]
        return model in responses_api_models

    def _is_gpt5_model(self, model: str) -> bool:
        """判断是否为 GPT-5 系列模型"""
        return model.startswith('gpt-5') or model.startswith('o3')

    async def _openai_chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """OpenAI Chat Completions API 调用"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.timeout
            )
            
            logger.info(f"调用OpenAI模型: {model}, 消息数量: {len(messages)}")
            
            # o1 系列模型特殊处理
            if thinking_mode and model in ["o1-preview", "o1-mini"]:
                filtered_messages = [msg for msg in messages if msg["role"] != "system"]
                logger.info(f"o1模型过滤后消息数量: {len(filtered_messages)}")
                response = await asyncio.wait_for(
                    client.chat.completions.create(
                        model=model,
                        messages=filtered_messages
                    ),
                    timeout=self.timeout
                )
            else:
                # 根据模型类型选择合适的参数
                completion_params = {
                    "model": model,
                    "messages": messages,
                    "stream": stream
                }
                
                # GPT-5 系列模型不支持自定义 temperature，使用默认值 1
                if not self._is_gpt5_model(model):
                    completion_params["temperature"] = 0.7
                
                # GPT-5 系列模型使用 max_completion_tokens，其他模型使用 max_tokens
                if self._is_gpt5_model(model):
                    completion_params["max_completion_tokens"] = 4000
                else:
                    completion_params["max_tokens"] = 4000
                
                response = await asyncio.wait_for(
                    client.chat.completions.create(**completion_params),
                    timeout=self.timeout
                )
            
            result = response.model_dump()
            logger.info(f"OpenAI API调用成功，返回选择数量: {len(result.get('choices', []))}")
            return result
            
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI认证失败: {str(e)}")
            raise Exception("OpenAI API密钥无效，请检查您的API密钥")
        except openai.RateLimitError as e:
            logger.error(f"OpenAI速率限制: {str(e)}")
            raise Exception("OpenAI API请求频率过高，请稍后重试")
        except openai.InternalServerError as e:
            logger.error(f"OpenAI服务器错误: {str(e)}")
            raise Exception("OpenAI服务器暂时不可用，请稍后重试")
        except Exception as e:
            logger.error(f"OpenAI API调用异常: {str(e)}")
            raise Exception(f"OpenAI API调用失败: {str(e)}")

    async def _openai_responses_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """OpenAI Responses API 调用"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.timeout
            )
            
            logger.info(f"调用OpenAI Responses API模型: {model}")
            
            # 构建 Responses API 请求参数
            responses_params = {
                "model": model,
                "messages": messages,
                # Responses API 特有参数
                "modalities": ["text"]
            }
            
            # GPT-5 系列模型不支持自定义 temperature，使用默认值 1
            if not self._is_gpt5_model(model):
                responses_params["temperature"] = 0.7
            
            response = await asyncio.wait_for(
                client.chat.completions.create(**responses_params),
                timeout=self.timeout
            )
            
            result = response.model_dump()
            logger.info(f"OpenAI Responses API调用成功")
            return result
            
        except Exception as e:
            logger.error(f"OpenAI Responses API调用失败: {str(e)}")
            raise Exception(f"OpenAI Responses API调用失败: {str(e)}")

    async def _anthropic_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """Anthropic Claude API 调用"""
        try:
            client = anthropic.AsyncAnthropic(
                api_key=api_key,
                timeout=self.timeout
            )
            
            logger.info(f"调用Anthropic模型: {model}")
            
            system_message = ""
            user_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    user_messages.append(msg)
            
            kwargs = {
                "model": model,
                "max_tokens": 4000,
                "messages": user_messages,
                "temperature": 0.7
            }
            
            if system_message:
                kwargs["system"] = system_message
            
            response = await asyncio.wait_for(
                client.messages.create(**kwargs),
                timeout=self.timeout
            )
            
            # 转换为OpenAI格式
            result = {
                "id": f"msg_{response.id}",
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": response.content[0].text if response.content else ""
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                }
            }
            
            logger.info(f"Anthropic API调用成功")
            return result
            
        except anthropic.AuthenticationError as e:
            logger.error(f"Anthropic认证失败: {str(e)}")
            raise Exception("Anthropic API密钥无效，请检查您的API密钥")
        except Exception as e:
            logger.error(f"Anthropic API调用失败: {str(e)}")
            raise Exception(f"Anthropic API调用失败: {str(e)}")

    async def _google_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """Google Gemini API 调用"""
        try:
            genai.configure(api_key=api_key)
            
            logger.info(f"调用Google模型: {model}")
            
            # 转换消息格式
            history = []
            for msg in messages[:-1]:  # 除最后一条消息外的历史
                if msg["role"] == "user":
                    history.append({"role": "user", "parts": [msg["content"]]})
                elif msg["role"] == "assistant":
                    history.append({"role": "model", "parts": [msg["content"]]})
            
            model_instance = genai.GenerativeModel(model)
            chat = model_instance.start_chat(history=history)
            
            # 发送最后一条用户消息
            user_message = messages[-1]["content"]
            response = await asyncio.wait_for(
                chat.send_message_async(user_message),
                timeout=self.timeout
            )
            
            # 转换为OpenAI格式
            result = {
                "id": f"gemini_{hash(response.text) % 1000000}",
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": response.text
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 0,  # Google API不提供token计数
                    "completion_tokens": 0,
                    "total_tokens": 0
                }
            }
            
            logger.info(f"Google API调用成功")
            return result
            
        except Exception as e:
            logger.error(f"Google API调用失败: {str(e)}")
            raise Exception(f"Google API调用失败: {str(e)}")

    async def stream_completion(
        self,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式完成（WebSocket使用）"""
        logger.info(f"开始流式调用 {provider} API")
        
        try:
            if provider == "openai":
                async for chunk in self._openai_stream_completion(model, messages, api_key, thinking_mode):
                    yield chunk
            else:
                # 其他提供商暂不支持流式
                response = await self.get_completion(provider, model, messages, api_key, False, thinking_mode)
                yield response
                
        except Exception as e:
            logger.error(f"流式调用失败: {str(e)}")
            yield {"error": str(e)}

    async def _openai_stream_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """OpenAI流式完成"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.timeout
            )
            
            # 根据模型类型选择合适的参数
            stream_params = {
                "model": model,
                "messages": messages,
                "stream": True
            }
            
            # GPT-5 系列模型不支持自定义 temperature，使用默认值 1
            if not self._is_gpt5_model(model):
                stream_params["temperature"] = 0.7
            
            # GPT-5 系列模型使用 max_completion_tokens，其他模型使用 max_tokens
            if self._is_gpt5_model(model):
                stream_params["max_completion_tokens"] = 4000
            else:
                stream_params["max_tokens"] = 4000
            
            stream = await client.chat.completions.create(**stream_params)
            
            async for chunk in stream:
                yield chunk.model_dump()
                
        except Exception as e:
            logger.error(f"OpenAI流式调用失败: {str(e)}")
            yield {"error": str(e)}