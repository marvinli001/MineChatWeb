from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Form
from typing import List, Optional
import base64
import logging
from PIL import Image
import io
import anthropic
from anthropic import Anthropic
import tempfile
import os

logger = logging.getLogger(__name__)

router = APIRouter()

# 支持的图片格式和最大文件大小
SUPPORTED_FORMATS = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB

@router.post("/upload")
async def upload_images(
    request: Request, 
    files: List[UploadFile] = File(...),
    provider: Optional[str] = Form("openai"),
    api_key: Optional[str] = Form(None)
):
    """上传图片文件，支持OpenAI base64格式和Anthropic Files API
    
    接口契约:
    - 请求: multipart/form-data
    - 字段名: files (支持多个文件)
    - provider: 提供商 ("openai"使用base64, "anthropic"使用Files API)
    - api_key: Anthropic API密钥 (当provider=anthropic时必需)
    - 支持格式: JPG, PNG, WebP, GIF
    - 最大文件大小: 15MB
    
    响应格式:
    成功 (200): {"code": 200, "message": "success", "data": {"images": [...], "count": N}}
    失败 (4xx): {"code": 4xx, "message": "错误描述", "details": {...}}
    
    响应数据格式:
    - OpenAI: {"filename": str, "mime_type": str, "data": str(base64), "size": int, "provider": "openai"}
    - Anthropic: {"filename": str, "mime_type": str, "anthropic_file_id": str, "size": int, "provider": "anthropic"}
    """
    try:
        logger.info(f"收到图片上传请求，Content-Type: {request.headers.get('content-type')}")
        logger.info(f"文件数量: {len(files) if files else 0}")
        
        # 验证是否有文件
        if not files or len(files) == 0:
            logger.error("未收到任何文件")
            raise HTTPException(
                status_code=422,
                detail={
                    "code": 422,
                    "message": "未收到任何文件",
                    "details": {"field": "files", "issue": "empty_files"}
                }
            )
        
        # 验证Content-Type
        content_type = request.headers.get('content-type', '')
        if not content_type.startswith('multipart/form-data'):
            logger.error(f"错误的Content-Type: {content_type}")
            raise HTTPException(
                status_code=415,
                detail={
                    "code": 415,
                    "message": "请求必须是multipart/form-data格式",
                    "details": {"received": content_type, "expected": "multipart/form-data"}
                }
            )
    
        uploaded_images = []
        
        for i, file in enumerate(files):
            try:
                # 验证文件名
                if not file.filename:
                    logger.error(f"文件{i+1}缺少文件名")
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": 422,
                            "message": f"文件{i+1}缺少文件名",
                            "details": {"file_index": i, "field": "filename", "issue": "missing"}
                        }
                    )
                
                # 验证文件类型
                if not file.content_type or file.content_type not in SUPPORTED_FORMATS:
                    logger.error(f"不支持的文件类型: {file.content_type}")
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": 400,
                            "message": f"不支持的文件类型: {file.content_type}",
                            "details": {
                                "filename": file.filename,
                                "received_type": file.content_type,
                                "supported_types": list(SUPPORTED_FORMATS)
                            }
                        }
                    )
                
                # 读取文件内容
                content = await file.read()
                
                # 验证文件不为空
                if len(content) == 0:
                    logger.error(f"文件为空: {file.filename}")
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": 422,
                            "message": f"文件为空: {file.filename}",
                            "details": {"filename": file.filename, "issue": "empty_file"}
                        }
                    )
                
                # 验证文件大小
                if len(content) > MAX_FILE_SIZE:
                    logger.error(f"文件过大: {file.filename}, {len(content)} bytes > {MAX_FILE_SIZE} bytes")
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": 400,
                            "message": f"文件大小超过限制: {file.filename}",
                            "details": {
                                "filename": file.filename,
                                "file_size": len(content),
                                "max_size": MAX_FILE_SIZE,
                                "max_size_mb": MAX_FILE_SIZE // (1024*1024)
                            }
                        }
                    )
                
                # 验证图片格式（通过PIL）
                try:
                    image = Image.open(io.BytesIO(content))
                    image.verify()  # 验证图片完整性
                except Exception as e:
                    logger.error(f"图片格式验证失败: {file.filename}, {str(e)}")
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": 400,
                            "message": f"图片文件已损坏或格式不正确: {file.filename}",
                            "details": {"filename": file.filename, "error": str(e)}
                        }
                    )
                
                # 根据提供商处理图片
                if provider.lower() == "anthropic":
                    # 使用Anthropic Files API上传
                    if not api_key:
                        raise HTTPException(
                            status_code=400,
                            detail="使用Anthropic提供商需要提供API密钥"
                        )
                    
                    try:
                        # 创建临时文件并上传到Anthropic Files API
                        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as temp_file:
                            temp_file.write(content)
                            temp_file_path = temp_file.name
                        
                        try:
                            client = Anthropic(api_key=api_key)
                            with open(temp_file_path, 'rb') as f:
                                file_response = client.beta.files.upload(
                                    file=(file.filename, f, file.content_type)
                                )
                            
                            uploaded_images.append({
                                "filename": file.filename,
                                "mime_type": file.content_type,
                                "anthropic_file_id": file_response.id,
                                "size": len(content),
                                "provider": "anthropic"
                            })
                            
                            logger.info(f"成功上传图片到Anthropic Files API: {file.filename}, file_id: {file_response.id}")
                            
                        finally:
                            # 清理临时文件
                            os.unlink(temp_file_path)
                            
                    except Exception as e:
                        logger.error(f"Anthropic图片上传失败: {file.filename}, {str(e)}")
                        raise HTTPException(
                            status_code=500,
                            detail=f"Anthropic图片上传失败: {str(e)}"
                        )
                else:
                    # 传统的base64方式（OpenAI）
                    base64_data = base64.b64encode(content).decode('utf-8')
                    
                    uploaded_images.append({
                        "filename": file.filename,
                        "mime_type": file.content_type,
                        "data": base64_data,
                        "size": len(content),
                        "provider": "openai"
                    })
                    
                    logger.info(f"成功处理图片: {file.filename}, 大小: {len(content)} bytes")
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"处理图片时发生错误: {file.filename if file.filename else f'文件{i+1}'}, {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail={
                        "code": 500,
                        "message": f"处理图片时发生错误: {file.filename if file.filename else f'文件{i+1}'}",
                        "details": {"filename": file.filename, "error": str(e)}
                    }
                )
        
        return {
            "code": 200,
            "message": "success",
            "data": {
                "images": uploaded_images,
                "count": len(uploaded_images)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传处理异常: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": 500,
                "message": "服务器内部错误",
                "details": {"error": str(e)}
            }
        )

@router.post("/generate")
async def generate_image():
    """图片生成"""
    raise HTTPException(status_code=501, detail="图片生成功能待实现")

@router.post("/analyze")
async def analyze_image():
    """图片分析"""
    raise HTTPException(status_code=501, detail="图片分析功能待实现")