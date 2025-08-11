from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    provider: str
    model: str
    messages: List[ChatMessage]
    api_key: str
    stream: bool = False
    thinking_mode: bool = False

class Usage(BaseModel):
    prompt_tokens: Optional[int] = 0
    completion_tokens: Optional[int] = 0
    total_tokens: Optional[int] = 0
    # 添加更灵活的字段处理
    completion_tokens_details: Optional[Dict[str, Any]] = None
    prompt_tokens_details: Optional[Dict[str, Any]] = None
    
    class Config:
        extra = "allow"  # 允许额外字段

class Choice(BaseModel):
    message: Optional[Dict[str, Any]] = None
    finish_reason: Optional[str] = None
    index: Optional[int] = 0
    
    class Config:
        extra = "allow"  # 允许额外字段

class ChatResponse(BaseModel):
    id: Optional[str] = None
    choices: List[Choice] = []
    usage: Optional[Usage] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    
    class Config:
        extra = "allow"  # 允许额外字段，兼容不同AI提供商的响应格式