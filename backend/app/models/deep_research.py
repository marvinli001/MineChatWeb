from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
from enum import Enum

class DeepResearchStatus(str, Enum):
    """深度研究任务状态枚举"""
    RUNNING = "running"
    WARNING = "warning"  # 需要用户澄清或提供更多信息
    COMPLETED = "completed"
    FAILED = "failed"

class DeepResearchFile(BaseModel):
    """深度研究附件文件模型"""
    name: str  # 保持与JavaScript File对象的name属性一致
    type: str  # MIME type，保持与JavaScript File对象的type属性一致
    size: int  # 保持与JavaScript File对象的size属性一致
    openai_file_id: Optional[str] = None
    vector_store_id: Optional[str] = None
    
    # 兼容字段
    @property
    def filename(self) -> str:
        return self.name

class DeepResearchTask(BaseModel):
    """深度研究任务模型"""
    id: str
    title: str
    query: str
    model: str
    status: DeepResearchStatus
    created_at: str  # ISO format datetime string
    result: Optional[str] = None
    files: Optional[List[DeepResearchFile]] = None
    # 用于存储OpenAI Response API的响应ID，用于后续查询状态
    openai_response_id: Optional[str] = None
    # 用于存储警告信息或需要澄清的问题
    warning_message: Optional[str] = None

class DeepResearchRequest(BaseModel):
    """创建深度研究任务的请求模型"""
    query: str = Field(..., description="研究问题或主题")
    model: str = Field(default="o3-deep-research", description="使用的深度研究模型")
    api_key: str = Field(..., description="OpenAI API密钥")
    files: Optional[List[DeepResearchFile]] = Field(None, description="附件文件列表")
    base_url: Optional[str] = Field(None, description="自定义OpenAI API基础URL")
    # 工具配置
    enable_web_search: bool = Field(default=True, description="启用网络搜索")
    enable_code_interpreter: bool = Field(default=True, description="启用代码解释器")
    vector_store_ids: Optional[List[str]] = Field(None, description="向量存储ID列表")
    max_tool_calls: Optional[int] = Field(None, description="最大工具调用次数")

class DeepResearchResponse(BaseModel):
    """深度研究任务响应模型"""
    task: DeepResearchTask
    message: str = "深度研究任务已创建并开始处理"

class DeepResearchListResponse(BaseModel):
    """深度研究任务列表响应模型"""
    tasks: List[DeepResearchTask]
    total: int

class DeepResearchStatusUpdate(BaseModel):
    """深度研究状态更新模型"""
    task_id: str
    status: DeepResearchStatus
    result: Optional[str] = None
    warning_message: Optional[str] = None

class DeepResearchClarificationRequest(BaseModel):
    """深度研究澄清问题请求模型"""
    query: str = Field(..., description="用户原始查询")
    api_key: str = Field(..., description="OpenAI API密钥")
    base_url: Optional[str] = Field(None, description="自定义OpenAI API基础URL")

class DeepResearchClarificationResponse(BaseModel):
    """深度研究澄清问题响应模型"""
    clarification_questions: List[str] = Field(..., description="需要澄清的问题列表")
    message: str = "请回答以下问题以获得更精准的研究结果"

class DeepResearchEnhanceRequest(BaseModel):
    """深度研究查询增强请求模型"""
    query: str = Field(..., description="用户原始查询")
    clarifications: Dict[str, str] = Field(..., description="用户对澄清问题的回答")
    api_key: str = Field(..., description="OpenAI API密钥")
    base_url: Optional[str] = Field(None, description="自定义OpenAI API基础URL")

class DeepResearchEnhanceResponse(BaseModel):
    """深度研究查询增强响应模型"""
    enhanced_query: str = Field(..., description="增强后的查询")
    message: str = "查询已优化，可用于深度研究"