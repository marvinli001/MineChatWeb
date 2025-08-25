from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import json
import logging
import time
from app.models.chat import ChatMessage, ChatRequest, ChatResponse
from app.services.ai_providers import AIProviderService

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
        
        response = await ai_service.get_completion(
            provider=request.provider,
            model=request.model,
            messages=request.messages,
            api_key=request.api_key,
            stream=request.stream,
            thinking_mode=request.thinking_mode,
            reasoning_summaries=request.reasoning_summaries
        )
        
        logger.info(f"[{request_id}] AI服务调用成功，耗时: {time.time() - start_time:.2f}秒")
        
        # 验证响应格式
        if not response:
            logger.error(f"[{request_id}] AI服务返回空响应")
            raise HTTPException(status_code=500, detail="AI服务返回空响应")
        
        if not response.get("choices"):
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
            cleaned_choice = {
                "message": choice.get("message", {}),
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
                reasoning_summaries=request_data.get("reasoning_summaries", "auto")
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