import openai
import anthropic
from google import genai
from typing import Dict, List, Any, AsyncGenerator, Union
import asyncio
import logging
import json
import os

logger = logging.getLogger(__name__)

class AIProviderService:
    def __init__(self):
        # 设置超时时间
        self.timeout = 60  # 60秒超时
        self._models_config = None
        
    def _get_message_attr(self, msg: Union[Dict[str, Any], Any], attr: str) -> str:
        """安全地获取消息属性，支持字典和Pydantic对象"""
        if isinstance(msg, dict):
            return msg.get(attr, "")
        else:
            # Pydantic对象，使用属性访问
            return getattr(msg, attr, "")
        
    def _load_models_config(self) -> Dict[str, Any]:
        """加载模型配置"""
        if self._models_config is None:
            config_path = os.path.join(os.path.dirname(__file__), "../../../models-config.json")
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    self._models_config = json.load(f)
            except Exception as e:
                logger.warning(f"无法加载模型配置: {e}")
                self._models_config = {}
        return self._models_config
        
    async def get_completion(
        self,
        provider: str,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto"
    ) -> Dict[str, Any]:
        """获取AI完成响应"""
        logger.info(f"开始调用 {provider} API, 模型: {model}, 思考模式: {thinking_mode}")
        
        try:
            if provider == "openai":
                # 对于 GPT-5 系列模型，根据 thinking_mode 选择 API
                if self._is_gpt5_model(model) and thinking_mode:
                    return await self._openai_responses_completion(model, messages, api_key, thinking_mode, reasoning_summaries)
                # 判断是否使用 Responses API (对于其他模型)
                elif self._is_openai_responses_api(model):
                    return await self._openai_responses_completion(model, messages, api_key, thinking_mode, reasoning_summaries)
                else:
                    return await self._openai_chat_completion(model, messages, api_key, stream, thinking_mode, reasoning_summaries)
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

    def _is_thinking_model(self, model: str) -> bool:
        """判断是否为思考模型"""
        thinking_models = [
            'o1', 'o1-preview', 'o1-mini', 'o1-pro',
            'o3', 'o3-mini', 'o3-pro',
            'o4-mini', 'o4-mini-high'
        ]
        return model in thinking_models

    def _is_openai_responses_api(self, model: str) -> bool:
        """判断是否为 OpenAI Responses API 模型"""
        try:
            config = self._load_models_config()
            openai_models = config.get('providers', {}).get('openai', {}).get('models', {})
            model_config = openai_models.get(model, {})
            return model_config.get('api_type') == 'responses'
        except Exception as e:
            logger.warning(f"无法检查模型API类型: {e}")
            # 回退到硬编码列表
            fallback_models = [
                'chatgpt-4o-latest',
                'gpt-4o-realtime-preview',
                'gpt-4o-realtime-preview-2024-10-01',
                'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest',
                'gpt-4o', 'gpt-4o-mini',
                'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
                'o1', 'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini'
            ]
            return model in fallback_models

    def _supports_streaming(self, provider: str, model: str) -> bool:
        """检查模型是否支持流式输出"""
        try:
            config = self._load_models_config()
            provider_models = config.get('providers', {}).get(provider, {}).get('models', {})
            model_config = provider_models.get(model, {})
            return model_config.get('supports_streaming', False)
        except Exception as e:
            logger.warning(f"无法检查模型流式支持: {e}")
            # 对于OpenAI，除了thinking模型外，默认支持流式
            if provider == 'openai':
                thinking_models = ['o1', 'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini']
                return model not in thinking_models
            return False

    def _is_gpt5_model(self, model: str) -> bool:
        """判断是否为 GPT-5 系列模型"""
        gpt5_models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest']
        return model in gpt5_models

    def _supports_thinking_mode(self, model: str) -> bool:
        """判断模型是否支持 thinking mode (通过 reasoning_effort 参数)"""
        return self._is_gpt5_model(model)

    async def _openai_chat_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto"
    ) -> Dict[str, Any]:
        """OpenAI Chat Completions API 调用"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.timeout
            )
            
            logger.info(f"调用OpenAI模型: {model}, 消息数量: {len(messages)}")
            
            # 思考模型特殊处理
            if self._is_thinking_model(model):
                # 对于思考模型，过滤掉system消息并添加reasoning_summaries参数
                filtered_messages = [msg for msg in messages if self._get_message_attr(msg, "role") != "system"]
                logger.info(f"思考模型 {model} 过滤后消息数量: {len(filtered_messages)}")
                
                completion_params = {
                    "model": model,
                    "messages": filtered_messages
                }
                
                # 注意：reasoning_summaries 参数在当前 OpenAI API 版本中可能不被支持
                # 如果需要支持该参数，请检查 OpenAI API 文档和库版本
                # if reasoning_summaries and reasoning_summaries != "hide":
                #     completion_params["reasoning_summaries"] = reasoning_summaries
                
                response = await asyncio.wait_for(
                    client.chat.completions.create(**completion_params),
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
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto"
    ) -> Dict[str, Any]:
        """OpenAI Responses API 调用"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.timeout
            )
            
            logger.info(f"调用OpenAI Responses API模型: {model}, 思考模式: {thinking_mode}")
            
            # 对于 GPT-5 系列模型，使用 Responses API 支持 thinking mode
            if self._is_gpt5_model(model) and thinking_mode:
                # 使用 Responses API 和 reasoning_effort 参数
                completion_params = {
                    "model": model,
                    "messages": messages,
                    "reasoning_effort": "medium",
                    "reasoning": {"summary": reasoning_summaries}
                }
                
                # GPT-5 系列模型使用 max_completion_tokens
                completion_params["max_completion_tokens"] = 4000
                
                logger.info(f"使用 Responses API 和 reasoning_effort=medium")
                
                # 注意：这里假设 OpenAI 库支持 responses.create() 方法
                # 如果不支持，可能需要使用 chat.completions.create() 作为 fallback
                try:
                    response = await asyncio.wait_for(
                        client.responses.create(**completion_params),
                        timeout=self.timeout
                    )
                except AttributeError:
                    # Fallback to chat completions if responses API not available
                    logger.warning("Responses API 不可用，回退到 Chat Completions API")
                    response = await asyncio.wait_for(
                        client.chat.completions.create(**completion_params),
                        timeout=self.timeout
                    )
            else:
                # 标准的 Responses API 调用（对于其他标记为 responses 的模型）
                completion_params = {
                    "model": model,
                    "messages": messages
                }
                
                # 思考模型处理
                if self._is_thinking_model(model):
                    # 过滤system消息
                    filtered_messages = [msg for msg in messages if self._get_message_attr(msg, "role") != "system"]
                    completion_params["messages"] = filtered_messages
                
                # GPT-5 系列模型不支持自定义 temperature，使用默认值 1
                if not self._is_gpt5_model(model):
                    completion_params["temperature"] = 0.7
                
                # GPT-5 系列模型使用 max_completion_tokens，其他模型使用 max_tokens
                if self._is_gpt5_model(model):
                    completion_params["max_completion_tokens"] = 4000
                else:
                    completion_params["max_tokens"] = 4000
                
                # 使用 Chat Completions API
                response = await asyncio.wait_for(
                    client.chat.completions.create(**completion_params),
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
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
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
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")
                
                if role == "system":
                    system_message = content
                else:
                    # 为了确保向后兼容，如果是Pydantic对象，转换为字典
                    if isinstance(msg, dict):
                        user_messages.append(msg)
                    else:
                        user_messages.append({"role": role, "content": content})
            
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
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
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
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")
                
                if role == "user":
                    history.append({"role": "user", "parts": [content]})
                elif role == "assistant":
                    history.append({"role": "model", "parts": [content]})
            
            model_instance = genai.GenerativeModel(model)
            chat = model_instance.start_chat(history=history)
            
            # 发送最后一条用户消息
            user_message = self._get_message_attr(messages[-1], "content")
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
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式完成（WebSocket使用）"""
        logger.info(f"开始流式调用 {provider} API")
        
        try:
            if provider == "openai":
                # 检查模型是否支持流式输出
                if self._supports_streaming(provider, model):
                    async for chunk in self._openai_stream_completion(model, messages, api_key, thinking_mode, reasoning_summaries):
                        yield chunk
                else:
                    # 不支持流式的模型，直接返回完整响应
                    logger.info(f"模型 {model} 不支持流式输出，使用普通请求")
                    response = await self.get_completion(provider, model, messages, api_key, False, thinking_mode, reasoning_summaries)
                    yield response
            else:
                # 其他提供商暂不支持流式
                response = await self.get_completion(provider, model, messages, api_key, False, thinking_mode, reasoning_summaries)
                yield response
                
        except Exception as e:
            logger.error(f"流式调用失败: {str(e)}")
            yield {"error": str(e)}

    async def _openai_stream_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto"
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