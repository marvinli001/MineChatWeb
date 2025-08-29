from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from typing import Optional, List, Dict, Any
import base64
import logging
import tempfile
import os
from pathlib import Path
import openai
from openai import OpenAI
import anthropic
from anthropic import Anthropic
import json

logger = logging.getLogger(__name__)

router = APIRouter()

# 支持的文件格式
SUPPORTED_FILE_FORMATS = {
    # 文档类
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'rtf': 'application/rtf',
    
    # 数据类
    'csv': 'text/csv',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'json': 'application/json',
    'xml': 'application/xml',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
    
    # 压缩类
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    # 代码类
    'js': 'text/javascript',
    'ts': 'application/typescript',
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'cpp': 'text/x-c++src',
    'c': 'text/x-csrc',
    'html': 'text/html',
    'css': 'text/css',
    'php': 'application/x-php',
    'sql': 'application/sql',
}

# 最大文件大小 (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

class FileProcessor:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
    
    async def process_file_direct(self, file_content: bytes, filename: str, mime_type: str) -> Dict[str, Any]:
        """直接读取模式 - 上传到Files API后返回file_id"""
        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
            
            try:
                # 上传到OpenAI Files API
                with open(temp_file_path, 'rb') as f:
                    file_response = self.client.files.create(
                        file=f,
                        purpose="user_data"
                    )
                
                return {
                    "openai_file_id": file_response.id,
                    "filename": filename,
                    "size": len(file_content),
                    "mime_type": mime_type,
                    "process_mode": "direct",
                    "status": "completed"
                }
            finally:
                # 清理临时文件
                os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"直接处理文件失败: {filename}, {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"直接处理文件失败: {str(e)}"
            )
    
    async def process_file_code_interpreter(self, file_content: bytes, filename: str, mime_type: str) -> Dict[str, Any]:
        """Code Interpreter模式 - 上传到Files API并准备容器"""
        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
            
            try:
                # 上传到OpenAI Files API
                with open(temp_file_path, 'rb') as f:
                    file_response = self.client.files.create(
                        file=f,
                        purpose="assistants"  # Code Interpreter需要assistants purpose
                    )
                
                # 注意：容器会在需要时自动创建，这里不预先创建
                return {
                    "openai_file_id": file_response.id,
                    "filename": filename,
                    "size": len(file_content),
                    "mime_type": mime_type,
                    "process_mode": "code_interpreter",
                    "status": "completed"
                }
            finally:
                # 清理临时文件
                os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"Code Interpreter处理文件失败: {filename}, {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Code Interpreter处理文件失败: {str(e)}"
            )
    
    async def process_file_search(self, file_content: bytes, filename: str, mime_type: str, vector_store_id: Optional[str] = None) -> Dict[str, Any]:
        """File Search模式 - 创建向量库并上传文件"""
        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
            
            try:
                # 上传到OpenAI Files API
                with open(temp_file_path, 'rb') as f:
                    file_response = self.client.files.create(
                        file=f,
                        purpose="assistants"  # File Search需要assistants purpose
                    )
                
                # 创建或使用现有的向量库
                if not vector_store_id:
                    vector_store = self.client.vector_stores.create(
                        name=f"vector_store_{filename}_{file_response.id[:8]}"
                    )
                    vector_store_id = vector_store.id
                
                # 将文件添加到向量库
                self.client.vector_stores.files.create(
                    vector_store_id=vector_store_id,
                    file_id=file_response.id
                )
                
                return {
                    "openai_file_id": file_response.id,
                    "vector_store_id": vector_store_id,
                    "filename": filename,
                    "size": len(file_content),
                    "mime_type": mime_type,
                    "process_mode": "file_search",
                    "status": "completed"
                }
            finally:
                # 清理临时文件
                os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"File Search处理文件失败: {filename}, {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"File Search处理文件失败: {str(e)}"
            )

class AnthropicFileProcessor:
    """Anthropic Files API处理器"""
    
    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)
    
    async def upload_file(self, file_content: bytes, filename: str, mime_type: str) -> Dict[str, Any]:
        """上传文件到Anthropic Files API"""
        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
            
            try:
                # 上传到Anthropic Files API
                with open(temp_file_path, 'rb') as f:
                    file_response = self.client.beta.files.upload(
                        file=(filename, f, mime_type)
                    )
                
                return {
                    "anthropic_file_id": file_response.id,
                    "filename": filename,
                    "size": len(file_content),
                    "mime_type": mime_type,
                    "provider": "anthropic",
                    "status": "completed"
                }
            finally:
                # 清理临时文件
                os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"Anthropic文件上传失败: {filename}, {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Anthropic文件上传失败: {str(e)}"
            )
    
    async def get_file_content(self, file_id: str) -> bytes:
        """获取文件内容"""
        try:
            file_content = self.client.beta.files.content(
                file_id=file_id
            )
            return file_content
        except Exception as e:
            logger.error(f"获取Anthropic文件内容失败: {file_id}, {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"获取Anthropic文件内容失败: {str(e)}"
            )
    
    async def delete_file(self, file_id: str) -> bool:
        """删除文件"""
        try:
            self.client.beta.files.delete(
                file_id=file_id
            )
            return True
        except Exception as e:
            logger.error(f"删除Anthropic文件失败: {file_id}, {str(e)}")
            return False

def get_file_extension(filename: str) -> str:
    """获取文件扩展名"""
    return Path(filename).suffix.lower().lstrip('.')

def determine_process_mode(filename: str, process_mode: Optional[str] = None) -> str:
    """确定文件处理模式"""
    if process_mode:
        return process_mode
    
    extension = get_file_extension(filename)
    
    # 只有 PDF 支持直读
    if extension == 'pdf':
        return 'direct'
    
    # 数据类文件 - 需要计算处理
    data_files = {'csv', 'xlsx', 'xls', 'json', 'xml', 'yaml', 'yml'}
    if extension in data_files:
        return 'code_interpreter'
    
    # 压缩包 - 通常需要解压和分析
    archive_files = {'zip', 'rar', '7z', 'tar', 'gz'}
    if extension in archive_files:
        return 'code_interpreter'
    
    # 代码文件 - 可能需要运行或分析
    code_files = {'py', 'js', 'ts', 'java', 'cpp', 'c', 'php', 'sql'}
    if extension in code_files:
        return 'code_interpreter'
    
    # md 文件优先使用 File Search
    if extension == 'md':
        return 'file_search'
    
    # 其他文档类文件默认使用 File Search
    doc_files = {'doc', 'docx', 'ppt', 'pptx', 'txt', 'rtf'}
    if extension in doc_files:
        return 'file_search'
    
    # 默认使用 File Search
    return 'file_search'

@router.post("/process")
async def process_file(
    request: Request,
    file: UploadFile = File(...),
    process_mode: Optional[str] = Form(None),
    vector_store_id: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    provider: Optional[str] = Form("openai")  # 新增provider参数
):
    """处理上传的文件
    
    Args:
        file: 上传的文件
        process_mode: 处理模式 (direct/code_interpreter/file_search) - 仅适用于OpenAI
        vector_store_id: 向量库ID (仅file_search模式需要) - 仅适用于OpenAI
        api_key: API密钥 (OpenAI或Anthropic)
        provider: 提供商 ("openai"或"anthropic")
    
    Returns:
        处理结果，包含file_id和相关信息
    """
    try:
        logger.info(f"收到文件处理请求: {file.filename}")
        
        # 验证文件
        if not file.filename:
            raise HTTPException(
                status_code=422,
                detail="文件名不能为空"
            )
        
        # 验证文件扩展名
        extension = get_file_extension(file.filename)
        if extension not in SUPPORTED_FILE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件格式: .{extension}"
            )
        
        # 读取文件内容
        file_content = await file.read()
        
        # 验证文件大小
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"文件大小超过限制: {len(file_content)} > {MAX_FILE_SIZE}"
            )
        
        # 确定处理模式
        final_process_mode = determine_process_mode(file.filename, process_mode)
        
        # 获取API密钥
        if not api_key:
            # 这里应该从环境变量或配置中获取
            # api_key = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
            raise HTTPException(
                status_code=400,
                detail=f"需要提供{provider.upper()} API密钥"
            )
        
        # 根据提供商处理文件
        if provider.lower() == "anthropic":
            # 使用Anthropic Files API
            processor = AnthropicFileProcessor(api_key)
            result = await processor.upload_file(
                file_content, 
                file.filename, 
                file.content_type or SUPPORTED_FILE_FORMATS.get(extension, 'application/octet-stream')
            )
        elif provider.lower() == "openai":
            # 使用OpenAI Files API
            processor = FileProcessor(api_key)
            
            # 根据处理模式处理文件
            if final_process_mode == "direct":
                result = await processor.process_file_direct(
                    file_content, file.filename, file.content_type or SUPPORTED_FILE_FORMATS.get(extension, 'application/octet-stream')
                )
            elif final_process_mode == "code_interpreter":
                result = await processor.process_file_code_interpreter(
                    file_content, file.filename, file.content_type or SUPPORTED_FILE_FORMATS.get(extension, 'application/octet-stream')
                )
            elif final_process_mode == "file_search":
                result = await processor.process_file_search(
                    file_content, file.filename, file.content_type or SUPPORTED_FILE_FORMATS.get(extension, 'application/octet-stream'),
                    vector_store_id
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"不支持的处理模式: {final_process_mode}"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的提供商: {provider}"
            )
        
        return {
            "code": 200,
            "message": "success",
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"处理文件时发生错误: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"处理文件时发生错误: {str(e)}"
        )

@router.get("/download")
async def download_file(
    file_id: str,
    filename: str = "download",
    container_id: Optional[str] = None,
    api_key: Optional[str] = None
):
    """下载文件
    
    Args:
        file_id: OpenAI文件ID或容器文件ID
        filename: 下载的文件名
        container_id: 容器ID (如果是从Code Interpreter容器下载)
        api_key: OpenAI API密钥
    
    Returns:
        文件内容
    """
    try:
        # 获取API密钥
        if not api_key:
            # api_key = os.getenv("OPENAI_API_KEY")
            raise HTTPException(
                status_code=400,
                detail="需要提供OpenAI API密钥"
            )
        
        client = OpenAI(api_key=api_key)
        
        if container_id:
            # 从Code Interpreter容器下载文件
            file_content = client.containers.files.content(
                container_id=container_id,
                file_id=file_id
            )
        else:
            # 从Files API下载文件
            file_content = client.files.content(file_id)
        
        # 直接返回文件内容
        from fastapi.responses import Response
        return Response(
            content=file_content.read(),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        logger.error(f"下载文件失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"下载文件失败: {str(e)}"
        )

@router.post("/download")
async def download_file_post(request_data: Dict[str, Any]):
    """POST方式下载文件 (用于复杂参数传递)"""
    return await download_file(
        file_id=request_data.get("file_id"),
        filename=request_data.get("filename", "download"),
        container_id=request_data.get("container_id"),
        api_key=request_data.get("api_key")
    )