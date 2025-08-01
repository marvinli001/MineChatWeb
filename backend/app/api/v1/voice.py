from fastapi import APIRouter, HTTPException, File, UploadFile, Depends
from typing import Optional
import tempfile
import os
from app.services.voice_service import VoiceService
from app.core.security import get_current_user

router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    provider: str = "openai",
    api_key: str = "",
    current_user: dict = Depends(get_current_user)
):
    """
    语音转文字
    """
    try:
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        voice_service = VoiceService()
        transcript = await voice_service.transcribe(
            audio_file_path=temp_file_path,
            provider=provider,
            api_key=api_key
        )
        
        # 清理临时文件
        os.unlink(temp_file_path)
        
        return {"transcript": transcript}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/synthesize")
async def synthesize_speech(
    text: str,
    provider: str = "openai",
    voice: str = "alloy",
    api_key: str = "",
    current_user: dict = Depends(get_current_user)
):
    """
    文字转语音
    """
    try:
        voice_service = VoiceService()
        audio_data = await voice_service.synthesize(
            text=text,
            provider=provider,
            voice=voice,
            api_key=api_key
        )
        
        return {"audio_data": audio_data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/voices/{provider}")
async def get_available_voices(provider: str):
    """
    获取可用语音列表
    """
    voice_service = VoiceService()
    voices = voice_service.get_available_voices(provider)
    return {"voices": voices}