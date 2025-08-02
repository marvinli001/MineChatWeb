from fastapi import APIRouter, HTTPException
from app.models.sync import (
    SyncUploadRequest, SyncDownloadRequest, TestConnectionRequest, 
    SyncResponse, SyncData
)
from app.services.d1_service import CloudflareD1Service
from datetime import datetime
import hashlib

router = APIRouter()

def generate_device_id() -> str:
    """生成设备唯一标识"""
    return hashlib.md5(f"device_{datetime.now().isoformat()}".encode()).hexdigest()

@router.post("/upload", response_model=SyncResponse)
async def sync_upload(request: SyncUploadRequest):
    """上传同步数据到Cloudflare D1"""
    try:
        config = request.cloudflare_config
        d1_service = CloudflareD1Service(
            account_id=config.accountId,
            database_id=config.databaseId,
            api_token=config.apiToken
        )
        
        await d1_service.init_tables()
        
        # 使用固定的device_id或生成一个
        device_id = "default_device"
        
        success = await d1_service.save_sync_data(
            device_id=device_id,
            conversations=request.conversations,
            settings={}  # 前端没有传settings，先用空对象
        )
        
        if success:
            return SyncResponse(
                success=True,
                message="数据同步成功",
                data=SyncData(
                    conversations=request.conversations,
                    settings={},
                    last_sync=datetime.now().isoformat()
                )
            )
        else:
            raise HTTPException(status_code=500, detail="数据保存失败")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步失败: {str(e)}")

@router.post("/download", response_model=SyncResponse)
async def sync_download(request: SyncDownloadRequest):
    """从Cloudflare D1下载同步数据"""
    try:
        config = request.cloudflare_config
        d1_service = CloudflareD1Service(
            account_id=config.accountId,
            database_id=config.databaseId,
            api_token=config.apiToken
        )
        
        device_id = "default_device"
        sync_data = await d1_service.get_sync_data(device_id)
        
        if sync_data:
            return SyncResponse(
                success=True,
                message="数据下载成功",
                conversations=sync_data["conversations"]
            )
        else:
            return SyncResponse(
                success=True,
                message="未找到云端数据",
                conversations=[]
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")

@router.post("/test")
async def test_connection(request: TestConnectionRequest):
    """测试Cloudflare D1连接"""
    try:
        d1_service = CloudflareD1Service(
            account_id=request.account_id,
            database_id=request.database_id,
            api_token=request.api_token
        )
        
        # 尝试初始化表来测试连接
        await d1_service.init_tables()
        
        return {
            "success": True,
            "message": "连接测试成功",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"连接测试失败: {str(e)}")

@router.delete("/clear")
async def clear_sync_data(request: SyncDownloadRequest):
    """清除云端同步数据"""
    try:
        config = request.cloudflare_config
        d1_service = CloudflareD1Service(
            account_id=config.accountId,
            database_id=config.databaseId,
            api_token=config.apiToken
        )
        
        device_id = "default_device"
        success = await d1_service.delete_sync_data(device_id)
        
        if success:
            return {"message": "云端数据清除成功"}
        else:
            raise HTTPException(status_code=500, detail="数据清除失败")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清除失败: {str(e)}")

@router.get("/status")
async def sync_status():
    """检查同步服务状态"""
    return {
        "status": "healthy",
        "message": "Cloudflare D1同步服务正常",
        "timestamp": datetime.now().isoformat()
    }