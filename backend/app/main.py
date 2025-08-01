from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from app.api.v1 import chat, auth, voice, image, sync
from app.core.config import settings

app = FastAPI(
    title="ChatGPT Clone API",
    description="A ChatGPT-like application with multiple AI providers",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(voice.router, prefix="/api/v1/voice", tags=["voice"])
app.include_router(image.router, prefix="/api/v1/image", tags=["image"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])

@app.get("/")
async def root():
    return {"message": "ChatGPT Clone API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )