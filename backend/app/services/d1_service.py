import aiohttp
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.core.config import settings

class CloudflareD1Service:
    def __init__(self, account_id: str, database_id: str, api_token: str):
        self.account_id = account_id
        self.database_id = database_id
        self.api_token = api_token
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}"
        
    async def _execute_query(self, sql: str, params: List[Any] = None) -> Dict[str, Any]:
        """执行D1数据库查询"""
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        payload = {"sql": sql}
        if params:
            payload["params"] = params
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/query",
                headers=headers,
                json=payload
            ) as response:
                if response.status != 200:
                    raise Exception(f"D1 query failed: {await response.text()}")
                return await response.json()
    
    async def init_tables(self):
        """初始化数据库表"""
        chat_table_sql = """
        CREATE TABLE IF NOT EXISTS chat_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            conversations TEXT NOT NULL,
            settings TEXT NOT NULL,
            last_sync TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
        await self._execute_query(chat_table_sql)
        
        index_sql = "CREATE INDEX IF NOT EXISTS idx_device_id ON chat_data(device_id)"
        await self._execute_query(index_sql)
    
    async def save_sync_data(self, device_id: str, conversations: List[Dict], settings: Dict) -> bool:
        """保存同步数据"""
        try:
            conversations_json = json.dumps(conversations, ensure_ascii=False)
            settings_json = json.dumps(settings, ensure_ascii=False)
            current_time = datetime.now().isoformat()
            
            # 检查是否已存在该设备的数据
            check_sql = "SELECT id FROM chat_data WHERE device_id = ?"
            result = await self._execute_query(check_sql, [device_id])
            
            if result.get("result", []):
                # 更新现有数据
                update_sql = """
                UPDATE chat_data 
                SET conversations = ?, settings = ?, last_sync = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE device_id = ?
                """
                await self._execute_query(update_sql, [conversations_json, settings_json, current_time, device_id])
            else:
                # 插入新数据
                insert_sql = """
                INSERT INTO chat_data (device_id, conversations, settings, last_sync) 
                VALUES (?, ?, ?, ?)
                """
                await self._execute_query(insert_sql, [device_id, conversations_json, settings_json, current_time])
            
            return True
        except Exception as e:
            print(f"Save sync data error: {e}")
            return False
    
    async def get_sync_data(self, device_id: str) -> Optional[Dict[str, Any]]:
        """获取同步数据"""
        try:
            sql = "SELECT conversations, settings, last_sync FROM chat_data WHERE device_id = ? ORDER BY updated_at DESC LIMIT 1"
            result = await self._execute_query(sql, [device_id])
            
            data = result.get("result", [])
            if not data:
                return None
                
            row = data[0]
            return {
                "conversations": json.loads(row["conversations"]),
                "settings": json.loads(row["settings"]),
                "last_sync": row["last_sync"]
            }
        except Exception as e:
            print(f"Get sync data error: {e}")
            return None
    
    async def delete_sync_data(self, device_id: str) -> bool:
        """删除同步数据"""
        try:
            sql = "DELETE FROM chat_data WHERE device_id = ?"
            await self._execute_query(sql, [device_id])
            return True
        except Exception as e:
            print(f"Delete sync data error: {e}")
            return False