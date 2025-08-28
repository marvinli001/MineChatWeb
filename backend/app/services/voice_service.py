import openai
import httpx
from typing import List, Dict, Any
import base64

class VoiceService:
    def __init__(self):
        self.providers = {
            "openai": self._openai_voice,
            "azure": self._azure_voice,
            "google": self._google_voice
        }

    async def transcribe(
        self,
        audio_file_path: str,
        provider: str,
        api_key: str,
        model: str = "gpt-4o-transcribe",
        language: str = None,
        prompt: str = None
    ) -> str:
        """
        语音转文字
        """
        if provider == "openai":
            return await self._openai_transcribe(
                audio_file_path, 
                api_key, 
                model, 
                language, 
                prompt
            )
        elif provider == "azure":
            return await self._azure_transcribe(audio_file_path, api_key, language)
        elif provider == "google":
            return await self._google_transcribe(audio_file_path, api_key, language)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    async def synthesize(
        self,
        text: str,
        provider: str,
        voice: str,
        api_key: str
    ) -> str:
        """
        文字转语音，返回base64编码的音频数据
        """
        if provider == "openai":
            return await self._openai_synthesize(text, voice, api_key)
        elif provider == "azure":
            return await self._azure_synthesize(text, voice, api_key)
        elif provider == "google":
            return await self._google_synthesize(text, voice, api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    async def _openai_transcribe(
        self,
        audio_file_path: str,
        api_key: str,
        model: str = "gpt-4o-transcribe",
        language: str = None,
        prompt: str = None
    ) -> str:
        """
        OpenAI 语音转文本API
        支持 whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe
        """
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # 准备请求参数
        params = {
            "model": model,
            "response_format": "text"  # 直接返回文本格式
        }
        
        # 添加可选参数
        if language:
            params["language"] = language
            
        if prompt:
            params["prompt"] = prompt
        
        try:
            with open(audio_file_path, "rb") as audio_file:
                transcript = await client.audio.transcriptions.create(
                    file=audio_file,
                    **params
                )
            
            # 对于不同的response_format，处理返回值
            if hasattr(transcript, 'text'):
                return transcript.text
            else:
                # 如果是text格式，直接返回字符串
                return str(transcript)
                
        except Exception as e:
            # 记录详细错误信息
            error_msg = f"OpenAI转录失败: {str(e)}"
            if "invalid_request_error" in str(e).lower():
                if "model" in str(e).lower():
                    error_msg = f"不支持的模型: {model}"
                elif "file" in str(e).lower():
                    error_msg = "音频文件格式不支持或文件损坏"
            elif "rate_limit" in str(e).lower():
                error_msg = "API调用频率限制，请稍后重试"
            elif "insufficient_quota" in str(e).lower():
                error_msg = "API配额不足，请检查账户余额"
                
            raise Exception(error_msg)

    async def _openai_synthesize(
        self,
        text: str,
        voice: str,
        api_key: str
    ) -> str:
        """
        OpenAI TTS API合成
        """
        client = openai.AsyncOpenAI(api_key=api_key)
        
        response = await client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text
        )
        
        audio_data = response.content
        return base64.b64encode(audio_data).decode()

    async def _azure_transcribe(self, audio_file_path: str, api_key: str, language: str) -> str:
        # Azure Speech Services实现
        pass

    async def _azure_synthesize(self, text: str, voice: str, api_key: str) -> str:
        # Azure Speech Services实现
        pass

    async def _google_transcribe(self, audio_file_path: str, api_key: str, language: str) -> str:
        # Google Cloud Speech-to-Text实现
        pass

    async def _google_synthesize(self, text: str, voice: str, api_key: str) -> str:
        # Google Cloud Text-to-Speech实现
        pass

    def get_available_voices(self, provider: str) -> List[Dict[str, Any]]:
        """
        获取可用语音列表
        """
        voices_map = {
            "openai": [
                {"id": "alloy", "name": "Alloy", "gender": "neutral"},
                {"id": "echo", "name": "Echo", "gender": "male"},
                {"id": "fable", "name": "Fable", "gender": "neutral"},
                {"id": "onyx", "name": "Onyx", "gender": "male"},
                {"id": "nova", "name": "Nova", "gender": "female"},
                {"id": "shimmer", "name": "Shimmer", "gender": "female"}
            ]
        }
        return voices_map.get(provider, [])