from fastapi import APIRouter, HTTPException, Header
from app.models.sync import SyncRequest, SyncResponse, SyncData
from app.services.d1_service import CloudflareD1Service
from datetime import datetime
from typing import Optional

router = APIRouter()

@router.post("/upload", response_model=SyncResponse)
async def sync_upload(
    sync_request: SyncRequest,
    cloudflare_account_id: Optional[str] = Header(None, alias="x-cloudflare-account-id"),
    cloudflare_database_id: Optional[str] = Header(None, alias="x-cloudflare-database-id"),
    cloudflare_api_token: Optional[str] = Header(None, alias="x-cloudflare-api-token")
):
    """上传同步数据到Cloudflare D1"""
    try:
        if not all([cloudflare_account_id, cloudflare_database_id, cloudflare_api_token]):
            raise HTTPException(status_code=400, detail="缺少Cloudflare配置信息")
        
        d1_service = CloudflareD1Service(
            account_id=cloudflare_account_id,
            database_id=cloudflare_database_id,
            api_token=cloudflare_api_token
        )
        
        await d1_service.init_tables()
        
        success = await d1_service.save_sync_data(
            device_id=sync_request.device_id,
            conversations=sync_request.conversations,
            settings=sync_request.settings
        )
        
        if success:
            return SyncResponse(
                success=True,
                message="数据同步成功",
                data=SyncData(
                    conversations=sync_request.conversations,
                    settings=sync_request.settings,
                    last_sync=datetime.now().isoformat()
                )
            )
        else:
            raise HTTPException(status_code=500, detail="数据保存失败")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步失败: {str(e)}")

@router.get("/download/{device_id}", response_model=SyncResponse)
async def sync_download(
    device_id: str,
    cloudflare_account_id: Optional[str] = Header(None, alias="x-cloudflare-account-id"),
    cloudflare_database_id: Optional[str] = Header(None, alias="x-cloudflare-database-id"),
    cloudflare_api_token: Optional[str] = Header(None, alias="x-cloudflare-api-token")
):
    """从Cloudflare D1下载同步数据"""
    try:
        if not all([cloudflare_account_id, cloudflare_database_id, cloudflare_api_token]):
            raise HTTPException(status_code=400, detail="缺少Cloudflare配置信息")
        
        d1_service = CloudflareD1Service(
            account_id=cloudflare_account_id,
            database_id=cloudflare_database_id,
            api_token=cloudflare_api_token
        )
        
        sync_data = await d1_service.get_sync_data(device_id)
        
        if sync_data:
            return SyncResponse(
                success=True,
                message="数据下载成功",
                data=SyncData(**sync_data)
            )
        else:
            return SyncResponse(
                success=True,
                message="未找到云端数据",
                data=SyncData(
                    conversations=[],
                    settings={},
                    last_sync=datetime.now().isoformat()
                )
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")

@router.delete("/clear/{device_id}")
async def clear_sync_data(
    device_id: str,
    cloudflare_account_id: Optional[str] = Header(None, alias="x-cloudflare-account-id"),
    cloudflare_database_id: Optional[str] = Header(None, alias="x-cloudflare-database-id"),
    cloudflare_api_token: Optional[str] = Header(None, alias="x-cloudflare-api-token")
):
    """清除云端同步数据"""
    try:
        if not all([cloudflare_account_id, cloudflare_database_id, cloudflare_api_token]):
            raise HTTPException(status_code=400, detail="缺少Cloudflare配置信息")
        
        d1_service = CloudflareD1Service(
            account_id=cloudflare_account_id,
            database_id=cloudflare_database_id,
            api_token=cloudflare_api_token
        )
        
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