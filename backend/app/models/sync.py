from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CloudflareConfig(BaseModel):
    accountId: str
    apiToken: str
    databaseId: str

class SyncData(BaseModel):
    conversations: List[Dict[str, Any]]
    settings: Dict[str, Any]
    last_sync: str

class SyncUploadRequest(BaseModel):
    conversations: List[Dict[str, Any]]
    cloudflare_config: CloudflareConfig

class SyncDownloadRequest(BaseModel):
    cloudflare_config: CloudflareConfig

class TestConnectionRequest(BaseModel):
    account_id: str
    api_token: str
    database_id: str

class SyncResponse(BaseModel):
    success: bool
    message: str
    data: Optional[SyncData] = None
    conversations: Optional[List[Dict[str, Any]]] = None