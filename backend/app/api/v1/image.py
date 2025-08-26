from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
import base64
import logging
from PIL import Image
import io

logger = logging.getLogger(__name__)

router = APIRouter()

# 支持的图片格式和最大文件大小
SUPPORTED_FORMATS = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB

@router.post("/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    """上传图片文件并转换为base64格式"""
    logger.info(f"收到图片上传请求，文件数量: {len(files)}")
    
    uploaded_images = []
    
    for file in files:
        try:
            # 验证文件类型
            if file.content_type not in SUPPORTED_FORMATS:
                logger.error(f"不支持的文件类型: {file.content_type}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"不支持的文件类型: {file.content_type}。支持的格式: jpg, png, webp, gif"
                )
            
            # 读取文件内容
            content = await file.read()
            
            # 验证文件大小
            if len(content) > MAX_FILE_SIZE:
                logger.error(f"文件过大: {len(content)} bytes > {MAX_FILE_SIZE} bytes")
                raise HTTPException(
                    status_code=400,
                    detail=f"文件大小超过限制 ({MAX_FILE_SIZE // (1024*1024)}MB)"
                )
            
            # 验证图片格式（通过PIL）
            try:
                image = Image.open(io.BytesIO(content))
                image.verify()  # 验证图片完整性
            except Exception as e:
                logger.error(f"图片格式验证失败: {str(e)}")
                raise HTTPException(
                    status_code=400,
                    detail="图片文件已损坏或格式不正确"
                )
            
            # 转换为base64
            base64_data = base64.b64encode(content).decode('utf-8')
            
            uploaded_images.append({
                "filename": file.filename,
                "mime_type": file.content_type,
                "data": base64_data,
                "size": len(content)
            })
            
            logger.info(f"成功处理图片: {file.filename}, 大小: {len(content)} bytes")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"处理图片时发生错误: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"处理图片时发生错误: {str(e)}"
            )
    
    return {
        "success": True,
        "images": uploaded_images,
        "count": len(uploaded_images)
    }

@router.post("/generate")
async def generate_image():
    """图片生成"""
    raise HTTPException(status_code=501, detail="图片生成功能待实现")

@router.post("/analyze")
async def analyze_image():
    """图片分析"""
    raise HTTPException(status_code=501, detail="图片分析功能待实现")