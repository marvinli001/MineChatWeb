from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter()

@router.post("/transcribe")
async def voice_transcribe():
    """语音转文字"""
    raise HTTPException(status_code=501, detail="语音转文字功能待实现")

@router.post("/synthesize")
async def voice_synthesize():
    """文字转语音"""
    raise HTTPException(status_code=501, detail="文字转语音功能待实现")

@router.get("/voices/{provider}")
async def get_voices(provider: str):
    """获取语音列表"""
    return {"voices": []}