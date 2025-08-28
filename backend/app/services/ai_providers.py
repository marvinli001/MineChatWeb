import openai
import anthropic
from google import genai
from typing import Dict, List, Any, AsyncGenerator, Union
import asyncio
import logging
import json
import os
import httpx
from .web_search_service import WebSearchService

logger = logging.getLogger(__name__)

class AIProviderService:
    def __init__(self):
        # 设置不同操作的超时时间
        self.default_timeout = 60  # 默认60秒超时
        self.responses_api_timeout = 180  # Responses API 使用更长的超时时间
        self.config_timeout = 30  # 配置加载超时
        self.max_retries = 2  # 最大重试次数
        self._models_config = None
        self.web_search_service = WebSearchService()  # 初始化搜索服务
        
    def _get_message_attr(self, msg: Union[Dict[str, Any], Any], attr: str) -> str:
        """安全地获取消息属性，支持字典和Pydantic对象"""
        if isinstance(msg, dict):
            return msg.get(attr, "")
        else:
            # Pydantic对象，使用属性访问
            return getattr(msg, attr, "")
    
    def _convert_message_to_openai_format(self, msg: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """将消息转换为OpenAI API格式，支持图片和文件附件"""
        role = self._get_message_attr(msg, "role")
        content = self._get_message_attr(msg, "content")
        
        # 获取图片数据
        images = None
        if isinstance(msg, dict):
            images = msg.get("images")
        else:
            images = getattr(msg, "images", None)
        
        # 获取文件数据
        files = None
        if isinstance(msg, dict):
            files = msg.get("files")
        else:
            files = getattr(msg, "files", None)
        
        # 检查是否有多媒体内容
        has_multimedia = (images and len(images) > 0) or (files and len(files) > 0)
        
        # 如果没有多媒体内容，使用传统格式
        if not has_multimedia:
            return {"role": role, "content": content}
        
        # 构造支持多媒体的消息格式
        content_parts = []
        
        # 添加文本内容（如果有）
        if content and content.strip():
            content_parts.append({"type": "text", "text": content})
        
        # 添加图片内容
        if images:
            for image in images:
                if isinstance(image, dict):
                    image_data = image.get("data")
                    mime_type = image.get("mime_type", "image/jpeg")
                else:
                    image_data = getattr(image, "data", "")
                    mime_type = getattr(image, "mime_type", "image/jpeg")
                
                if image_data:
                    content_parts.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}"
                        }
                    })
        
        # 添加文件内容 (使用input_file格式)
        if files:
            for file in files:
                if isinstance(file, dict):
                    file_id = file.get("openai_file_id")
                    filename = file.get("filename")
                    process_mode = file.get("process_mode", "direct")
                else:
                    file_id = getattr(file, "openai_file_id", "")
                    filename = getattr(file, "filename", "")
                    process_mode = getattr(file, "process_mode", "direct")
                
                if file_id:
                    # 根据处理模式决定如何处理文件
                    if process_mode == "direct":
                        # 直读模式：使用 input_file
                        content_parts.append({
                            "type": "input_file",
                            "file_id": file_id
                        })
                    # Code Interpreter 和 File Search 模式的文件会在工具配置中处理
        
        return {
            "role": role,
            "content": content_parts
        }
    
    def _prepare_tools_config(self, messages: List[Union[Dict[str, Any], Any]], tools: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """准备工具配置，基于消息中的文件类型"""
        tools_config = {"tools": []}
        
        # 收集所有需要的工具
        need_code_interpreter = False
        need_file_search = False
        vector_stores = set()
        
        for msg in messages:
            # 获取文件数据
            files = None
            if isinstance(msg, dict):
                files = msg.get("files")
            else:
                files = getattr(msg, "files", None)
            
            if files:
                for file in files:
                    if isinstance(file, dict):
                        process_mode = file.get("process_mode", "direct")
                        vector_store_id = file.get("vector_store_id")
                    else:
                        process_mode = getattr(file, "process_mode", "direct")
                        vector_store_id = getattr(file, "vector_store_id", None)
                    
                    if process_mode == "code_interpreter":
                        need_code_interpreter = True
                    elif process_mode == "file_search" and vector_store_id:
                        need_file_search = True
                        vector_stores.add(vector_store_id)
        
        # 添加需要的工具
        if need_code_interpreter:
            tools_config["tools"].append({
                "type": "code_interpreter",
                "container": {"type": "auto"}
            })
        
        if need_file_search and vector_stores:
            tools_config["tools"].append({
                "type": "file_search",
                "vector_store_ids": list(vector_stores)
            })
        
        # 添加前端传来的工具配置（包括 Web Search）
        if tools:
            for tool_config in tools:
                if tool_config.get("type") in ["web_search", "web_search_preview"]:
                    # 构建 web search 工具配置
                    web_search_tool = self.web_search_service.build_web_search_tool_config(tool_config)
                    tools_config["tools"].append(web_search_tool)
        
        return tools_config
    
    async def _handle_web_search_fallback(
        self, 
        completion_params: Dict[str, Any], 
        tools: List[Dict[str, Any]], 
        messages: List[Union[Dict[str, str], Any]]
    ) -> Dict[str, Any]:
        """
        处理Web Search的旧版回退逻辑
        使用旧版 web_search_preview 参数格式
        """
        # 查找搜索工具配置
        search_tool = None
        for tool in tools:
            if tool.get("type") in ["web_search", "web_search_preview"]:
                search_tool = tool
                break
        
        if search_tool:
            # 旧版实现：添加 web_search_preview 参数
            completion_params["web_search_preview"] = True
            
            # 添加用户位置信息（如果提供）
            if search_tool.get("user_location"):
                completion_params["user_location"] = search_tool["user_location"]
        
        return completion_params
        
    async def _load_models_config(self) -> Dict[str, Any]:
        """加载模型配置"""
        if self._models_config is None:
            config_url = "https://raw.githubusercontent.com/marvinli001/MineChatWeb/main/models-config.json"
            async with httpx.AsyncClient(timeout=self.config_timeout) as client:
                response = await client.get(config_url)
                response.raise_for_status()
                self._models_config = response.json()
                logger.info("成功从远程加载模型配置")
        return self._models_config
        
    async def get_completion(
        self,
        provider: str,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto",
        reasoning: str = "medium",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> Dict[str, Any]:
        """获取AI完成响应"""
        logger.info(f"开始调用 {provider} API, 模型: {model}, 思考模式: {thinking_mode}")
        
        # 使用重试机制
        last_exception = None
        for attempt in range(self.max_retries + 1):
            try:
                if provider == "openai":
                    # 对于 GPT-5 系列模型，根据 thinking_mode 选择 API
                    if self._is_gpt5_model(model) and thinking_mode:
                        return await self._openai_responses_completion(model, messages, api_key, thinking_mode, reasoning_summaries, reasoning, tools, use_native_search)
                    # 判断是否使用 Responses API (对于其他模型)
                    elif await self._is_openai_responses_api(model):
                        return await self._openai_responses_completion(model, messages, api_key, thinking_mode, reasoning_summaries, reasoning, tools, use_native_search)
                    else:
                        return await self._openai_chat_completion(model, messages, api_key, stream, thinking_mode, reasoning_summaries, tools, use_native_search)
                elif provider == "anthropic":
                    return await self._anthropic_completion(model, messages, api_key, thinking_mode)
                elif provider == "google":
                    return await self._google_completion(model, messages, api_key, thinking_mode)
                else:
                    raise ValueError(f"不支持的提供商: {provider}")
                    
            except asyncio.TimeoutError as e:
                last_exception = e
                logger.warning(f"{provider} API调用超时 (尝试 {attempt + 1}/{self.max_retries + 1})")
                if attempt < self.max_retries:
                    await asyncio.sleep(2 ** attempt)  # 指数退避
                    continue
                else:
                    logger.error(f"{provider} API调用在 {self.max_retries + 1} 次尝试后仍然超时")
                    raise Exception(f"{provider} API调用超时，已重试{self.max_retries}次，请稍后重试")
            except Exception as e:
                last_exception = e
                # 对于某些错误类型，不进行重试
                if any(keyword in str(e).lower() for keyword in ['authentication', 'authorization', 'api key', 'invalid']):
                    logger.error(f"{provider} API调用失败 (认证错误): {str(e)}")
                    raise
                elif attempt < self.max_retries:
                    logger.warning(f"{provider} API调用失败 (尝试 {attempt + 1}/{self.max_retries + 1}): {str(e)}")
                    await asyncio.sleep(2 ** attempt)  # 指数退避
                    continue
                else:
                    logger.error(f"{provider} API调用在 {self.max_retries + 1} 次尝试后仍然失败: {str(e)}")
                    raise
        
        # 这行不应该到达，但为了类型安全
        if last_exception:
            raise last_exception

    def _is_thinking_model(self, model: str) -> bool:
        """判断是否为思考模型"""
        thinking_models = [
            'o1', 'o1-preview', 'o1-mini', 'o1-pro',
            'o3', 'o3-mini', 'o3-pro',
            'o4-mini', 'o4-mini-high'
        ]
        return model in thinking_models

    async def _is_openai_responses_api(self, model: str) -> bool:
        """判断是否为 OpenAI Responses API 模型"""
        try:
            config = await self._load_models_config()  # 添加 await
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

    async def _supports_streaming(self, provider: str, model: str) -> bool:
        """检查模型是否支持流式输出"""
        try:
            config = await self._load_models_config()  # 添加 await
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

    def _convert_responses_to_chat_format(self, responses_result: Dict[str, Any]) -> Dict[str, Any]:
        """将 Responses API 格式转换为标准 Chat Completions 格式"""
        if "choices" in responses_result:
            # 已经是标准格式，直接返回
            return responses_result
        
        if "output" not in responses_result:
            # 不是 Responses API 格式，直接返回
            return responses_result
        
        # 转换 Responses API 格式
        output = responses_result.get("output", [])
        choices = []
        reasoning_content = ""
        
        for item in output:
            # 提取推理内容
            if item.get("type") == "reasoning":
                summary_items = item.get("summary", [])
                for summary_item in summary_items:
                    if summary_item.get("type") == "summary_text":
                        reasoning_content = summary_item.get("text", "")
                        break
            
            # 提取助手消息内容
            elif item.get("type") == "message" and item.get("role") == "assistant":
                content = ""
                message_content = item.get("content", [])
                
                # 提取文本内容
                for content_item in message_content:
                    if content_item.get("type") == "output_text":
                        content = content_item.get("text", "")
                        break
                
                # 构造选择对象
                choice = {
                    "message": {
                        "role": "assistant",
                        "content": content
                    },
                    "finish_reason": "stop",
                    "index": 0
                }
                
                # 如果有推理内容，添加到消息中
                if reasoning_content:
                    choice["message"]["reasoning"] = reasoning_content
                
                choices.append(choice)
        
        # 构造标准格式响应
        converted_result = {
            "id": responses_result.get("id", f"resp_{hash(str(output)) % 1000000}"),
            "choices": choices,
            "usage": responses_result.get("usage", {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            })
        }
        
        return converted_result

    async def _openai_chat_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> Dict[str, Any]:
        """OpenAI Chat Completions API 调用"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.default_timeout
            )
            
            logger.info(f"调用OpenAI模型: {model}, 消息数量: {len(messages)}")
            
            # 转换消息格式以支持图片和文件
            converted_messages = [self._convert_message_to_openai_format(msg) for msg in messages]
            
            # 准备工具配置
            tools_config = self._prepare_tools_config(messages, tools)
            
            # 思考模型特殊处理
            if self._is_thinking_model(model):
                # 对于思考模型，过滤掉system消息并添加reasoning_summaries参数
                filtered_messages = [msg for msg in converted_messages if msg.get("role") != "system"]
                logger.info(f"思考模型 {model} 过滤后消息数量: {len(filtered_messages)}")
                
                completion_params = {
                    "model": model,
                    "messages": filtered_messages
                }
                
                # 添加工具配置
                if tools_config["tools"]:
                    completion_params.update(tools_config)
                
                # 注意：reasoning_summaries 参数在当前 OpenAI API 版本中可能不被支持
                # 如果需要支持该参数，请检查 OpenAI API 文档和库版本
                # if reasoning_summaries and reasoning_summaries != "hide":
                #     completion_params["reasoning_summaries"] = reasoning_summaries
                
                response = await asyncio.wait_for(
                    client.chat.completions.create(**completion_params),
                    timeout=self.default_timeout
                )
            else:
                # 根据模型类型选择合适的参数
                completion_params = {
                    "model": model,
                    "messages": converted_messages,
                    "stream": stream
                }
                
                # 处理Web Search工具的回退逻辑
                if tools and use_native_search is False:
                    # 对于不支持新版web_search的模型，使用旧版回退
                    completion_params = await self._handle_web_search_fallback(
                        completion_params, tools, messages
                    )
                elif tools_config["tools"]:
                    completion_params.update(tools_config)
                
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
                    timeout=self.default_timeout
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
        reasoning_summaries: str = "auto",
        reasoning: str = "medium",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> Dict[str, Any]:
        """OpenAI Responses API 调用"""
        try:
            # 使用更长的超时时间，因为 Responses API 通常需要更多时间
            timeout = self.responses_api_timeout if self._is_gpt5_model(model) or thinking_mode else self.default_timeout
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=timeout
            )
            
            logger.info(f"调用OpenAI Responses API模型: {model}, 思考模式: {thinking_mode}")
            
            # 对于 GPT-5 系列模型，使用 Responses API 支持 thinking mode
            if self._is_gpt5_model(model) and thinking_mode:
                # 检查是否有图片消息
                has_images = any(
                    (isinstance(msg, dict) and msg.get("images")) or
                    (hasattr(msg, "images") and getattr(msg, "images", None))
                    for msg in messages
                )
                
                if has_images:
                    # Responses API 支持图片，需要使用新的格式
                    logger.info(f"检测到图片消息，使用Responses API的多模态输入格式")
                    
                    # 转换消息为 Responses API 格式
                    input_messages = []
                    instructions_text = ""
                    
                    for msg in messages:
                        role = self._get_message_attr(msg, "role")
                        content = self._get_message_attr(msg, "content")
                        
                        if role == "system":
                            instructions_text = content
                        else:
                            # 获取图片和文件数据
                            images = None
                            files = None
                            if isinstance(msg, dict):
                                images = msg.get("images")
                                files = msg.get("files")
                            else:
                                images = getattr(msg, "images", None)
                                files = getattr(msg, "files", None)
                            
                            # 构造内容部分数组
                            content_parts = []
                            
                            # 添加文本内容
                            if content and content.strip():
                                content_parts.append({"type": "input_text", "text": content})
                            
                            # 添加图片内容
                            if images and len(images) > 0:
                                for image in images:
                                    if isinstance(image, dict):
                                        image_data = image.get("data")
                                        mime_type = image.get("mime_type", "image/jpeg")
                                    else:
                                        image_data = getattr(image, "data", "")
                                        mime_type = getattr(image, "mime_type", "image/jpeg")
                                    
                                    if image_data:
                                        content_parts.append({
                                            "type": "input_image",
                                            "image_url": f"data:{mime_type};base64,{image_data}"
                                        })
                            
                            # 添加文件内容（仅支持 direct 模式的 PDF 文件）
                            if files and len(files) > 0:
                                for file in files:
                                    if isinstance(file, dict):
                                        openai_file_id = file.get("openai_file_id")
                                        process_mode = file.get("process_mode", "direct")
                                    else:
                                        openai_file_id = getattr(file, "openai_file_id", None)
                                        process_mode = getattr(file, "process_mode", "direct")
                                    
                                    # 只有 direct 模式的文件才添加到 input_file（仅支持 PDF）
                                    if openai_file_id and process_mode == "direct":
                                        content_parts.append({
                                            "type": "input_file",
                                            "file_id": openai_file_id
                                        })
                            
                            # 如果没有内容部分，添加空文本
                            if not content_parts:
                                content_parts.append({"type": "input_text", "text": ""})
                            
                            input_messages.append({
                                "role": role,
                                "content": content_parts
                            })
                    
                    # 准备工具配置
                    tools_config = self._prepare_tools_config(messages)
                    
                    # 使用 Responses API 的多模态参数结构
                    completion_params = {
                        "model": model,
                        "input": input_messages,
                        "reasoning": {
                            "effort": reasoning,
                            "summary": reasoning_summaries if reasoning_summaries != "auto" else "auto"
                        }
                    }
                    
                    # 添加工具配置
                    if tools_config["tools"]:
                        completion_params.update(tools_config)
                        # 如果有工具且是必需的，设置 tool_choice
                        need_code_interpreter = any(tool.get("type") == "code_interpreter" for tool in tools_config["tools"])
                        if need_code_interpreter:
                            completion_params["tool_choice"] = "required"
                    
                    # 添加 instructions 如果有 system 消息
                    if instructions_text:
                        completion_params["instructions"] = instructions_text
                    
                    # GPT-5 系列模型使用 max_output_tokens
                    completion_params["max_output_tokens"] = 4000
                    
                    # 打印实际发送的 JSON
                    logger.info(f"📤 发送给 OpenAI Responses API 的完整请求: {json.dumps(completion_params, ensure_ascii=False, indent=2)}")
                    
                    response = await asyncio.wait_for(
                        client.responses.create(**completion_params),
                        timeout=timeout
                    )
                    
                    result = response.model_dump()
                    logger.info(f"OpenAI Responses API调用成功（多模态支持）")
                    return self._convert_responses_to_chat_format(result)
                
                # 转换消息格式为 Responses API 所需的 input 格式
                # 检查是否有文件，如果有则使用结构化输入格式
                has_files = any(
                    (isinstance(msg, dict) and msg.get("files")) or
                    (hasattr(msg, "files") and getattr(msg, "files", None))
                    for msg in messages
                )
                
                instructions_text = ""
                
                if has_files:
                    # 使用结构化输入格式支持文件
                    input_messages = []
                    
                    for msg in messages:
                        role = self._get_message_attr(msg, "role")
                        content = self._get_message_attr(msg, "content")
                        
                        if role == "system":
                            instructions_text = content
                        else:
                            # 获取文件数据
                            files = None
                            if isinstance(msg, dict):
                                files = msg.get("files")
                            else:
                                files = getattr(msg, "files", None)
                            
                            # 构造内容部分数组
                            content_parts = []
                            
                            # 添加文本内容
                            if content and content.strip():
                                content_parts.append({"type": "input_text", "text": content})
                            
                            # 添加文件内容（仅支持 direct 模式的 PDF 文件）
                            if files and len(files) > 0:
                                for file in files:
                                    if isinstance(file, dict):
                                        openai_file_id = file.get("openai_file_id")
                                        process_mode = file.get("process_mode", "direct")
                                    else:
                                        openai_file_id = getattr(file, "openai_file_id", None)
                                        process_mode = getattr(file, "process_mode", "direct")
                                    
                                    # 只有 direct 模式的文件才添加到 input_file（仅支持 PDF）
                                    if openai_file_id and process_mode == "direct":
                                        content_parts.append({
                                            "type": "input_file",
                                            "file_id": openai_file_id
                                        })
                            
                            # 如果没有内容部分，添加空文本
                            if not content_parts:
                                content_parts.append({"type": "input_text", "text": ""})
                            
                            input_messages.append({
                                "role": role,
                                "content": content_parts
                            })
                    
                    # 准备工具配置
                    tools_config = self._prepare_tools_config(messages)
                    
                    # 使用结构化输入格式
                    completion_params = {
                        "model": model,
                        "input": input_messages,
                        "reasoning": {
                            "effort": reasoning,
                            "summary": reasoning_summaries if reasoning_summaries != "auto" else "auto"
                        }
                    }
                    
                    # 添加工具配置
                    if tools_config["tools"]:
                        completion_params.update(tools_config)
                        # 如果有工具且是必需的，设置 tool_choice
                        need_code_interpreter = any(tool.get("type") == "code_interpreter" for tool in tools_config["tools"])
                        if need_code_interpreter:
                            completion_params["tool_choice"] = "required"
                    
                else:
                    # 纯文本模式（保持向后兼容）
                    input_text = ""
                    
                    for msg in messages:
                        role = self._get_message_attr(msg, "role")
                        content = self._get_message_attr(msg, "content")
                        
                        if role == "system":
                            instructions_text = content
                        elif role == "user":
                            input_text += f"{content}\n"
                        elif role == "assistant":
                            input_text += f"Assistant: {content}\n"
                    
                    completion_params = {
                        "model": model,
                        "input": input_text.strip(),
                        "reasoning": {
                            "effort": reasoning,
                            "summary": reasoning_summaries if reasoning_summaries != "auto" else "auto"
                        }
                    }
                
                # 添加 instructions 如果有 system 消息
                if instructions_text:
                    completion_params["instructions"] = instructions_text
                
                # GPT-5 系列模型使用 max_output_tokens (不是 max_completion_tokens)
                completion_params["max_output_tokens"] = 4000
                
                # 准备工具配置并添加到请求中
                tools_config = self._prepare_tools_config(messages, tools)
                if tools_config["tools"]:
                    completion_params.update(tools_config)
                
                # 打印实际发送的 JSON
                logger.info(f"📤 发送给 OpenAI Responses API 的完整请求: {json.dumps(completion_params, ensure_ascii=False, indent=2)}")
                logger.info(f"使用 Responses API 参数格式{'（包含文件支持）' if has_files else '（纯文本模式）'}")
                
                # 调用 Responses API
                try:
                    response = await asyncio.wait_for(
                        client.responses.create(**completion_params),
                        timeout=timeout
                    )
                except AttributeError:
                    # Fallback to chat completions if responses API not available
                    logger.warning("Responses API 不可用，回退到 Chat Completions API")
                    # 为 chat completions 重新构造参数
                    chat_params = {
                        "model": model,
                        "messages": messages,
                        "max_completion_tokens": 4000
                    }
                    response = await asyncio.wait_for(
                        client.chat.completions.create(**chat_params),
                        timeout=timeout
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
                    timeout=timeout
                )
            
            result = response.model_dump()
            logger.info(f"OpenAI Responses API调用成功")
            
            # 转换 Responses API 格式为标准 Chat Completions 格式
            converted_result = self._convert_responses_to_chat_format(result)
            return converted_result
            
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
                timeout=self.default_timeout
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
                timeout=self.default_timeout
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
                timeout=self.default_timeout
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
        reasoning_summaries: str = "auto",
        reasoning: str = "medium",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式完成（WebSocket使用）"""
        logger.info(f"开始流式调用 {provider} API")
        
        try:
            if provider == "openai":
                # 检查模型是否支持流式输出
                if await self._supports_streaming(provider, model):
                    async for chunk in self._openai_stream_completion(model, messages, api_key, thinking_mode, reasoning_summaries, tools, use_native_search):
                        yield chunk
                else:
                    # 不支持流式的模型，直接返回完整响应
                    logger.info(f"模型 {model} 不支持流式输出，使用普通请求")
                    response = await self.get_completion(provider, model, messages, api_key, False, thinking_mode, reasoning_summaries, reasoning, tools, use_native_search)
                    yield response
            else:
                # 其他提供商暂不支持流式
                response = await self.get_completion(provider, model, messages, api_key, False, thinking_mode, reasoning_summaries, reasoning)
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
        reasoning_summaries: str = "auto",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """OpenAI流式完成"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.default_timeout
            )
            
            # 转换消息格式以支持图片和文件
            converted_messages = [self._convert_message_to_openai_format(msg) for msg in messages]
            
            # 准备工具配置
            tools_config = self._prepare_tools_config(messages, tools)
            
            # 根据模型类型选择合适的参数
            stream_params = {
                "model": model,
                "messages": converted_messages,
                "stream": True
            }
            
            # 处理Web Search工具的回退逻辑
            if tools and use_native_search is False:
                # 对于不支持新版web_search的模型，使用旧版回退
                stream_params = await self._handle_web_search_fallback(
                    stream_params, tools, messages
                )
            elif tools_config["tools"]:
                stream_params.update(tools_config)
            
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