import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import time
import logging
from app.api.v1 import chat, sync, voice, image, file, deep_research

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MineChatWeb API",
    description="A ChatGPT-like application with Cloudflare D1 sync",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # 记录请求信息
    logger.info(f"请求开始: {request.method} {request.url.path}")
    
    response = await call_next(request)
    
    # 计算处理时间
    process_time = time.time() - start_time
    
    # 记录响应信息
    logger.info(f"请求完成: {request.method} {request.url.path} - 状态码: {response.status_code} - 耗时: {process_time:.2f}秒")
    
    return response

# Include all routers
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(voice.router, prefix="/api/v1/voice", tags=["voice"])
app.include_router(image.router, prefix="/api/v1/image", tags=["image"])
app.include_router(file.router, prefix="/api/v1/file", tags=["file"])
app.include_router(deep_research.router, prefix="/api/v1/deep-research", tags=["deep-research"])

@app.get("/")
async def root():
    return {"message": "MineChatWeb API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/docs")
async def docs_redirect():
    return {"message": "API documentation available at /docs"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )