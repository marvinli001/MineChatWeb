from fastapi import APIRouter, HTTPException, Query, UploadFile, File, WebSocket, WebSocketDisconnect
from typing import List, Optional, Dict
import logging
import time
from app.models.deep_research import (
    DeepResearchRequest,
    DeepResearchResponse,
    DeepResearchTask,
    DeepResearchListResponse,
    DeepResearchClarificationRequest,
    DeepResearchClarificationResponse,
    DeepResearchEnhanceRequest,
    DeepResearchEnhanceResponse,
    DeepResearchStatus
)
from app.services.deep_research_service import DeepResearchService

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# 创建深度研究服务实例
deep_research_service = DeepResearchService()

class DeepResearchConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.task_subscribers: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, task_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if task_id:
            if task_id not in self.task_subscribers:
                self.task_subscribers[task_id] = []
            self.task_subscribers[task_id].append(websocket)

    def disconnect(self, websocket: WebSocket, task_id: Optional[str] = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if task_id and task_id in self.task_subscribers:
            if websocket in self.task_subscribers[task_id]:
                self.task_subscribers[task_id].remove(websocket)
            if not self.task_subscribers[task_id]:
                del self.task_subscribers[task_id]

    async def send_task_update(self, task_id: str, message: str):
        if task_id in self.task_subscribers:
            disconnected = []
            for connection in self.task_subscribers[task_id]:
                try:
                    await connection.send_text(message)
                except:
                    disconnected.append(connection)
            
            # 清理断开的连接
            for conn in disconnected:
                self.disconnect(conn, task_id)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                disconnected.append(connection)
        
        # 清理断开的连接
        for conn in disconnected:
            self.disconnect(conn)

ws_manager = DeepResearchConnectionManager()

# 设置服务的WebSocket管理器
deep_research_service.set_websocket_manager(ws_manager)

@router.post("/tasks", response_model=DeepResearchResponse)
async def create_research_task(request: DeepResearchRequest):
    """
    创建深度研究任务
    
    这个接口会创建一个新的深度研究任务并在后台开始处理。
    任务将使用OpenAI的深度研究模型进行长时间的研究分析。
    """
    start_time = time.time()
    request_id = f"deep_research_{int(start_time * 1000)}"
    
    logger.info(f"[{request_id}] 收到深度研究请求 - Model: {request.model}, Query: {request.query[:100]}...")
    
    # 参数验证
    if not request.query.strip():
        logger.error(f"[{request_id}] 查询内容为空")
        raise HTTPException(status_code=400, detail="查询内容不能为空")
    
    if not request.api_key:
        logger.error(f"[{request_id}] 缺少API密钥")
        raise HTTPException(status_code=400, detail="缺少API密钥")
    
    if request.model not in ["o3-deep-research", "o4-mini-deep-research"]:
        logger.error(f"[{request_id}] 不支持的模型: {request.model}")
        raise HTTPException(status_code=400, detail="不支持的深度研究模型")
    
    try:
        # 创建研究任务
        task = await deep_research_service.create_research_task(request)
        
        logger.info(f"[{request_id}] 深度研究任务创建成功 - Task ID: {task.id}, 耗时: {time.time() - start_time:.2f}秒")
        
        return DeepResearchResponse(
            task=task,
            message="深度研究任务已创建并开始处理"
        )
        
    except Exception as e:
        logger.error(f"[{request_id}] 创建深度研究任务时发生错误: {str(e)}", exc_info=True)
        
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
            raise HTTPException(status_code=500, detail=f"创建深度研究任务时发生错误: {error_message}")

@router.get("/tasks", response_model=DeepResearchListResponse)
async def list_research_tasks(
    limit: int = Query(default=50, ge=1, le=100, description="返回任务数量限制"),
    offset: int = Query(default=0, ge=0, description="分页偏移量")
):
    """
    获取深度研究任务列表
    
    返回用户的深度研究任务列表，按创建时间倒序排列。
    """
    try:
        tasks = await deep_research_service.list_tasks(limit=limit, offset=offset)
        total = len(await deep_research_service.list_tasks(limit=1000))  # 获取总数
        
        logger.info(f"获取任务列表成功 - 返回 {len(tasks)} 个任务，总计 {total} 个")
        
        return DeepResearchListResponse(
            tasks=tasks,
            total=total
        )
        
    except Exception as e:
        logger.error(f"获取任务列表时发生错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取任务列表时发生错误: {str(e)}")

@router.get("/tasks/{task_id}", response_model=DeepResearchTask)
async def get_research_task(task_id: str):
    """
    获取单个深度研究任务详情
    
    根据任务ID获取深度研究任务的详细信息和当前状态。
    """
    try:
        task = await deep_research_service.get_task(task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            raise HTTPException(status_code=404, detail="任务不存在")
        
        logger.info(f"获取任务详情成功 - Task ID: {task_id}, Status: {task.status}")
        return task
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务详情时发生错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取任务详情时发生错误: {str(e)}")

@router.post("/tasks/{task_id}/stop")
async def stop_research_task(task_id: str):
    """
    停止深度研究任务
    
    停止正在运行的深度研究任务。只有状态为running或warning的任务可以被停止。
    """
    try:
        success = await deep_research_service.stop_task(task_id)
        if not success:
            task = await deep_research_service.get_task(task_id)
            if not task:
                logger.warning(f"任务不存在: {task_id}")
                raise HTTPException(status_code=404, detail="任务不存在")
            else:
                logger.warning(f"任务无法停止 - Task ID: {task_id}, Status: {task.status}")
                raise HTTPException(status_code=400, detail="任务无法停止，当前状态不支持停止操作")
        
        logger.info(f"任务停止成功 - Task ID: {task_id}")
        return {"message": "任务已停止", "task_id": task_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"停止任务时发生错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"停止任务时发生错误: {str(e)}")

@router.delete("/tasks/{task_id}")
async def delete_research_task(task_id: str):
    """
    删除深度研究任务
    
    删除指定的深度研究任务及其相关数据。
    """
    try:
        success = await deep_research_service.delete_task(task_id)
        if not success:
            logger.warning(f"任务不存在: {task_id}")
            raise HTTPException(status_code=404, detail="任务不存在")
        
        logger.info(f"任务删除成功 - Task ID: {task_id}")
        return {"message": "任务已删除", "task_id": task_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除任务时发生错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除任务时发生错误: {str(e)}")

@router.post("/clarification", response_model=DeepResearchClarificationResponse)
async def get_clarification_questions(request: DeepResearchClarificationRequest):
    """
    获取澄清问题
    
    使用小模型分析用户查询，生成有助于澄清研究需求的问题列表。
    这些问题可以帮助用户提供更详细的信息，从而获得更精准的研究结果。
    """
    start_time = time.time()
    request_id = f"clarification_{int(start_time * 1000)}"
    
    logger.info(f"[{request_id}] 收到澄清问题请求 - Query: {request.query[:100]}...")
    
    # 参数验证
    if not request.query.strip():
        logger.error(f"[{request_id}] 查询内容为空")
        raise HTTPException(status_code=400, detail="查询内容不能为空")
    
    if not request.api_key:
        logger.error(f"[{request_id}] 缺少API密钥")
        raise HTTPException(status_code=400, detail="缺少API密钥")
    
    try:
        # 生成澄清问题
        questions = await deep_research_service.create_clarification_questions(
            query=request.query,
            api_key=request.api_key,
            base_url=request.base_url
        )
        
        logger.info(f"[{request_id}] 澄清问题生成成功 - 生成 {len(questions)} 个问题，耗时: {time.time() - start_time:.2f}秒")
        
        return DeepResearchClarificationResponse(
            clarification_questions=questions,
            message="请回答以下问题以获得更精准的研究结果"
        )
        
    except Exception as e:
        logger.error(f"[{request_id}] 生成澄清问题时发生错误: {str(e)}", exc_info=True)
        
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
            raise HTTPException(status_code=500, detail=f"生成澄清问题时发生错误: {error_message}")

@router.post("/enhance", response_model=DeepResearchEnhanceResponse)
async def enhance_query(request: DeepResearchEnhanceRequest):
    """
    增强查询内容
    
    基于用户对澄清问题的回答，使用小模型生成增强后的查询内容。
    增强后的查询将包含更多具体信息，有助于深度研究模型提供更准确的结果。
    """
    start_time = time.time()
    request_id = f"enhance_{int(start_time * 1000)}"
    
    logger.info(f"[{request_id}] 收到查询增强请求 - Query: {request.query[:100]}...")
    
    # 参数验证
    if not request.query.strip():
        logger.error(f"[{request_id}] 查询内容为空")
        raise HTTPException(status_code=400, detail="查询内容不能为空")
    
    if not request.api_key:
        logger.error(f"[{request_id}] 缺少API密钥")
        raise HTTPException(status_code=400, detail="缺少API密钥")
    
    if not request.clarifications:
        logger.error(f"[{request_id}] 缺少澄清信息")
        raise HTTPException(status_code=400, detail="缺少澄清信息")
    
    try:
        # 增强查询
        enhanced_query = await deep_research_service.enhance_query(
            query=request.query,
            clarifications=request.clarifications,
            api_key=request.api_key,
            base_url=request.base_url
        )
        
        logger.info(f"[{request_id}] 查询增强成功，耗时: {time.time() - start_time:.2f}秒")
        
        return DeepResearchEnhanceResponse(
            enhanced_query=enhanced_query,
            message="查询已优化，可用于深度研究"
        )
        
    except Exception as e:
        logger.error(f"[{request_id}] 增强查询时发生错误: {str(e)}", exc_info=True)
        
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
            raise HTTPException(status_code=500, detail=f"增强查询时发生错误: {error_message}")

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    api_key: str = Query(..., description="OpenAI API密钥"),
    base_url: Optional[str] = Query(None, description="自定义OpenAI API基础URL")
):
    """
    上传文件并创建vector store
    
    上传文件到OpenAI并创建相应的vector store，用于深度研究任务。
    """
    start_time = time.time()
    request_id = f"upload_{int(start_time * 1000)}"
    
    logger.info(f"[{request_id}] 收到文件上传请求 - Filename: {file.filename}")
    
    # 参数验证
    if not api_key:
        logger.error(f"[{request_id}] 缺少API密钥")
        raise HTTPException(status_code=400, detail="缺少API密钥")
    
    if not file.filename:
        logger.error(f"[{request_id}] 文件名为空")
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    # 检查文件大小 (限制50MB)
    file_content = await file.read()
    if len(file_content) > 50 * 1024 * 1024:
        logger.error(f"[{request_id}] 文件过大: {len(file_content)} bytes")
        raise HTTPException(status_code=413, detail="文件大小不能超过50MB")
    
    try:
        # 上传文件并创建vector store
        file_id, vector_store_id = await deep_research_service.upload_file_and_create_vector_store(
            file_content=file_content,
            filename=file.filename,
            api_key=api_key,
            base_url=base_url
        )
        
        logger.info(f"[{request_id}] 文件上传成功 - File ID: {file_id}, Vector Store ID: {vector_store_id}, 耗时: {time.time() - start_time:.2f}秒")
        
        return {
            "name": file.filename,
            "type": file.content_type or "application/octet-stream",
            "size": len(file_content),
            "openai_file_id": file_id,
            "vector_store_id": vector_store_id,
            "message": "文件上传成功"
        }
        
    except Exception as e:
        logger.error(f"[{request_id}] 上传文件时发生错误: {str(e)}", exc_info=True)
        
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
            raise HTTPException(status_code=500, detail=f"上传文件时发生错误: {error_message}")

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """深度研究任务状态WebSocket端点"""
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # 处理订阅特定任务的请求
            if message_data.get("type") == "subscribe_task":
                task_id = message_data.get("task_id")
                if task_id:
                    if task_id not in ws_manager.task_subscribers:
                        ws_manager.task_subscribers[task_id] = []
                    if websocket not in ws_manager.task_subscribers[task_id]:
                        ws_manager.task_subscribers[task_id].append(websocket)
                    
                    await websocket.send_text(json.dumps({
                        "type": "subscribed",
                        "task_id": task_id,
                        "message": "已订阅任务状态更新"
                    }))
            
            # 处理心跳
            elif message_data.get("type") == "heartbeat":
                await websocket.send_text(json.dumps({
                    "type": "heartbeat_response",
                    "timestamp": time.time()
                }))
                
    except WebSocketDisconnect:
        logger.info("深度研究WebSocket客户端断开连接")
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"深度研究WebSocket处理错误: {str(e)}")
        ws_manager.disconnect(websocket)

@router.get("/health")
async def health_check():
    """深度研究服务健康检查"""
    return {"status": "healthy", "service": "deep_research"}