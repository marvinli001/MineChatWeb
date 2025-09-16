from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import json
import logging
import time
from app.models.chat import ChatMessage, ChatRequest, ChatResponse
from app.services.ai_providers import AIProviderService
from app.services.plugin_executor import PluginExecutor

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

async def _handle_function_calling(
    request_id: str,
    ai_service: AIProviderService,
    plugin_executor: PluginExecutor,
    request: ChatRequest,
    initial_response: Dict[str, Any]
) -> Dict[str, Any]:
    """处理function calling的完整流程"""
    max_iterations = 10  # 防止无限循环
    current_messages = list(request.messages)
    current_response = initial_response

    for iteration in range(max_iterations):
        choice = current_response["choices"][0]
        message = choice.get("message", {})
        tool_calls = message.get("tool_calls", [])

        if not tool_calls:
            # 没有tool calls，返回当前响应
            break

        logger.info(f"[{request_id}] 第 {iteration + 1} 轮function calling，执行 {len(tool_calls)} 个function calls")

        # 将assistant的消息（包含tool_calls）添加到消息历史
        assistant_message = {
            "role": "assistant",
            "content": message.get("content", ""),
            "tool_calls": tool_calls
        }
        current_messages.append(assistant_message)

        # 执行function calls
        function_results = []
        for tool_call in tool_calls:
            try:
                if tool_call.get("type") == "function":
                    function_info = tool_call.get("function", {})
                    function_name = function_info.get("name")
                    function_arguments = json.loads(function_info.get("arguments", "{}"))

                    logger.info(f"[{request_id}] 执行function: {function_name}")

                    # 执行function
                    result = await plugin_executor.execute_function_call(
                        function_name=function_name,
                        function_arguments=function_arguments
                    )

                    # 格式化结果
                    result_text = plugin_executor.format_tool_result_for_ai(result)

                    # 对于Responses API，需要使用特殊格式
                    if request.provider == "openai" and hasattr(ai_service, '_is_responses_api_model'):
                        # 检查是否为支持Responses API的模型
                        function_results.append({
                            "type": "function_call_output",
                            "call_id": tool_call.get("id"),
                            "output": result_text
                        })
                    else:
                        # 标准Chat Completions格式
                        function_results.append({
                            "role": "tool",
                            "content": result_text,
                            "tool_call_id": tool_call.get("id")
                        })

                else:
                    # 处理其他类型的tool calls（如MCP）
                    logger.warning(f"[{request_id}] 暂不支持的tool call类型: {tool_call.get('type')}")
                    error_msg = f"Error: Unsupported tool call type: {tool_call.get('type')}"

                    if request.provider == "openai" and hasattr(ai_service, '_is_responses_api_model'):
                        function_results.append({
                            "type": "function_call_output",
                            "call_id": tool_call.get("id"),
                            "output": error_msg
                        })
                    else:
                        function_results.append({
                            "role": "tool",
                            "content": error_msg,
                            "tool_call_id": tool_call.get("id")
                        })

            except Exception as e:
                logger.error(f"[{request_id}] 执行function call失败: {str(e)}")
                error_msg = f"Error executing function: {str(e)}"

                if request.provider == "openai" and hasattr(ai_service, '_is_responses_api_model'):
                    function_results.append({
                        "type": "function_call_output",
                        "call_id": tool_call.get("id", "unknown"),
                        "output": error_msg
                    })
                else:
                    function_results.append({
                        "role": "tool",
                        "content": error_msg,
                        "tool_call_id": tool_call.get("id", "unknown")
                    })

        # 将function结果添加到消息历史
        current_messages.extend(function_results)

        # 调用AI获取下一个响应
        try:
            current_response = await ai_service.get_completion(
                provider=request.provider,
                model=request.model,
                messages=current_messages,
                api_key=request.api_key,
                stream=False,  # Function calling不支持流模式
                thinking_mode=request.thinking_mode,
                reasoning_summaries=request.reasoning_summaries,
                reasoning=request.reasoning,
                tools=[tool.dict() for tool in request.tools] if request.tools else None,
                use_native_search=request.use_native_search,
                base_url=request.base_url
            )

            # 检查新响应是否还有tool_calls
            new_choice = current_response["choices"][0]
            new_message = new_choice.get("message", {})
            if not new_message.get("tool_calls") and new_choice.get("finish_reason") != "tool_calls":
                # 没有更多tool calls，结束循环
                break

        except Exception as e:
            logger.error(f"[{request_id}] Function calling后续调用失败: {str(e)}")
            break

    logger.info(f"[{request_id}] Function calling完成，共执行 {iteration + 1} 轮")
    return current_response

@router.post("/completion")
async def chat_completion(request: ChatRequest):
    """处理聊天完成请求，支持多种AI提供商"""
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"
    
    logger.info(f"[{request_id}] 收到聊天请求 - Provider: {request.provider}, Model: {request.model}")
    
    # 参数验证
    if not request.provider:
        logger.error(f"[{request_id}] 缺少provider参数")
        raise HTTPException(status_code=400, detail="缺少provider参数")
    
    if not request.model:
        logger.error(f"[{request_id}] 缺少model参数")
        raise HTTPException(status_code=400, detail="缺少model参数")
    
    if not request.api_key:
        logger.error(f"[{request_id}] 缺少api_key参数")
        raise HTTPException(status_code=400, detail="缺少API密钥")
    
    if not request.messages or len(request.messages) == 0:
        logger.error(f"[{request_id}] 消息列表为空")
        raise HTTPException(status_code=400, detail="消息列表不能为空")
    
    try:
        logger.info(f"[{request_id}] 开始调用AI服务...")
        ai_service = AIProviderService()
        plugin_executor = PluginExecutor()

        # 获取初始响应
        response = await ai_service.get_completion(
            provider=request.provider,
            model=request.model,
            messages=request.messages,
            api_key=request.api_key,
            stream=request.stream,
            thinking_mode=request.thinking_mode,
            reasoning_summaries=request.reasoning_summaries,
            reasoning=request.reasoning,
            tools=[tool.dict() for tool in request.tools] if request.tools else None,
            use_native_search=request.use_native_search,
            base_url=request.base_url
        )

        # 处理function calling（如果有）
        if request.tools and response.get("choices"):
            choice = response["choices"][0]
            message = choice.get("message", {})

            # 检查是否有tool_calls需要执行
            if message.get("tool_calls") or choice.get("finish_reason") == "tool_calls":
                logger.info(f"[{request_id}] 检测到function calls，开始处理...")
                response = await _handle_function_calling(
                    request_id, ai_service, plugin_executor, request, response
                )
        
        logger.info(f"[{request_id}] AI服务调用成功，耗时: {time.time() - start_time:.2f}秒")
        
        # 提取搜索相关信息（如果有）
        citations = []
        sources = []
        if request.tools and any(tool.type in ["web_search", "web_search_preview"] for tool in request.tools):
            try:
                citations = ai_service.web_search_service.extract_citations_from_response(response)
                sources = ai_service.web_search_service.extract_sources_from_response(response)
                logger.info(f"[{request_id}] 提取到 {len(citations)} 个引用，{len(sources)} 个来源")
            except Exception as e:
                logger.warning(f"[{request_id}] 提取搜索信息时出错: {e}")
        
        # 验证响应格式
        if not response:
            logger.error(f"[{request_id}] AI服务返回空响应")
            raise HTTPException(status_code=500, detail="AI服务返回空响应")
        
        if "choices" not in response:
            logger.error(f"[{request_id}] AI服务响应中缺少choices字段: {response}")
            raise HTTPException(status_code=500, detail="AI服务响应格式错误")
        
        # 清理和标准化响应数据，避免Pydantic验证问题
        cleaned_response = {
            "id": response.get("id", f"chatcmpl-{request_id}"),
            "choices": [],
            "usage": {},
            "model": request.model,
            "provider": request.provider
        }
        
        # 处理choices
        for choice in response.get("choices", []):
            message = choice.get("message", {})
            
            # 添加搜索相关信息到消息中
            if citations:
                message["citations"] = citations
            if sources:
                message["sources"] = sources
                
            cleaned_choice = {
                "message": message,
                "finish_reason": choice.get("finish_reason", "stop"),
                "index": choice.get("index", 0)
            }
            cleaned_response["choices"].append(cleaned_choice)
        
        # 处理usage，移除可能导致验证错误的字段
        usage = response.get("usage", {})
        cleaned_usage = {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0)
        }
        
        # 安全地添加details字段
        if "completion_tokens_details" in usage:
            cleaned_usage["completion_tokens_details"] = usage["completion_tokens_details"]
        if "prompt_tokens_details" in usage:
            cleaned_usage["prompt_tokens_details"] = usage["prompt_tokens_details"]
            
        cleaned_response["usage"] = cleaned_usage
        
        return cleaned_response
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        logger.error(f"[{request_id}] 处理聊天请求时发生错误: {str(e)}", exc_info=True)
        
        # 根据错误类型返回不同的错误信息
        error_message = str(e)
        if "API key" in error_message.lower():
            raise HTTPException(status_code=401, detail="API密钥无效或已过期")
        elif "quota" in error_message.lower() or "billing" in error_message.lower():
            raise HTTPException(status_code=429, detail="API配额已用完，请检查您的账户余额")
        elif "timeout" in error_message.lower():
            raise HTTPException(status_code=504, detail="请求超时，请稍后重试")
        elif "connection" in error_message.lower():
            raise HTTPException(status_code=503, detail="网络连接失败，请检查网络设置")
        else:
            raise HTTPException(status_code=500, detail=f"处理请求时发生错误: {error_message}")

@router.websocket("/stream")
async def websocket_chat(websocket: WebSocket):
    """WebSocket流式聊天"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            request_data = json.loads(data)
            
            # Handle heartbeat messages
            if request_data.get("type") == "heartbeat":
                logger.debug(f"收到心跳消息，时间戳: {request_data.get('timestamp')}")
                # Send heartbeat response
                await manager.send_personal_message(
                    json.dumps({
                        "type": "heartbeat", 
                        "timestamp": request_data.get("timestamp"),
                        "server_time": time.time() * 1000
                    }), 
                    websocket
                )
                continue
            
            logger.info(f"WebSocket收到请求: {request_data.get('provider', 'unknown')}")
            
            ai_service = AIProviderService()
            
            async for chunk in ai_service.stream_completion(
                provider=request_data["provider"],
                model=request_data["model"],
                messages=request_data["messages"],
                api_key=request_data["api_key"],
                thinking_mode=request_data.get("thinking_mode", False),
                reasoning_summaries=request_data.get("reasoning_summaries", "auto"),
                reasoning=request_data.get("reasoning", "medium"),
                tools=request_data.get("tools"),
                use_native_search=request_data.get("use_native_search")
            ):
                await manager.send_personal_message(
                    json.dumps(chunk), 
                    websocket
                )
                
    except WebSocketDisconnect:
        logger.info("WebSocket客户端断开连接")
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket处理错误: {str(e)}", exc_info=True)
        try:
            await manager.send_personal_message(
                json.dumps({"error": str(e)}), 
                websocket
            )
        except:
            pass
        manager.disconnect(websocket)