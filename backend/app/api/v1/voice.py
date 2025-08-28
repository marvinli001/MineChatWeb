from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header, Request
from typing import Dict, Any, Optional
import tempfile
import os
from ...services.voice_service import VoiceService
from ...core.config import get_settings
import aiofiles

router = APIRouter()
voice_service = VoiceService()

@router.post("/transcribe")
async def voice_transcribe(
    request: Request,
    audio: UploadFile = File(..., description="音频文件"),
    model: Optional[str] = Form("gpt-4o-transcribe", description="转录模型"),
    language: Optional[str] = Form(None, description="音频语言代码"),
    prompt: Optional[str] = Form(None, description="优化提示词"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> Dict[str, Any]:
    """语音转文字"""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="未提供音频文件")
    
    # 检查文件类型
    allowed_types = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/mpeg']
    if audio.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的音频格式: {audio.content_type}"
        )
    
    # 检查文件大小 (25MB 限制)
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
    audio.file.seek(0, 2)  # 移动到文件末尾
    file_size = audio.file.tell()
    audio.file.seek(0)  # 重置文件指针
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"音频文件过大: {file_size / 1024 / 1024:.1f}MB, 最大支持25MB"
        )
    
    # 获取API密钥
    # 优先从请求头获取，其次从设置获取
    api_key = x_api_key
    if not api_key:
        settings = get_settings()
        api_key = settings.openai_api_key
        
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="未配置OpenAI API密钥，请在设置中配置或通过X-API-Key请求头传递"
        )
    
    # 创建临时文件
    temp_file = None
    try:
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
            # 将上传的文件内容写入临时文件
            content = await audio.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # 调用语音服务
        result = await voice_service.transcribe(
            audio_file_path=temp_file_path,
            provider="openai",
            api_key=api_key,
            model=model,
            language=language,
            prompt=prompt
        )
        
        return {
            "text": result,
            "model": model,
            "language": language
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "message": str(e),
                "type": "transcription_error"
            }
        )
    finally:
        # 清理临时文件
        if temp_file and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass

@router.post("/synthesize")
async def voice_synthesize():
    """文字转语音"""
    raise HTTPException(status_code=501, detail="文字转语音功能待实现")

@router.get("/voices/{provider}")
async def get_voices(provider: str) -> Dict[str, Any]:
    """获取语音列表"""
    try:
        voices = voice_service.get_available_voices(provider)
        return {
            "provider": provider,
            "voices": voices
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的提供商: {provider}"
        )

@router.get("/models")
async def get_transcription_models() -> Dict[str, Any]:
    """获取支持的转录模型"""
    models = [
        {
            "id": "gpt-4o-transcribe",
            "name": "GPT-4o Transcribe",
            "description": "高质量语音转文本模型",
            "supported_formats": ["json", "text"],
            "max_file_size": "25MB"
        },
        {
            "id": "gpt-4o-mini-transcribe",
            "name": "GPT-4o Mini Transcribe",
            "description": "快速语音转文本模型",
            "supported_formats": ["json", "text"],
            "max_file_size": "25MB"
        },
        {
            "id": "whisper-1",
            "name": "Whisper v1",
            "description": "经典Whisper模型",
            "supported_formats": ["json", "text", "srt", "verbose_json", "vtt"],
            "max_file_size": "25MB"
        }
    ]
    
    return {
        "models": models,
        "default_model": "gpt-4o-transcribe"
    }