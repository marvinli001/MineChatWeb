from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.post("/generate")
async def generate_image():
    """图片生成"""
    raise HTTPException(status_code=501, detail="图片生成功能待实现")

@router.post("/analyze")
async def analyze_image():
    """图片分析"""
    raise HTTPException(status_code=501, detail="图片分析功能待实现")