import openai
import anthropic
from google import genai
from typing import Dict, List, Any, AsyncGenerator, Union
import asyncio
import logging
import json
import os
import time
import base64
import httpx
import warnings
from .web_search_service import WebSearchService

# 禁用 Pydantic 序列化警告
warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')

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
    
    def _prepare_tools_config(self, messages: List[Union[Dict[str, Any], Any]], tools: List[Dict[str, Any]] = None, provider: str = "openai") -> Dict[str, Any]:
        """准备工具配置，基于消息中的文件类型和提供商"""
        if provider == "anthropic":
            return self._prepare_anthropic_tools_config(messages, tools)
        else:
            return self._prepare_openai_tools_config(messages, tools)

    def _prepare_openai_tools_config(self, messages: List[Union[Dict[str, Any], Any]], tools: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """准备OpenAI工具配置"""
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

        # 添加前端传来的工具配置
        if tools:
            for tool_config in tools:
                if tool_config.get("type") in ["web_search", "web_search_preview"]:
                    web_search_tool = self.web_search_service.build_web_search_tool_config(tool_config)
                    tools_config["tools"].append(web_search_tool)
                elif tool_config.get("type") == "image_generation":
                    image_gen_tool = self._build_image_generation_tool_config(tool_config)
                    tools_config["tools"].append(image_gen_tool)
                elif tool_config.get("type") == "function":
                    function_tool = self._build_function_calling_tool_config(tool_config)
                    tools_config["tools"].append(function_tool)
                elif tool_config.get("type") in ["mcp_server", "mcp"]:
                    # OpenAI使用Responses API的MCP格式
                    mcp_tool = self._build_openai_mcp_tool_config(tool_config)
                    tools_config["tools"].append(mcp_tool)

        return tools_config

    def _prepare_anthropic_tools_config(self, messages: List[Union[Dict[str, Any], Any]], tools: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """准备Anthropic工具配置"""
        tools_config = {"tools": [], "mcp_servers": []}

        # Anthropic目前主要支持function calling和MCP
        if tools:
            for tool_config in tools:
                if tool_config.get("type") == "function":
                    # Anthropic的function calling格式
                    function_tool = {
                        "name": tool_config.get("name"),
                        "description": tool_config.get("description", ""),
                        "input_schema": tool_config.get("parameters", {})
                    }
                    tools_config["tools"].append(function_tool)
                elif tool_config.get("type") in ["mcp_server", "mcp"]:
                    # Anthropic使用专门的mcp_servers参数
                    mcp_server = self._build_anthropic_mcp_server_config(tool_config)
                    tools_config["mcp_servers"].append(mcp_server)

        return tools_config
    
    def _build_image_generation_tool_config(self, tool_config: Dict[str, Any]) -> Dict[str, Any]:
        """构建图片生成工具配置"""
        config = {
            "type": "image_generation"
        }
        
        # 添加可选的图片生成参数
        if "size" in tool_config:
            config["size"] = tool_config["size"]
        
        if "quality" in tool_config:
            config["quality"] = tool_config["quality"]
        
        if "format" in tool_config:
            config["format"] = tool_config["format"]
        
        if "compression" in tool_config:
            config["compression"] = tool_config["compression"]
        
        if "background" in tool_config:
            config["background"] = tool_config["background"]
        
        if "input_fidelity" in tool_config:
            config["input_fidelity"] = tool_config["input_fidelity"]
        
        if "input_image" in tool_config:
            config["input_image"] = tool_config["input_image"]
        
        if "input_image_mask" in tool_config:
            config["input_image_mask"] = tool_config["input_image_mask"]
        
        if "partial_images" in tool_config:
            config["partial_images"] = tool_config["partial_images"]
        
        # 默认设置审核级别为low（如用户要求）
        config["moderation"] = tool_config.get("moderation", "low")
        
        return config

    def _build_function_calling_tool_config(self, tool_config: Dict[str, Any]) -> Dict[str, Any]:
        """构建 Function Calling 工具配置"""
        config = {
            "type": "function",
            "function": {
                "name": tool_config.get("name"),
                "description": tool_config.get("description", ""),
                "parameters": tool_config.get("parameters", {})
            }
        }

        # 添加严格模式支持
        if tool_config.get("strict"):
            config["function"]["strict"] = True

        return config

    def _build_openai_mcp_tool_config(self, tool_config: Dict[str, Any]) -> Dict[str, Any]:
        """构建OpenAI MCP工具配置（符合Responses API格式）"""
        # 支持url或server_url字段
        server_url = tool_config.get("server_url") or tool_config.get("url")

        # 验证服务器URL（如果提供了URL）
        if server_url and not self._validate_mcp_server_url(server_url, "openai"):
            logger.error(f"OpenAI MCP服务器URL验证失败: {server_url}")

        config = {
            "type": "mcp",
            "server_label": tool_config.get("server_name", tool_config.get("server_label", tool_config.get("name"))),
            "server_url": server_url,
        }

        # 添加可选字段
        if "server_description" in tool_config:
            config["server_description"] = tool_config["server_description"]
        elif "description" in tool_config:
            config["server_description"] = tool_config["description"]

        # 支持内置连接器（已废弃，保留兼容性）
        if "connector_id" in tool_config:
            config["connector_id"] = tool_config["connector_id"]
            # 连接器不需要server_url
            if "server_url" in config:
                del config["server_url"]

        # 授权配置
        if "authorization" in tool_config:
            config["authorization"] = tool_config["authorization"]

        # 审批要求配置（支持细粒度控制）
        if "require_approval" in tool_config:
            require_approval = tool_config["require_approval"]
            if isinstance(require_approval, dict):
                # 支持对象格式: {"never": {"tool_names": ["safe_tool"]}}
                config["require_approval"] = require_approval
            else:
                # 支持字符串格式: "always", "never"
                config["require_approval"] = require_approval
        else:
            # 默认总是需要审批（安全考虑）
            config["require_approval"] = "always"

        # 允许的工具列表
        if "allowed_tools" in tool_config:
            config["allowed_tools"] = tool_config["allowed_tools"]

        return config

    def _handle_mcp_approval_message(self, msg: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """处理MCP审批响应消息（OpenAI格式）"""
        if isinstance(msg, dict):
            approval_data = {
                "type": "mcp_approval_response",
                "approve": msg.get("approve", True),
                "approval_request_id": msg.get("approval_request_id")
            }
        else:
            approval_data = {
                "type": "mcp_approval_response",
                "approve": getattr(msg, "approve", True),
                "approval_request_id": getattr(msg, "approval_request_id", "")
            }

        return {
            "role": "user",
            "content": [{"type": "mcp_approval_response", **approval_data}]
        }

    def _validate_mcp_server_url(self, url: str, provider: str = "openai") -> bool:
        """验证MCP服务器URL是否符合安全要求"""
        if not url:
            return False

        # Anthropic要求使用HTTPS
        if provider == "anthropic" and not url.startswith("https://"):
            logger.warning(f"Anthropic MCP服务器URL必须使用HTTPS: {url}")
            return False

        # OpenAI推荐使用HTTPS
        if provider == "openai" and not url.startswith(("https://", "http://localhost", "http://127.0.0.1")):
            logger.warning(f"OpenAI MCP服务器URL建议使用HTTPS（除非是本地测试）: {url}")
            return False

        return True

    def _build_anthropic_mcp_server_config(self, tool_config: Dict[str, Any]) -> Dict[str, Any]:
        """构建Anthropic MCP服务器配置（符合Messages API格式）"""
        server_url = tool_config.get("server_url", tool_config.get("url"))

        # 验证服务器URL（Anthropic要求HTTPS）
        if server_url and not self._validate_mcp_server_url(server_url, "anthropic"):
            logger.error(f"Anthropic MCP服务器URL验证失败: {server_url}")

        config = {
            "type": "url",
            "name": tool_config.get("server_name", tool_config.get("name")),
            "url": server_url
        }

        # 授权令牌
        if "authorization" in tool_config:
            config["authorization_token"] = tool_config["authorization"]
        elif "authorization_token" in tool_config:
            config["authorization_token"] = tool_config["authorization_token"]

        # 工具配置
        tool_configuration = {}

        # 启用状态
        if "enabled" in tool_config:
            tool_configuration["enabled"] = tool_config["enabled"]
        else:
            tool_configuration["enabled"] = True

        # 允许的工具列表
        if "allowed_tools" in tool_config and tool_config["allowed_tools"]:
            tool_configuration["allowed_tools"] = tool_config["allowed_tools"]

        if tool_configuration:
            config["tool_configuration"] = tool_configuration

        return config

    def _find_previous_image_generation(self, messages: List[Union[Dict[str, Any], Any]]) -> str:
        """查找之前的图片生成结果的ID，用于多轮图像生成"""
        # 从最近的消息开始向后查找
        for msg in reversed(messages):
            role = self._get_message_attr(msg, "role")
            if role == "assistant":
                # 检查是否有图片生成结果
                image_generations = None
                if isinstance(msg, dict):
                    image_generations = msg.get("image_generations")
                else:
                    image_generations = getattr(msg, "image_generations", None)
                
                if image_generations and len(image_generations) > 0:
                    # 返回最近的图片生成ID
                    return image_generations[-1].get("id", "")
        
        return ""
    
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
        use_native_search: bool = None,
        base_url: str = None
    ) -> Dict[str, Any]:
        """获取AI完成响应"""
        logger.info(f"开始调用 {provider} API, 模型: {model}, 思考模式: {thinking_mode}")
        
        # 使用重试机制
        last_exception = None
        for attempt in range(self.max_retries + 1):
            try:
                if provider == "openai":
                    # OpenAI 提供商现在只使用 Responses API
                    return await self._openai_responses_completion(model, messages, api_key, thinking_mode, reasoning_summaries, reasoning, tools, use_native_search)
                elif provider == "anthropic":
                    return await self._anthropic_completion(model, messages, api_key, thinking_mode, tools, stream)
                elif provider == "google":
                    return await self._google_completion(model, messages, api_key, stream, thinking_mode, reasoning_summaries, reasoning, tools, use_native_search)
                elif provider == "openai_compatible":
                    return await self._openai_compatible_completion(model, messages, api_key, stream, thinking_mode, reasoning_summaries, tools, use_native_search, base_url)
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
        image_generations = []
        function_calls = []
        custom_tool_calls = []
        mcp_list_tools = []
        mcp_calls = []
        mcp_approval_requests = []

        # 提取不同类型的输出内容
        assistant_content = ""
        finish_reason = "stop"

        for item in output:
            # 提取推理内容
            if item.get("type") == "reasoning":
                summary_items = item.get("summary", [])
                for summary_item in summary_items:
                    if summary_item.get("type") == "summary_text":
                        reasoning_content = summary_item.get("text", "")
                        break

            # 提取图片生成结果
            elif item.get("type") == "image_generation_call":
                image_gen = {
                    "id": item.get("id"),
                    "type": "image_generation_call",
                    "status": item.get("status"),
                    "result": item.get("result"),
                    "revised_prompt": item.get("revised_prompt")
                }
                image_generations.append(image_gen)

            # 提取function calling结果（根据官方文档格式）
            elif item.get("type") == "function_call":
                function_call = {
                    "id": item.get("call_id", item.get("id")),  # 使用call_id作为主ID
                    "type": "function",
                    "function": {
                        "name": item.get("name"),
                        "arguments": item.get("arguments", "{}")
                    }
                }
                function_calls.append(function_call)
                finish_reason = "tool_calls"

            # 提取custom tool calling结果
            elif item.get("type") == "custom_tool_call":
                custom_tool_call = {
                    "id": item.get("id"),
                    "type": "custom_tool_call",
                    "name": item.get("name"),
                    "input": item.get("input", ""),
                    "call_id": item.get("call_id")
                }
                custom_tool_calls.append(custom_tool_call)
                finish_reason = "tool_calls"

            # 提取MCP工具列表（根据官方文档）
            elif item.get("type") == "mcp_list_tools":
                mcp_list_tool = {
                    "id": item.get("id"),
                    "type": "mcp_list_tools",
                    "server_label": item.get("server_label"),
                    "tools": item.get("tools", [])
                }
                mcp_list_tools.append(mcp_list_tool)

            # 提取MCP调用结果
            elif item.get("type") == "mcp_call":
                mcp_call = {
                    "id": item.get("id"),
                    "type": "mcp_call",
                    "server_label": item.get("server_label"),
                    "name": item.get("name"),
                    "arguments": item.get("arguments"),
                    "output": item.get("output"),
                    "error": item.get("error"),
                    "approval_request_id": item.get("approval_request_id"),
                    "status": item.get("status", "completed"),
                    "execution_time": item.get("execution_time")
                }
                mcp_calls.append(mcp_call)

                # 根据MCP调用状态设置finish_reason
                if item.get("error"):
                    finish_reason = "mcp_error"
                elif item.get("approval_request_id"):
                    finish_reason = "approval_required"
                else:
                    finish_reason = "mcp_tool_calls"

            # 提取MCP审批请求
            elif item.get("type") == "mcp_approval_request":
                mcp_approval_request = {
                    "id": item.get("id"),
                    "type": "mcp_approval_request",
                    "server_label": item.get("server_label"),
                    "name": item.get("name"),
                    "arguments": item.get("arguments")
                }
                mcp_approval_requests.append(mcp_approval_request)
                finish_reason = "approval_required"

            # 提取助手消息内容
            elif item.get("type") == "message" and item.get("role") == "assistant":
                message_content = item.get("content", [])

                # 提取文本内容
                for content_item in message_content:
                    if content_item.get("type") == "output_text":
                        assistant_content = content_item.get("text", "")
                        break

        # 构造选择对象
        choice = {
            "message": {
                "role": "assistant",
                "content": assistant_content
            },
            "finish_reason": finish_reason,
            "index": 0
        }

        # 添加tool_calls如果有function calling
        if function_calls:
            choice["message"]["tool_calls"] = function_calls

        # 添加custom tool calls如果有
        if custom_tool_calls:
            choice["message"]["custom_tool_calls"] = custom_tool_calls

        # 如果有推理内容，添加到消息中
        if reasoning_content:
            choice["message"]["reasoning"] = reasoning_content

        # 如果有图片生成结果，添加到消息中
        if image_generations:
            choice["message"]["image_generations"] = image_generations

        # 如果有MCP工具列表，添加到消息中
        if mcp_list_tools:
            choice["message"]["mcp_list_tools"] = mcp_list_tools

        # 如果有MCP调用结果，添加到消息中
        if mcp_calls:
            choice["message"]["mcp_calls"] = mcp_calls

        # 如果有MCP审批请求，添加到消息中
        if mcp_approval_requests:
            choice["message"]["mcp_approval_requests"] = mcp_approval_requests

        choices.append(choice)

        # 如果没有任何内容但有图片生成结果，创建一个空消息来承载图片
        if not choices and image_generations:
            choice = {
                "message": {
                    "role": "assistant",
                    "content": "",
                    "image_generations": image_generations
                },
                "finish_reason": "stop",
                "index": 0
            }
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
                        elif role == "mcp_approval_response":
                            # 处理MCP审批响应（特殊消息类型）
                            if isinstance(msg, dict):
                                input_messages.append({
                                    "type": "mcp_approval_response",
                                    "approve": msg.get("approve", True),
                                    "approval_request_id": msg.get("approval_request_id")
                                })
                            else:
                                # 对于Pydantic对象
                                input_messages.append({
                                    "type": "mcp_approval_response",
                                    "approve": getattr(msg, "approve", True),
                                    "approval_request_id": getattr(msg, "approval_request_id", "")
                                })
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
                    tools_config = self._prepare_tools_config(messages, tools)
                    
                    # 检查是否有图片生成工具并查找之前的图片生成结果
                    previous_image_gen_id = ""
                    has_image_gen_tool = tools and any(tool.get("type") == "image_generation" for tool in tools)
                    if has_image_gen_tool:
                        previous_image_gen_id = self._find_previous_image_generation(messages)
                    
                    # 使用 Responses API 的多模态参数结构
                    # 将前端的 'instant' 映射为 OpenAI API 的 'minimal'
                    effort_value = "minimal" if reasoning == "instant" else reasoning
                    completion_params = {
                        "model": model,
                        "input": input_messages,
                        "reasoning": {
                            "effort": effort_value,
                            "summary": reasoning_summaries if reasoning_summaries != "auto" else "auto"
                        }
                    }
                    
                    # 如果有之前的图片生成结果，添加到请求中（用于多轮图像生成）
                    if previous_image_gen_id:
                        completion_params["previous_response_id"] = previous_image_gen_id
                        logger.info(f"使用previous_response_id进行多轮图像生成: {previous_image_gen_id}")
                    
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
                    tools_config = self._prepare_tools_config(messages, tools)
                    
                    # 检查是否有图片生成工具并查找之前的图片生成结果
                    previous_image_gen_id = ""
                    has_image_gen_tool = tools and any(tool.get("type") == "image_generation" for tool in tools)
                    if has_image_gen_tool:
                        previous_image_gen_id = self._find_previous_image_generation(messages)
                    
                    # 使用结构化输入格式
                    # 将前端的 'instant' 映射为 OpenAI API 的 'minimal'
                    effort_value = "minimal" if reasoning == "instant" else reasoning
                    completion_params = {
                        "model": model,
                        "input": input_messages,
                        "reasoning": {
                            "effort": effort_value,
                            "summary": reasoning_summaries if reasoning_summaries != "auto" else "auto"
                        }
                    }
                    
                    # 如果有之前的图片生成结果，添加到请求中（用于多轮图像生成）
                    if previous_image_gen_id:
                        completion_params["previous_response_id"] = previous_image_gen_id
                        logger.info(f"使用previous_response_id进行多轮图像生成: {previous_image_gen_id}")
                    
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
                    
                    # 检查是否有图片生成工具并查找之前的图片生成结果
                    previous_image_gen_id = ""
                    has_image_gen_tool = tools and any(tool.get("type") == "image_generation" for tool in tools)
                    if has_image_gen_tool:
                        previous_image_gen_id = self._find_previous_image_generation(messages)
                    
                    # 将前端的 'instant' 映射为 OpenAI API 的 'minimal'
                    effort_value = "minimal" if reasoning == "instant" else reasoning
                    completion_params = {
                        "model": model,
                        "input": input_text.strip(),
                        "reasoning": {
                            "effort": effort_value,
                            "summary": reasoning_summaries if reasoning_summaries != "auto" else "auto"
                        }
                    }
                    
                    # 如果有之前的图片生成结果，添加到请求中（用于多轮图像生成）
                    if previous_image_gen_id:
                        completion_params["previous_response_id"] = previous_image_gen_id
                        logger.info(f"使用previous_response_id进行多轮图像生成: {previous_image_gen_id}")
                
                # 添加 instructions 如果有 system 消息
                if instructions_text:
                    completion_params["instructions"] = instructions_text
                
                # GPT-5 系列模型使用 max_output_tokens (不是 max_completion_tokens)
                completion_params["max_output_tokens"] = 4000
                
                # 准备工具配置并添加到请求中
                tools_config = self._prepare_tools_config(messages, tools, "openai")
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
                except AttributeError as e:
                    # Responses API 不可用时抛出错误，不再回退
                    logger.error("Responses API 不可用，请升级 OpenAI SDK 到最新版本")
                    raise Exception(f"Responses API 不可用: {str(e)}. 请运行: pip install --upgrade openai")
            else:
                # 标准的 Responses API 调用（对于其他非 GPT-5 思考模式的模型）
                # 转换消息为 Responses API 格式
                input_messages = []
                instructions_text = ""

                for msg in messages:
                    role = self._get_message_attr(msg, "role")
                    content = self._get_message_attr(msg, "content")

                    if role == "system":
                        instructions_text = content
                    else:
                        input_messages.append({
                            "role": role,
                            "content": content
                        })

                completion_params = {
                    "model": model,
                    "input": input_messages
                }

                # 添加 instructions
                if instructions_text:
                    completion_params["instructions"] = instructions_text

                # 准备工具配置
                tools_config = self._prepare_tools_config(messages, tools, "openai")
                if tools_config["tools"]:
                    completion_params["tools"] = tools_config["tools"]

                # GPT-5 系列模型不支持自定义 temperature，使用默认值 1
                if not self._is_gpt5_model(model):
                    completion_params["temperature"] = 0.7

                # 使用 max_output_tokens（Responses API 的参数）
                completion_params["max_output_tokens"] = 4000

                # 使用 Responses API
                response = await asyncio.wait_for(
                    client.responses.create(**completion_params),
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

    def _convert_message_to_anthropic_format(self, msg: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """将消息转换为Anthropic Messages API格式，支持图片、文件、搜索结果和引用"""
        role = self._get_message_attr(msg, "role")
        content = self._get_message_attr(msg, "content")
        
        # 获取多媒体和附加数据
        images = None
        files = None
        search_results = None
        citations_enabled = False
        
        if isinstance(msg, dict):
            images = msg.get("images")
            files = msg.get("files")
            search_results = msg.get("search_results")
            citations_enabled = msg.get("citations_enabled", False)
        else:
            images = getattr(msg, "images", None)
            files = getattr(msg, "files", None)
            search_results = getattr(msg, "search_results", None)
            citations_enabled = getattr(msg, "citations_enabled", False)
        
        # 检查是否有多媒体内容
        has_multimedia = (images and len(images) > 0) or (files and len(files) > 0) or (search_results and len(search_results) > 0)
        
        # 如果没有多媒体内容，使用传统格式
        if not has_multimedia:
            return {"role": role, "content": content}
        
        # 构造支持多媒体的消息格式
        content_parts = []
        
        # 添加文本内容（如果有）
        if content and content.strip():
            content_parts.append({"type": "text", "text": content})
        
        # 添加图片内容（Vision支持）
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
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": image_data
                        }
                    })
        
        # 添加文件内容（根据类型分流为image或document）
        if files:
            for file in files:
                if isinstance(file, dict):
                    file_id = file.get("anthropic_file_id")
                    filename = file.get("filename")
                    file_data = file.get("data")  # base64数据
                    mime_type = file.get("mime_type", "application/octet-stream")
                    file_url = file.get("url")  # URL方式
                else:
                    file_id = getattr(file, "anthropic_file_id", "")
                    filename = getattr(file, "filename", "")
                    file_data = getattr(file, "data", "")
                    mime_type = getattr(file, "mime_type", "application/octet-stream")
                    file_url = getattr(file, "url", "")
                
                # 根据MIME类型判断是图片还是文档
                if mime_type.startswith("image/"):
                    # 图片文件：作为image content处理（Vision支持）
                    if file_id:
                        # 使用Files API上传的图片
                        content_parts.append({
                            "type": "image",
                            "source": {
                                "type": "file",
                                "file_id": file_id
                            }
                        })
                    elif file_url:
                        # URL方式的图片
                        content_parts.append({
                            "type": "image",
                            "source": {
                                "type": "url",
                                "url": file_url
                            }
                        })
                    elif file_data:
                        # Base64方式的图片
                        content_parts.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": file_data
                            }
                        })
                else:
                    # 非图片文件：作为document content处理（PDF、文档等）
                    if file_id:
                        # 使用Files API上传的文档
                        content_parts.append({
                            "type": "document",
                            "source": {
                                "type": "file",
                                "file_id": file_id
                            }
                        })
                    elif file_url:
                        # URL方式的文档
                        content_parts.append({
                            "type": "document",
                            "source": {
                                "type": "url",
                                "url": file_url
                            }
                        })
                    elif file_data and mime_type == "application/pdf":
                        # Base64方式的PDF文档
                        content_parts.append({
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": file_data
                            }
                        })
                    elif file_data and (mime_type.startswith("text/") or mime_type in ["application/json", "application/xml"]):
                        # 文本类文档（需要解码base64为文本）
                        try:
                            import base64
                            if file_data.strip():  # 检查是否为base64
                                try:
                                    text_content = base64.b64decode(file_data).decode('utf-8')
                                except:
                                    text_content = file_data  # 假设已经是文本
                            else:
                                text_content = file_data
                            
                            content_parts.append({
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": mime_type,
                                    "data": file_data
                                }
                            })
                        except Exception as e:
                            # 如果解码失败，仍然按原始数据处理
                            content_parts.append({
                                "type": "document", 
                                "source": {
                                    "type": "base64",
                                    "media_type": mime_type,
                                    "data": file_data
                                }
                            })
        
        # 添加搜索结果内容（Search Results支持）
        if search_results:
            for result in search_results:
                if isinstance(result, dict):
                    source = result.get("source", "")
                    title = result.get("title", "")
                    result_content = result.get("content", "")
                else:
                    source = getattr(result, "source", "")
                    title = getattr(result, "title", "")
                    result_content = getattr(result, "content", "")
                
                if result_content:
                    content_parts.append({
                        "type": "search_result",
                        "source": source,
                        "title": title,
                        "content": [
                            {
                                "type": "text",
                                "text": result_content
                            }
                        ],
                        "citations": {"enabled": citations_enabled}
                    })
        
        return {
            "role": role,
            "content": content_parts
        }

    def _check_uses_files_api(self, messages: List[Dict[str, Any]]) -> bool:
        """检查消息中是否使用了Files API"""
        for message in messages:
            content = message.get("content", [])
            if isinstance(content, list):
                for content_block in content:
                    if isinstance(content_block, dict):
                        # 检查image content blocks
                        if content_block.get("type") == "image":
                            source = content_block.get("source", {})
                            if source.get("type") == "file":
                                return True
                        # 检查document content blocks
                        elif content_block.get("type") == "document":
                            source = content_block.get("source", {})
                            if source.get("type") == "file":
                                return True
        return False

    async def _anthropic_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        thinking_mode: bool = False,
        tools: List[Dict[str, Any]] = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Anthropic Claude Messages API 调用，支持Extended Thinking、Vision、Files、Citations和Search Results"""
        try:
            client = anthropic.AsyncAnthropic(
                api_key=api_key,
                timeout=self.default_timeout
            )
            
            logger.info(f"调用Anthropic模型: {model}, 扩展思考模式: {thinking_mode}, 流式输出: {stream}")
            
            system_message = ""
            user_messages = []
            
            # 转换消息格式以支持多媒体内容
            for msg in messages:
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")
                
                if role == "system":
                    system_message = content
                else:
                    # 转换为Anthropic Messages API格式
                    converted_msg = self._convert_message_to_anthropic_format(msg)
                    user_messages.append(converted_msg)
            
            # 构建请求参数
            kwargs = {
                "model": model,
                "max_tokens": 4000,
                "messages": user_messages,
                "temperature": 0.7,
                "stream": stream
            }
            
            # 添加system消息（如果有）
            if system_message:
                kwargs["system"] = system_message
            
            # Extended Thinking支持（Claude不允许用户设置budget_tokens，使用固定值10000）
            if thinking_mode:
                kwargs["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": 10000  # 固定值，如文档要求
                }
                logger.info("启用Claude扩展思考模式，budget_tokens: 10000")
            
            # 工具配置（如果有）
            if tools:
                # 使用Anthropic专用的工具配置
                tools_config = self._prepare_tools_config(messages, tools, "anthropic")

                # 添加function calling工具
                if tools_config["tools"]:
                    kwargs["tools"] = tools_config["tools"]

                # 添加MCP服务器
                if tools_config["mcp_servers"]:
                    kwargs["mcp_servers"] = tools_config["mcp_servers"]
                    # 始终添加MCP beta头部（如果MCP服务器存在）
                    kwargs["betas"] = kwargs.get("betas", [])
                    if "mcp-client-2025-04-04" not in kwargs["betas"]:
                        kwargs["betas"].append("mcp-client-2025-04-04")

                # 处理web search工具（使用原有逻辑）
                web_search_tools = self._convert_tools_to_anthropic_format(tools)
                if web_search_tools:
                    if "tools" not in kwargs:
                        kwargs["tools"] = []
                    kwargs["tools"].extend(web_search_tools)
            
            # 检查是否使用了Files API，如果是则添加betas参数
            uses_files_api = self._check_uses_files_api(user_messages)
            if uses_files_api:
                kwargs["betas"] = ["files-api-2025-04-14"]
                logger.info("检测到Files API使用，已添加betas参数")
            
            # 调用Anthropic Messages API
            if uses_files_api:
                response = await asyncio.wait_for(
                    client.beta.messages.create(**kwargs),
                    timeout=self.default_timeout
                )
            else:
                response = await asyncio.wait_for(
                    client.messages.create(**kwargs),
                    timeout=self.default_timeout
                )
            
            # 转换响应为OpenAI兼容格式
            result = self._convert_anthropic_response_to_openai_format(response, thinking_mode)
            
            logger.info(f"Anthropic API调用成功，响应内容块数量: {len(response.content) if hasattr(response, 'content') else 0}")
            return result
            
        except anthropic.AuthenticationError as e:
            logger.error(f"Anthropic认证失败: {str(e)}")
            raise Exception("Anthropic API密钥无效，请检查您的API密钥")
        except anthropic.RateLimitError as e:
            logger.error(f"Anthropic速率限制: {str(e)}")
            raise Exception("Anthropic API请求频率过高，请稍后重试")
        except Exception as e:
            logger.error(f"Anthropic API调用失败: {str(e)}")
            raise Exception(f"Anthropic API调用失败: {str(e)}")

    def _convert_tools_to_anthropic_format(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """将工具配置转换为Anthropic格式"""
        anthropic_tools = []
        
        for tool in tools:
            tool_type = tool.get("type")
            
            if tool_type == "web_search" or tool_type == "web_search_20250305":
                # Web Search工具 - 支持Anthropic web_search_20250305格式
                anthropic_tool = {
                    "type": "web_search_20250305",
                    "name": "web_search"
                }
                
                # 添加可选参数
                if tool.get("max_uses"):
                    anthropic_tool["max_uses"] = tool.get("max_uses", 5)
                
                if tool.get("user_location"):
                    anthropic_tool["user_location"] = tool.get("user_location")
                
                if tool.get("allowed_domains"):
                    anthropic_tool["allowed_domains"] = tool.get("allowed_domains")
                
                if tool.get("blocked_domains"):
                    anthropic_tool["blocked_domains"] = tool.get("blocked_domains")
                
                anthropic_tools.append(anthropic_tool)
            
            # 可以在这里添加其他工具类型的支持
        
        return anthropic_tools

    def _convert_anthropic_response_to_openai_format(self, response: Any, thinking_mode: bool = False) -> Dict[str, Any]:
        """将Anthropic响应转换为OpenAI兼容格式"""
        content_text = ""
        thinking_content = ""
        citations = []
        tool_calls = []
        mcp_tool_uses = []
        mcp_tool_results = []

        # 处理响应内容
        if hasattr(response, 'content') and response.content:
            for content_block in response.content:
                if hasattr(content_block, 'type'):
                    if content_block.type == "text":
                        # 文本内容
                        content_text += getattr(content_block, 'text', '')

                        # 提取citations（如果有）
                        if hasattr(content_block, 'citations') and content_block.citations:
                            for citation in content_block.citations:
                                citations.append({
                                    "type": getattr(citation, 'type', 'unknown'),
                                    "cited_text": getattr(citation, 'cited_text', ''),
                                    "source": getattr(citation, 'source', ''),
                                    "title": getattr(citation, 'title', ''),
                                    "document_index": getattr(citation, 'document_index', 0),
                                    "start_char_index": getattr(citation, 'start_char_index', 0),
                                    "end_char_index": getattr(citation, 'end_char_index', 0)
                                })

                    elif content_block.type == "thinking" and thinking_mode:
                        # 扩展思考内容
                        thinking_content = getattr(content_block, 'content', '') or getattr(content_block, 'thinking', '')

                    elif content_block.type == "tool_use":
                        # 标准function calling工具使用
                        tool_call = {
                            "id": getattr(content_block, 'id', ''),
                            "type": "function",
                            "function": {
                                "name": getattr(content_block, 'name', ''),
                                "arguments": json.dumps(getattr(content_block, 'input', {}))
                            }
                        }
                        tool_calls.append(tool_call)

                    elif content_block.type == "mcp_tool_use":
                        # MCP工具使用
                        mcp_tool_use = {
                            "id": getattr(content_block, 'id', ''),
                            "type": "mcp_tool_use",
                            "name": getattr(content_block, 'name', ''),
                            "server_name": getattr(content_block, 'server_name', ''),
                            "input": getattr(content_block, 'input', {})
                        }
                        mcp_tool_uses.append(mcp_tool_use)

                    elif content_block.type == "mcp_tool_result":
                        # MCP工具结果
                        mcp_tool_result = {
                            "tool_use_id": getattr(content_block, 'tool_use_id', ''),
                            "type": "mcp_tool_result",
                            "is_error": getattr(content_block, 'is_error', False),
                            "content": getattr(content_block, 'content', []),
                            "server_name": getattr(content_block, 'server_name', ''),
                            "execution_time": getattr(content_block, 'execution_time', None)
                        }
                        mcp_tool_results.append(mcp_tool_result)
        
        # 构建消息对象
        message = {
            "role": "assistant",
            "content": content_text
        }
        
        # 添加思考内容（如果有）
        if thinking_content and thinking_mode:
            message["reasoning"] = thinking_content
        
        # 添加citations（如果有）
        if citations:
            message["citations"] = citations

        # 添加标准function calling工具调用（如果有）
        if tool_calls:
            message["tool_calls"] = tool_calls

        # 添加MCP工具使用和结果（如果有）
        if mcp_tool_uses:
            message["mcp_tool_uses"] = mcp_tool_uses

        if mcp_tool_results:
            message["mcp_tool_results"] = mcp_tool_results

        # 构建完整响应
        result = {
            "id": f"msg_{getattr(response, 'id', 'unknown')}",
            "choices": [{
                "message": message,
                "finish_reason": self._map_anthropic_stop_reason(getattr(response, 'stop_reason', None))
            }],
            "usage": {
                "prompt_tokens": getattr(response.usage, 'input_tokens', 0) if hasattr(response, 'usage') else 0,
                "completion_tokens": getattr(response.usage, 'output_tokens', 0) if hasattr(response, 'usage') else 0,
                "total_tokens": (getattr(response.usage, 'input_tokens', 0) + getattr(response.usage, 'output_tokens', 0)) if hasattr(response, 'usage') else 0
            }
        }
        
        return result

    def _map_anthropic_stop_reason(self, stop_reason: str) -> str:
        """映射Anthropic的停止原因到OpenAI格式"""
        mapping = {
            "end_turn": "stop",
            "max_tokens": "length",
            "tool_use": "tool_calls",
            "mcp_tool_use": "mcp_tool_calls"
        }
        return mapping.get(stop_reason, "stop")

    async def _google_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto",
        reasoning: str = "medium",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> Dict[str, Any]:
        """Google Gemini API 调用 - 完整实现"""
        try:
            genai.configure(api_key=api_key)

            logger.info(f"调用Google模型: {model}, 流式: {stream}")

            # 转换消息格式和多模态内容
            history = []
            system_instruction = None

            # 处理系统消息
            for i, msg in enumerate(messages):
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")

                if role == "system":
                    system_instruction = content
                    continue
                elif i == len(messages) - 1:
                    # 最后一条消息单独处理
                    break
                elif role == "user":
                    # 处理多模态内容
                    parts = self._convert_message_to_gemini_parts(msg)
                    history.append({"role": "user", "parts": parts})
                elif role == "assistant":
                    history.append({"role": "model", "parts": [content]})

            # 配置生成参数
            generation_config = {
                "temperature": 0.7,
                "max_output_tokens": 8192,
            }

            # 处理thinking mode
            if thinking_mode and model.startswith("gemini-2.0"):
                generation_config["thinking_budget"] = self._get_thinking_budget(reasoning)

            # 转换工具
            gemini_tools = None
            if tools:
                gemini_tools = self._convert_tools_to_gemini_format(tools)

            # 创建模型实例
            model_instance = genai.GenerativeModel(
                model_name=model,
                generation_config=generation_config,
                system_instruction=system_instruction,
                tools=gemini_tools
            )

            # 检查是否有图像生成工具
            has_image_generation_tool = tools and any(tool.get("type") == "image_generation" for tool in tools)

            # 处理最后一条用户消息
            last_message = messages[-1]
            user_parts = self._convert_message_to_gemini_parts(last_message)

            # 如果有图像生成工具，使用专门的图像生成模型
            if has_image_generation_tool:
                return await self._handle_google_image_generation(
                    user_parts, api_key, tools, model
                )

            # 生成响应
            if stream:
                return await self._google_stream_completion(
                    model_instance, history, user_parts
                )
            else:
                chat = model_instance.start_chat(history=history)
                response = await asyncio.wait_for(
                    chat.send_message_async(user_parts),
                    timeout=self.default_timeout
                )

                return self._convert_gemini_response_to_openai_format(response, model)

        except Exception as e:
            logger.error(f"Google API调用失败: {str(e)}")
            raise Exception(f"Google API调用失败: {str(e)}")

    def _convert_message_to_gemini_parts(self, msg):
        """将消息转换为Gemini Parts格式，支持多模态"""
        content = self._get_message_attr(msg, "content")

        # 获取图片数据
        images = None
        if isinstance(msg, dict):
            images = msg.get("images")
        else:
            images = getattr(msg, "images", None)

        parts = []

        # 添加文本内容
        if content and content.strip():
            parts.append(content)

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
                    import base64
                    try:
                        # 解码base64图片数据
                        image_bytes = base64.b64decode(image_data)
                        parts.append({
                            "mime_type": mime_type,
                            "data": image_bytes
                        })
                    except Exception as e:
                        logger.warning(f"解码图片数据失败: {e}")

        return parts if parts else [content or ""]

    def _convert_tools_to_gemini_format(self, tools):
        """将工具转换为Gemini格式"""
        gemini_tools = []

        for tool in tools:
            if tool.get("type") == "function":
                function_info = tool.get("function", {})
                gemini_tools.append({
                    "function_declarations": [{
                        "name": function_info.get("name"),
                        "description": function_info.get("description"),
                        "parameters": function_info.get("parameters", {})
                    }]
                })

        return gemini_tools

    def _get_thinking_budget(self, reasoning):
        """根据reasoning级别获取thinking budget"""
        budget_map = {
            "low": 1000,
            "medium": 5000,
            "high": 10000
        }
        return budget_map.get(reasoning, 5000)

    async def _google_stream_completion(self, model_instance, history, user_parts):
        """Google流式响应处理"""
        try:
            chat = model_instance.start_chat(history=history)
            response_stream = chat.send_message_stream(user_parts)

            # 收集流式响应
            full_text = ""
            async for chunk in response_stream:
                if chunk.text:
                    full_text += chunk.text

            # 等待流完成
            await response_stream.resolve()
            final_response = response_stream.response

            return self._convert_gemini_response_to_openai_format(final_response, model_instance.model_name)

        except Exception as e:
            logger.error(f"Google流式响应失败: {str(e)}")
            raise

    def _convert_gemini_response_to_openai_format(self, response, model):
        """将Gemini响应转换为OpenAI格式"""
        choices = []

        # 处理候选响应
        for i, candidate in enumerate(response.candidates):
            content = ""
            tool_calls = []

            # 提取文本内容
            for part in candidate.content.parts:
                if hasattr(part, 'text') and part.text:
                    content += part.text
                elif hasattr(part, 'function_call'):
                    # 处理函数调用
                    func_call = part.function_call
                    tool_calls.append({
                        "id": f"call_{hash(func_call.name)}",
                        "type": "function",
                        "function": {
                            "name": func_call.name,
                            "arguments": json.dumps(dict(func_call.args))
                        }
                    })

            # 构建消息
            message = {
                "role": "assistant",
                "content": content
            }

            if tool_calls:
                message["tool_calls"] = tool_calls

            choices.append({
                "index": i,
                "message": message,
                "finish_reason": self._convert_gemini_finish_reason(candidate.finish_reason)
            })

        return {
            "id": f"gemini_{hash(str(response)) % 1000000}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": choices,
            "usage": {
                "prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "completion_tokens": getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "total_tokens": getattr(response.usage_metadata, 'total_token_count', 0) if hasattr(response, 'usage_metadata') else 0
            }
        }

    def _convert_gemini_finish_reason(self, finish_reason):
        """转换Gemini finish_reason到OpenAI格式"""
        mapping = {
            "STOP": "stop",
            "MAX_TOKENS": "length",
            "SAFETY": "content_filter",
            "RECITATION": "content_filter",
            "OTHER": "stop"
        }
        return mapping.get(str(finish_reason), "stop")

    async def _handle_google_image_generation(
        self,
        user_parts: List[Any],
        api_key: str,
        tools: List[Dict[str, Any]],
        model: str
    ) -> Dict[str, Any]:
        """处理Google图像生成工具调用"""
        try:
            genai.configure(api_key=api_key)

            # 提取图像生成工具配置
            image_gen_tool = None
            for tool in tools:
                if tool.get("type") == "image_generation":
                    image_gen_tool = tool
                    break

            if not image_gen_tool:
                raise Exception("未找到图像生成工具配置")

            # 构建图像生成提示
            prompt_text = ""
            if isinstance(user_parts, list):
                for part in user_parts:
                    if isinstance(part, str):
                        prompt_text += part + " "
                    elif isinstance(part, dict) and "text" in part:
                        prompt_text += part["text"] + " "
            else:
                prompt_text = str(user_parts)

            # 构建完整的图像生成提示
            image_prompt = f"Generate an image: {prompt_text.strip()}"

            # 根据工具配置调整提示
            style = image_gen_tool.get("style", "natural")
            quality = image_gen_tool.get("quality", "standard")

            if style == "artistic":
                image_prompt += " in artistic style"
            elif style == "photorealistic":
                image_prompt += " in photorealistic style"
            elif style == "digital_art":
                image_prompt += " in digital art style"

            if quality == "hd":
                image_prompt += " with high detail and quality"

            logger.info(f"Google图像生成提示: {image_prompt}")

            # 使用Gemini 2.5 Flash Image模型生成图像
            image_model = "gemini-2.5-flash-image" if model != "gemini-2.5-flash-image" else model
            model_instance = genai.GenerativeModel(image_model)

            response = await asyncio.wait_for(
                model_instance.generate_content_async(
                    image_prompt,
                    generation_config={
                        "temperature": 0.8,
                        "max_output_tokens": 8192,
                    }
                ),
                timeout=self.default_timeout * 2  # 图像生成需要更长时间
            )

            # 处理图像生成结果
            image_generations = []

            # 检查响应中是否包含图片
            if hasattr(response, 'candidates') and response.candidates:
                for candidate in response.candidates:
                    if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                        for part in candidate.content.parts:
                            # 检查是否为图片部分
                            if hasattr(part, 'inline_data'):
                                image_data = part.inline_data.data
                                mime_type = part.inline_data.mime_type

                                # 转换为base64格式
                                if isinstance(image_data, bytes):
                                    b64_data = base64.b64encode(image_data).decode('utf-8')
                                else:
                                    b64_data = image_data

                                image_gen_result = {
                                    "id": f"img_gen_{int(time.time() * 1000)}",
                                    "type": "image_generation_call",
                                    "status": "completed",
                                    "result": {
                                        "url": f"data:{mime_type};base64,{b64_data}",
                                        "b64_json": b64_data
                                    },
                                    "revised_prompt": prompt_text.strip()
                                }
                                image_generations.append(image_gen_result)

            # 如果没有直接的图片数据，但有文本响应，则认为图像生成请求被接受
            if not image_generations and response.text:
                # 创建一个表示图像生成调用的记录
                image_gen_result = {
                    "id": f"img_gen_{int(time.time() * 1000)}",
                    "type": "image_generation_call",
                    "status": "completed",
                    "result": {
                        "description": response.text,
                        "note": "图像生成完成，但无法提取直接的图像数据"
                    },
                    "revised_prompt": prompt_text.strip()
                }
                image_generations.append(image_gen_result)

            # 构建OpenAI兼容的响应格式
            return {
                "id": f"gemini_img_{int(time.time() * 1000)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": image_model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "图像已生成完成。",
                        "image_generations": image_generations
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": len(prompt_text.split()),
                    "completion_tokens": 0,
                    "total_tokens": len(prompt_text.split())
                }
            }

        except Exception as e:
            logger.error(f"Google图像生成失败: {str(e)}")
            # 返回错误但保持OpenAI格式
            return {
                "id": f"gemini_img_error_{int(time.time() * 1000)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": f"图像生成失败: {str(e)}",
                        "image_generations": []
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0
                }
            }

    async def _google_stream_completion_websocket(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],
        api_key: str,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto",
        reasoning: str = "medium",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Google Gemini WebSocket流式响应"""
        try:
            genai.configure(api_key=api_key)

            logger.info(f"开始Google流式调用: {model}")

            # 转换消息格式和多模态内容
            history = []
            system_instruction = None

            # 处理系统消息
            for i, msg in enumerate(messages):
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")

                if role == "system":
                    system_instruction = content
                    continue
                elif i == len(messages) - 1:
                    # 最后一条消息单独处理
                    break
                elif role == "user":
                    # 处理多模态内容
                    parts = self._convert_message_to_gemini_parts(msg)
                    history.append({"role": "user", "parts": parts})
                elif role == "assistant":
                    history.append({"role": "model", "parts": [content]})

            # 配置生成参数
            generation_config = {
                "temperature": 0.7,
                "max_output_tokens": 8192,
            }

            # 处理thinking mode
            if thinking_mode and model.startswith("gemini-2.0"):
                generation_config["thinking_budget"] = self._get_thinking_budget(reasoning)

            # 转换工具
            gemini_tools = None
            if tools:
                gemini_tools = self._convert_tools_to_gemini_format(tools)

            # 创建模型实例
            model_instance = genai.GenerativeModel(
                model_name=model,
                generation_config=generation_config,
                system_instruction=system_instruction,
                tools=gemini_tools
            )

            # 处理最后一条用户消息
            last_message = messages[-1]
            user_parts = self._convert_message_to_gemini_parts(last_message)

            # 开始流式响应
            chat = model_instance.start_chat(history=history)
            response_stream = chat.send_message(user_parts, stream=True)

            accumulated_text = ""
            message_id = f"gemini_{int(time.time() * 1000)}"

            for chunk in response_stream:
                if chunk.text:
                    accumulated_text += chunk.text

                    # 生成流式响应块
                    yield {
                        "id": message_id,
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": model,
                        "choices": [{
                            "index": 0,
                            "delta": {
                                "content": chunk.text
                            },
                            "finish_reason": None
                        }]
                    }

            # 发送完成信号
            yield {
                "id": message_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop"
                }]
            }

        except Exception as e:
            logger.error(f"Google流式调用失败: {str(e)}")
            yield {"error": str(e)}

    async def _openai_compatible_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        stream: bool = False,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None,
        base_url: str = None
    ) -> Dict[str, Any]:
        """OpenAI 兼容 API 调用 (Chat Completions API)"""
        try:
            # 如果没有提供base_url，使用默认的OpenAI URL
            if not base_url:
                base_url = "https://api.openai.com/v1"
            
            client = openai.AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=self.default_timeout
            )
            
            logger.info(f"调用OpenAI兼容API模型: {model}, 消息数量: {len(messages)}, 基础URL: {base_url}")
            
            # 转换消息格式 - 只支持基本的文本消息格式
            converted_messages = []
            for msg in messages:
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")
                converted_messages.append({"role": role, "content": content})
            
            # 基础完成参数（OpenAI兼容提供商只支持纯文本对话）
            completion_params = {
                "model": model,
                "messages": converted_messages,
                "stream": stream,
                "temperature": 0.7,
                "max_tokens": 4000
            }
            
            response = await asyncio.wait_for(
                client.chat.completions.create(**completion_params),
                timeout=self.default_timeout
            )
            
            result = response.model_dump()
            logger.info(f"OpenAI兼容API调用成功，返回选择数量: {len(result.get('choices', []))}")
            return result
            
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI兼容API认证失败: {str(e)}")
            raise Exception("OpenAI兼容API密钥无效，请检查您的API密钥")
        except openai.RateLimitError as e:
            logger.error(f"OpenAI兼容API速率限制: {str(e)}")
            raise Exception("OpenAI兼容API请求频率过高，请稍后重试")
        except openai.InternalServerError as e:
            logger.error(f"OpenAI兼容API服务器错误: {str(e)}")
            raise Exception("OpenAI兼容API服务器暂时不可用，请稍后重试")
        except Exception as e:
            logger.error(f"OpenAI兼容API调用异常: {str(e)}")
            raise Exception(f"OpenAI兼容API调用失败: {str(e)}")

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
            elif provider == "anthropic":
                # Anthropic支持流式输出
                async for chunk in self._anthropic_stream_completion(model, messages, api_key, thinking_mode, reasoning_summaries, tools, use_native_search):
                    yield chunk
            elif provider == "google":
                # Google Gemini支持流式输出
                async for chunk in self._google_stream_completion_websocket(model, messages, api_key, thinking_mode, reasoning_summaries, reasoning, tools, use_native_search):
                    yield chunk
            elif provider == "openai_compatible":
                # OpenAI兼容提供商支持流式
                async for chunk in self._openai_compatible_stream_completion(model, messages, api_key, thinking_mode, reasoning_summaries, tools, use_native_search):
                    yield chunk
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
        """OpenAI流式完成 - 使用 Responses API"""
        try:
            client = openai.AsyncOpenAI(
                api_key=api_key,
                timeout=self.default_timeout
            )

            # 准备工具配置
            tools_config = self._prepare_tools_config(messages, tools, "openai")

            # 转换消息为 Responses API 格式
            input_messages = []
            instructions_text = ""

            for msg in messages:
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")

                if role == "system":
                    # system 消息转换为 instructions
                    instructions_text = content
                else:
                    # 其他消息添加到 input
                    input_messages.append({
                        "role": role,
                        "content": content
                    })

            # 构建 Responses API 参数
            stream_params = {
                "model": model,
                "input": input_messages,
                "stream": True
            }

            # 添加 instructions
            if instructions_text:
                stream_params["instructions"] = instructions_text

            # 添加工具配置 (传递原始字典而不是Pydantic模型)
            if tools_config["tools"]:
                # 转换工具配置为原始字典格式，避免Pydantic序列化警告
                stream_params["tools"] = [
                    tool if isinstance(tool, dict) else tool
                    for tool in tools_config["tools"]
                ]

            # GPT-5 系列模型不支持自定义 temperature，使用默认值 1
            if not self._is_gpt5_model(model):
                stream_params["temperature"] = 0.7

            # 使用 max_output_tokens（Responses API 的参数）
            stream_params["max_output_tokens"] = 4000

            # 使用 Responses API 进行流式调用
            stream = await client.responses.create(**stream_params)

            async for event in stream:
                # 转换 Responses API 事件为 Chat Completions 格式
                event_dict = event.model_dump() if hasattr(event, 'model_dump') else event
                event_type = event_dict.get('type', '')

                # 处理文本增量事件
                if event_type == 'response.output_text.delta':
                    yield {
                        'choices': [{
                            'delta': {
                                'content': event_dict.get('delta', '')
                            },
                            'index': 0,
                            'finish_reason': None
                        }]
                    }

                # 处理完成事件
                elif event_type == 'response.completed':
                    yield {
                        'choices': [{
                            'delta': {},
                            'index': 0,
                            'finish_reason': 'stop'
                        }]
                    }

                # 处理错误事件
                elif event_type == 'response.failed':
                    error_info = event_dict.get('response', {}).get('error', {})
                    yield {
                        'error': error_info.get('message', 'Unknown error')
                    }

                # 忽略但记录的事件（这些事件不需要发送给前端，但表示流仍在进行）
                elif event_type in [
                    'response.created',
                    'response.in_progress',
                    'response.output_item.added',
                    'response.output_item.done',
                    'response.content_part.added',
                    'response.content_part.done',
                    'response.output_text.done',
                    'response.web_search_call.in_progress',
                    'response.web_search_call.searching',
                    'response.web_search_call.completed',
                    'response.file_search_call.in_progress',
                    'response.file_search_call.searching',
                    'response.file_search_call.completed',
                    'response.mcp_list_tools.in_progress',
                    'response.mcp_list_tools.completed',
                    'response.mcp_call.in_progress',
                    'response.mcp_call_arguments.delta',
                    'response.mcp_call_arguments.done',
                    'response.mcp_call.completed',
                ]:
                    # 这些事件不需要转换，但我们需要继续循环
                    # 可以在这里添加日志记录
                    logger.debug(f"收到 Responses API 事件: {event_type}")
                    continue

                # 未知事件类型
                else:
                    logger.warning(f"未处理的 Responses API 事件类型: {event_type}")

        except Exception as e:
            logger.error(f"OpenAI流式调用失败: {str(e)}")
            yield {"error": str(e)}

    async def _openai_compatible_stream_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],  # Support both dict and Pydantic objects
        api_key: str,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None,
        base_url: str = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """OpenAI兼容流式完成"""
        try:
            # 如果没有提供base_url，使用默认的OpenAI URL
            if not base_url:
                base_url = "https://api.openai.com/v1"
                
            client = openai.AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=self.default_timeout
            )
            
            # 转换消息格式 - 只支持基本的文本消息格式
            converted_messages = []
            for msg in messages:
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")
                converted_messages.append({"role": role, "content": content})
            
            # 流式参数
            stream_params = {
                "model": model,
                "messages": converted_messages,
                "stream": True,
                "temperature": 0.7,
                "max_tokens": 4000
            }
            
            stream = await client.chat.completions.create(**stream_params)
            
            async for chunk in stream:
                yield chunk.model_dump()
                
        except Exception as e:
            logger.error(f"OpenAI兼容流式调用失败: {str(e)}")
            yield {"error": str(e)}

    async def _anthropic_stream_completion(
        self,
        model: str,
        messages: List[Union[Dict[str, str], Any]],
        api_key: str,
        thinking_mode: bool = False,
        reasoning_summaries: str = "auto",
        tools: List[Dict[str, Any]] = None,
        use_native_search: bool = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Anthropic流式完成，支持Extended Thinking、Vision、Citations等功能"""
        try:
            client = anthropic.AsyncAnthropic(
                api_key=api_key,
                timeout=self.default_timeout
            )
            
            logger.info(f"开始Anthropic流式调用: {model}, 扩展思考模式: {thinking_mode}")
            
            system_message = ""
            user_messages = []
            
            # 转换消息格式以支持多媒体内容
            for msg in messages:
                role = self._get_message_attr(msg, "role")
                content = self._get_message_attr(msg, "content")
                
                if role == "system":
                    system_message = content
                else:
                    # 转换为Anthropic Messages API格式
                    converted_msg = self._convert_message_to_anthropic_format(msg)
                    user_messages.append(converted_msg)
            
            # 构建流式请求参数
            stream_params = {
                "model": model,
                "max_tokens": 4000,
                "messages": user_messages,
                "temperature": 0.7
            }
            
            # 添加system消息（如果有）
            if system_message:
                stream_params["system"] = system_message
            
            # Extended Thinking支持
            if thinking_mode:
                stream_params["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": 10000  # 固定值
                }
                logger.info("启用Claude流式扩展思考模式，budget_tokens: 10000")
            
            # 工具配置（如果有）
            if tools:
                anthropic_tools = self._convert_tools_to_anthropic_format(tools)
                if anthropic_tools:
                    stream_params["tools"] = anthropic_tools
            
            # 检查是否使用了Files API，如果是则添加betas参数
            uses_files_api = self._check_uses_files_api(user_messages)
            if uses_files_api:
                stream_params["betas"] = ["files-api-2025-04-14"]
                logger.info("流式调用检测到Files API使用，已添加betas参数")
            
            # 创建流式响应
            content_text = ""
            thinking_content = ""
            message_id = None
            current_citations = []
            
            # 根据是否使用Files API选择正确的客户端方法
            stream_context = client.beta.messages.stream(**stream_params) if uses_files_api else client.messages.stream(**stream_params)
            
            async with stream_context as stream:
                async for event in stream:
                    try:
                        # 根据事件类型处理不同的流式数据
                        if hasattr(event, 'type'):
                            if event.type == "message_start":
                                # 消息开始
                                if hasattr(event, 'message') and hasattr(event.message, 'id'):
                                    message_id = event.message.id
                                
                                # 发送初始chunk
                                chunk = {
                                    "id": f"msg_{message_id or 'stream'}",
                                    "choices": [{
                                        "delta": {
                                            "role": "assistant",
                                            "content": ""
                                        },
                                        "index": 0,
                                        "finish_reason": None
                                    }]
                                }
                                yield chunk
                            
                            elif event.type == "content_block_start":
                                # 内容块开始 - 可能是text或thinking
                                if hasattr(event, 'content_block'):
                                    block_type = getattr(event.content_block, 'type', 'text')
                                    if block_type == "thinking" and thinking_mode:
                                        logger.debug("开始接收thinking内容")
                            
                            elif event.type == "content_block_delta":
                                # 内容增量
                                if hasattr(event, 'delta'):
                                    delta_type = getattr(event.delta, 'type', 'text_delta')
                                    
                                    if delta_type == "text_delta":
                                        # 文本增量
                                        text_delta = getattr(event.delta, 'text', '')
                                        content_text += text_delta
                                        
                                        chunk = {
                                            "id": f"msg_{message_id or 'stream'}",
                                            "choices": [{
                                                "delta": {
                                                    "content": text_delta
                                                },
                                                "index": 0,
                                                "finish_reason": None
                                            }]
                                        }
                                        yield chunk
                                    
                                    elif delta_type == "thinking_delta" and thinking_mode:
                                        # 思考增量
                                        thinking_delta = getattr(event.delta, 'content', '') or getattr(event.delta, 'thinking', '')
                                        thinking_content += thinking_delta
                                        
                                        # 思考内容作为reasoning字段发送
                                        chunk = {
                                            "id": f"msg_{message_id or 'stream'}",
                                            "choices": [{
                                                "delta": {
                                                    "reasoning": thinking_delta
                                                },
                                                "index": 0,
                                                "finish_reason": None
                                            }]
                                        }
                                        yield chunk
                                    
                                    elif delta_type == "citations_delta":
                                        # Citations增量
                                        if hasattr(event.delta, 'citation'):
                                            citation = {
                                                "type": getattr(event.delta.citation, 'type', 'unknown'),
                                                "cited_text": getattr(event.delta.citation, 'cited_text', ''),
                                                "source": getattr(event.delta.citation, 'source', ''),
                                                "title": getattr(event.delta.citation, 'title', ''),
                                                "document_index": getattr(event.delta.citation, 'document_index', 0)
                                            }
                                            current_citations.append(citation)
                            
                            elif event.type == "message_delta":
                                # 消息级别的增量，通常包含停止原因
                                if hasattr(event, 'delta') and hasattr(event.delta, 'stop_reason'):
                                    stop_reason = self._map_anthropic_stop_reason(event.delta.stop_reason)
                                    
                                    chunk = {
                                        "id": f"msg_{message_id or 'stream'}",
                                        "choices": [{
                                            "delta": {},
                                            "index": 0,
                                            "finish_reason": stop_reason
                                        }]
                                    }
                                    
                                    # 如果有citations，在最后的chunk中包含
                                    if current_citations:
                                        chunk["choices"][0]["delta"]["citations"] = current_citations
                                    
                                    yield chunk
                            
                            elif event.type == "message_stop":
                                # 消息结束
                                logger.info(f"Anthropic流式调用完成，总文本长度: {len(content_text)}, thinking长度: {len(thinking_content)}")
                                break
                    
                    except Exception as e:
                        logger.error(f"处理Anthropic流式事件时出错: {str(e)}")
                        continue
                        
        except anthropic.AuthenticationError as e:
            logger.error(f"Anthropic流式认证失败: {str(e)}")
            yield {"error": "Anthropic API密钥无效，请检查您的API密钥"}
        except anthropic.RateLimitError as e:
            logger.error(f"Anthropic流式速率限制: {str(e)}")
            yield {"error": "Anthropic API请求频率过高，请稍后重试"}
        except Exception as e:
            logger.error(f"Anthropic流式调用失败: {str(e)}")
            yield {"error": f"Anthropic流式调用失败: {str(e)}"}