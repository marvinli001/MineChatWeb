from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any, Optional
import json
import asyncio
from app.models.chat import ChatMessage, ChatRequest, ChatResponse
from app.services.ai_providers import AIProviderService
from app.core.security import get_current_user

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

@router.post("/completion", response_model=ChatResponse)
async def chat_completion(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    处理聊天完成请求，支持多种AI提供商
    """
    try:
        ai_service = AIProviderService()
        
        # 根据用户设置选择AI提供商
        response = await ai_service.get_completion(
            provider=request.provider,
            model=request.model,
            messages=request.messages,
            api_key=request.api_key,
            stream=request.stream,
            thinking_mode=request.thinking_mode
        )
        
        return ChatResponse(
            id=response.get("id"),
            choices=response.get("choices", []),
            usage=response.get("usage", {}),
            model=request.model,
            provider=request.provider
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/stream")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket流式聊天
    """
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            request_data = json.loads(data)
            
            ai_service = AIProviderService()
            
            async for chunk in ai_service.stream_completion(
                provider=request_data["provider"],
                model=request_data["model"],
                messages=request_data["messages"],
                api_key=request_data["api_key"],
                thinking_mode=request_data.get("thinking_mode", False)
            ):
                await manager.send_personal_message(
                    json.dumps(chunk), 
                    websocket
                )
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        await manager.send_personal_message(
            json.dumps({"error": str(e)}), 
            websocket
        )
        manager.disconnect(websocket)

@router.get("/models/{provider}")
async def get_available_models(provider: str):
    """
    获取指定提供商的可用模型列表
    """
    ai_service = AIProviderService()
    models = ai_service.get_available_models(provider)
    return {"models": models}

@router.get("/providers")
async def get_supported_providers():
    """
    获取支持的AI提供商列表
    """
    return {
        "providers": [
            {
                "id": "openai",
                "name": "OpenAI",
                "models": [
                    "gpt-4o",
                    "gpt-4o-mini",
                    "gpt-4-turbo",
                    "gpt-3.5-turbo",
                    "o1-preview",
                    "o1-mini"
                ],
                "supports_thinking": True
            },
            {
                "id": "anthropic",
                "name": "Anthropic",
                "models": [
                    "claude-3-5-sonnet-20241022",
                    "claude-3-5-haiku-20241022",
                    "claude-3-opus-20240229"
                ],
                "supports_thinking": True
            },
            {
                "id": "google",
                "name": "Google",
                "models": [
                    "gemini-2.0-flash-exp",
                    "gemini-1.5-pro",
                    "gemini-1.5-flash"
                ],
                "supports_thinking": True
            }
        ]
    }