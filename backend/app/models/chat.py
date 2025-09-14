from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union

class ImageContent(BaseModel):
    type: str = "image"
    data: str  # base64 encoded image data
    mime_type: str  # image/jpeg, image/png, etc.

class FileContent(BaseModel):
    filename: str
    type: str  # MIME type
    size: int
    process_mode: str  # direct, code_interpreter, file_search
    openai_file_id: Optional[str] = None
    vector_store_id: Optional[str] = None
    status: str = "completed"

class ChatMessage(BaseModel):
    role: str
    content: str
    images: Optional[List[ImageContent]] = None
    files: Optional[List[FileContent]] = None

class ToolConfig(BaseModel):
    type: str
    # 原有搜索工具字段
    user_location: Optional[Dict[str, Any]] = None
    search_context_size: Optional[str] = None

    # OpenAI Function Calling 标准字段
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    strict: Optional[bool] = None

    # MCP 服务器配置字段
    server_url: Optional[str] = None
    server_name: Optional[str] = None

class ChatRequest(BaseModel):
    provider: str
    model: str
    messages: List[ChatMessage]
    api_key: str
    stream: bool = False
    thinking_mode: bool = False
    reasoning_summaries: str = "auto"
    reasoning: str = "medium"
    tools: Optional[List[ToolConfig]] = None
    use_native_search: Optional[bool] = None
    base_url: Optional[str] = None  # OpenAI兼容提供商的自定义base_url

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