from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import httpx
import json
from datetime import datetime

router = APIRouter()

class CloudflareConfig(BaseModel):
    account_id: str
    api_token: str
    database_id: str

class SyncUploadRequest(BaseModel):
    conversations: List[Dict[str, Any]]
    cloudflare_config: CloudflareConfig

class SyncDownloadRequest(BaseModel):
    cloudflare_config: CloudflareConfig

class CloudflareD1Service:
    def __init__(self, config: CloudflareConfig):
        self.config = config
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{config.account_id}/d1/database/{config.database_id}"
        self.headers = {
            "Authorization": f"Bearer {config.api_token}",
            "Content-Type": "application/json"
        }

    async def init_tables(self):
        """初始化数据库表结构"""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            messages TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        """
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/query",
                headers=self.headers,
                json={"sql": create_table_sql}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to initialize database tables")

    async def upload_conversations(self, conversations: List[Dict[str, Any]]):
        """上传对话到D1数据库"""
        await self.init_tables()
        
        # 清空现有数据
        clear_sql = "DELETE FROM conversations;"
        
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/query",
                headers=self.headers,
                json={"sql": clear_sql}
            )
            
            # 插入新数据
            for conv in conversations:
                insert_sql = """
                INSERT OR REPLACE INTO conversations (id, title, messages, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?);
                """
                
                response = await client.post(
                    f"{self.base_url}/query",
                    headers=self.headers,
                    json={
                        "sql": insert_sql,
                        "params": [
                            conv["id"],
                            conv["title"],
                            json.dumps(conv["messages"]),
                            conv["created_at"],
                            conv["updated_at"]
                        ]
                    }
                )
                
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to upload conversation {conv['id']}")

    async def download_conversations(self) -> List[Dict[str, Any]]:
        """从D1数据库下载对话"""
        select_sql = "SELECT id, title, messages, created_at, updated_at FROM conversations ORDER BY updated_at DESC;"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/query",
                headers=self.headers,
                json={"sql": select_sql}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download conversations")
            
            data = response.json()
            conversations = []
            
            if data.get("success") and data.get("result"):
                for row in data["result"]:
                    conversations.append({
                        "id": row[0],
                        "title": row[1],
                        "messages": json.loads(row[2]) if row[2] else [],
                        "created_at": row[3],
                        "updated_at": row[4]
                    })
            
            return conversations

    async def test_connection(self):
        """测试连接"""
        test_sql = "SELECT 1 as test;"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/query",
                headers=self.headers,
                json={"sql": test_sql}
            )
            
            return response.status_code == 200

@router.post("/test")
async def test_cloudflare_connection(config: CloudflareConfig):
    """测试Cloudflare D1连接"""
    try:
        service = CloudflareD1Service(config)
        success = await service.test_connection()
        
        if success:
            return {"message": "Connection successful"}
        else:
            raise HTTPException(status_code=400, detail="Connection failed")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload")
async def upload_to_cloudflare(request: SyncUploadRequest):
    """上传对话历史到Cloudflare D1"""
    try:
        service = CloudflareD1Service(request.cloudflare_config)
        await service.upload_conversations(request.conversations)
        
        return {
            "message": "Upload successful",
            "count": len(request.conversations),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/download")
async def download_from_cloudflare(request: SyncDownloadRequest):
    """从Cloudflare D1下载对话历史"""
    try:
        service = CloudflareD1Service(request.cloudflare_config)
        conversations = await service.download_conversations()
        
        return {
            "conversations": conversations,
            "count": len(conversations),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))