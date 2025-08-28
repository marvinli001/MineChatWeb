from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # 基本设置
    app_name: str = "MineChatWeb"
    debug: bool = False
    
    # API Keys
    openai_api_key: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()

def get_settings() -> Settings:
    """获取应用设置"""
    return settings