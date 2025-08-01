import openai
import anthropic
import google.generativeai as genai
from typing import List, Dict, Any, AsyncGenerator
import httpx
import json

class AIProviderService:
    def __init__(self):
        self.providers = {
            "openai": self._openai_completion,
            "anthropic": self._anthropic_completion,
            "google": self._google_completion
        }

    async def get_completion(
        self,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """
        统一的AI完成接口
        """
        if provider not in self.providers:
            raise ValueError(f"Unsupported provider: {provider}")
        
        return await self.providers[provider](
            model=model,
            messages=messages,
            api_key=api_key,
            stream=stream,
            thinking_mode=thinking_mode
        )

    async def stream_completion(
        self,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式响应生成器
        """
        if provider == "openai":
            async for chunk in self._openai_stream(model, messages, api_key, thinking_mode):
                yield chunk
        elif provider == "anthropic":
            async for chunk in self._anthropic_stream(model, messages, api_key, thinking_mode):
                yield chunk
        elif provider == "google":
            async for chunk in self._google_stream(model, messages, api_key, thinking_mode):
                yield chunk

    async def _openai_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """
        OpenAI API调用
        """
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # 处理thinking模型
        if thinking_mode and model in ["o1-preview", "o1-mini"]:
            # o1模型不支持system消息和某些参数
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
        
        return response.model_dump()

    async def _openai_stream(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        OpenAI流式响应
        """
        client = openai.AsyncOpenAI(api_key=api_key)
        
        if thinking_mode and model in ["o1-preview", "o1-mini"]:
            filtered_messages = [msg for msg in messages if msg["role"] != "system"]
            stream = await client.chat.completions.create(
                model=model,
                messages=filtered_messages,
                stream=True
            )
        else:
            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=4000
            )
        
        async for chunk in stream:
            yield chunk.model_dump()

    async def _anthropic_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """
        Anthropic API调用
        """
        client = anthropic.AsyncAnthropic(api_key=api_key)
        
        # 转换消息格式
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
        
        return {
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

    async def _anthropic_stream(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Anthropic流式响应
        """
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
            async for event in stream:
                yield {
                    "type": event.type,
                    "data": event.data if hasattr(event, 'data') else None
                }

    async def _google_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """
        Google Gemini API调用
        """
        genai.configure(api_key=api_key)
        model_obj = genai.GenerativeModel(model)
        
        # 转换消息格式
        chat_history = []
        for msg in messages[:-1]:
            if msg["role"] == "user":
                chat_history.append({"role": "user", "parts": [msg["content"]]})
            elif msg["role"] == "assistant":
                chat_history.append({"role": "model", "parts": [msg["content"]]})
        
        chat = model_obj.start_chat(history=chat_history)
        
        prompt = messages[-1]["content"]
        if thinking_mode:
            prompt = f"Please think through this step by step before providing your final answer.\n\n{prompt}"
        
        response = await chat.send_message_async(prompt)
        
        return {
            "id": f"gemini_{hash(response.text)}",
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": response.text
                }
            }],
            "usage": {
                "prompt_tokens": 0,  # Gemini doesn't provide token counts
                "completion_tokens": 0,
                "total_tokens": 0
            }
        }

    async def _google_stream(
        self,
        model: str,
        messages: List[Dict[str, str]],
        api_key: str,
        thinking_mode: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Google Gemini流式响应
        """
        genai.configure(api_key=api_key)
        model_obj = genai.GenerativeModel(model)
        
        chat_history = []
        for msg in messages[:-1]:
            if msg["role"] == "user":
                chat_history.append({"role": "user", "parts": [msg["content"]]})
            elif msg["role"] == "assistant":
                chat_history.append({"role": "model", "parts": [msg["content"]]})
        
        chat = model_obj.start_chat(history=chat_history)
        
        prompt = messages[-1]["content"]
        if thinking_mode:
            prompt = f"Please think through this step by step before providing your final answer.\n\n{prompt}"
        
        response = await chat.send_message_async(prompt, stream=True)
        
        async for chunk in response:
            yield {
                "choices": [{
                    "delta": {
                        "content": chunk.text
                    }
                }]
            }

    def get_available_models(self, provider: str) -> List[str]:
        """
        获取指定提供商的可用模型
        """
        models_map = {
            "openai": [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-3.5-turbo",
                "o1-preview",
                "o1-mini"
            ],
            "anthropic": [
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
                "claude-3-opus-20240229"
            ],
            "google": [
                "gemini-2.0-flash-exp",
                "gemini-1.5-pro",
                "gemini-1.5-flash"
            ]
        }
        return models_map.get(provider, [])