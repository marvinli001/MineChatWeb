from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import json
from app.models.chat import ChatMessage, ChatRequest, ChatResponse
from app.services.ai_providers import AIProviderService

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
async def chat_completion(request: ChatRequest):
    """处理聊天完成请求，支持多种AI提供商"""
    try:
        ai_service = AIProviderService()
        
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
    """WebSocket流式聊天"""
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