from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # API Keys (will be set by users in frontend)
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    
    # Database
    database_url: str = "sqlite:///./chat.db"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Milvus
    milvus_host: str = "localhost"
    milvus_port: int = 19530
    
    class Config:
        env_file = ".env"

settings = Settings()