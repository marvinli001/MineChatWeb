from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 基本设置
    app_name: str = "MineChatWeb"
    debug: bool = False
    
    class Config:
        env_file = ".env"

settings = Settings()