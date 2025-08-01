'use client'

import { useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { useChatStore } from '@/store/chatStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CloudIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function CloudSyncSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const { syncToCloud, syncFromCloud } = useChatStore()
  const [testing, setTesting] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)

  const handleTestConnection = async () => {
    if (!settings.cloudflareConfig.accountId || !settings.cloudflareConfig.apiToken || !settings.cloudflareConfig.databaseId) {
      toast.error('请先填写完整的Cloudflare配置信息')
      return
    }

    setTesting(true)
    try {
      const response = await fetch('/api/v1/sync/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account_id: settings.cloudflareConfig.accountId,
          api_token: settings.cloudflareConfig.apiToken,
          database_id: settings.cloudflareConfig.databaseId
        })
      })

      if (response.ok) {
        toast.success('连接测试成功！')
        updateSettings({ enableCloudSync: true })
      } else {
        const error = await response.json()
        toast.error(`连接测试失败: ${error.detail}`)
      }
    } catch (error) {
      toast.error('连接测试失败，请检查配置')
    } finally {
      setTesting(false)
    }
  }

  const handleSyncToCloud = async () => {
    try {
      await syncToCloud()
      setLastSyncTime(new Date().toLocaleString('zh-CN'))
      toast.success('同步到云端成功！')
    } catch (error: any) {
      toast.error(`同步失败: ${error.message}`)
    }
  }

  const handleSyncFromCloud = async () => {
    try {
      await syncFromCloud()
      setLastSyncTime(new Date().toLocaleString('zh-CN'))
      toast.success('从云端同步成功！')
    } catch (error: any) {
      toast.error(`同步失败: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Cloudflare D1 云同步设置
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          使用您自己的 Cloudflare D1 数据库来同步聊天历史，无需第三方账号。
        </p>
      </div>

      {/* Cloudflare配置 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Account ID
          </label>
          <Input
            placeholder="您的Cloudflare账户ID"
            value={settings.cloudflareConfig.accountId || ''}
            onChange={(e) => updateSettings({
              cloudflareConfig: {
                ...settings.cloudflareConfig,
                accountId: e.target.value
              }
            })}
          />
          <p className="text-xs text-gray-500 mt-1">
            在 Cloudflare 控制台右侧找到您的 Account ID
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Token
          </label>
          <Input
            type="password"
            placeholder="您的Cloudflare API Token"
            value={settings.cloudflareConfig.apiToken || ''}
            onChange={(e) => updateSettings({
              cloudflareConfig: {
                ...settings.cloudflareConfig,
                apiToken: e.target.value
              }
            })}
          />
          <p className="text-xs text-gray-500 mt-1">
            需要具有 D1:Edit 权限的 API Token
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Database ID
          </label>
          <Input
            placeholder="您的D1数据库ID"
            value={settings.cloudflareConfig.databaseId || ''}
            onChange={(e) => updateSettings({
              cloudflareConfig: {
                ...settings.cloudflareConfig,
                databaseId: e.target.value
              }
            })}
          />
          <p className="text-xs text-gray-500 mt-1">
            在 D1 数据库详情页面找到数据库 ID
          </p>
        </div>
      </div>

      {/* 连接状态 */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          {settings.enableCloudSync ? (
            <>
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
              <span className="text-green-700 dark:text-green-300 font-medium">已连接</span>
            </>
          ) : (
            <>
              <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" />
              <span className="text-yellow-700 dark:text-yellow-300 font-medium">未连接</span>
            </>
          )}
        </div>
        
        <div className="space-y-2">
          <Button
            onClick={handleTestConnection}
            disabled={testing}
            variant="outline"
            size="sm"
          >
            {testing ? '测试中...' : '测试连接'}
          </Button>
          
          {lastSyncTime && (
            <p className="text-xs text-gray-500">
              上次同步: {lastSyncTime}
            </p>
          )}
        </div>
      </div>

      {/* 同步操作 */}
      {settings.enableCloudSync && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">同步操作</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleSyncToCloud}
              className="flex items-center gap-2"
              variant="outline"
            >
              <CloudIcon className="w-4 h-4" />
              上传到云端
            </Button>
            
            <Button
              onClick={handleSyncFromCloud}
              className="flex items-center gap-2"
              variant="outline"
            >
              <CloudIcon className="w-4 h-4" />
              从云端下载
            </Button>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              🔄 自动同步
            </h5>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto-sync"
                checked={settings.autoSync || false}
                onChange={(e) => updateSettings({ autoSync: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="auto-sync" className="text-sm text-blue-700 dark:text-blue-300">
                启用自动同步（每次对话结束后自动上传）
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 设置指南 */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">🚀 快速设置指南</h4>
        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <li>1. 登录 <a href="https://dash.cloudflare.com/" target="_blank" className="text-blue-600 hover:underline">Cloudflare 控制台</a></li>
          <li>2. 创建一个新的 D1 数据库</li>
          <li>3. 在 "我的个人资料" → "API 令牌" 中创建具有 D1:Edit 权限的 API Token</li>
          <li>4. 复制 Account ID、API Token 和 Database ID 到上方表单</li>
          <li>5. 点击"测试连接"验证配置</li>
        </ol>
      </div>

      {/* 数据安全说明 */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          🔒 数据安全说明
        </h4>
        <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• 您的聊天数据存储在您自己的 Cloudflare D1 数据库中</li>
          <li>• API Token 仅保存在您的浏览器本地，不会上传到任何服务器</li>
          <li>• 所有数据传输均通过 HTTPS 加密</li>
          <li>• 您拥有数据的完全控制权</li>
        </ul>
      </div>
    </div>
  )
}