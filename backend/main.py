from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api.v1 import chat, sync, voice, image

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

# Include all routers
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(voice.router, prefix="/api/v1/voice", tags=["voice"])
app.include_router(image.router, prefix="/api/v1/image", tags=["image"])

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
        reload=True
    )