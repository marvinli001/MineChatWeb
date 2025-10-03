'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { modelConfigService, ProviderConfig, ModelConfig } from '@/services/modelConfigService'

export default function ModelSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({})
  const [models, setModels] = useState<Record<string, ModelConfig>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchProviders()
  }, [])

  useEffect(() => {
    if (settings.chatProvider) {
      fetchModels(settings.chatProvider)
    }
  }, [settings.chatProvider])

  const fetchProviders = async () => {
    try {
      setLoading(true)
      const providersData = await modelConfigService.getProviders()
      setProviders(providersData)
    } catch (error) {
      console.error('获取提供商列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchModels = async (provider: string) => {
    try {
      const modelsData = await modelConfigService.getProviderModels(provider)
      setModels(modelsData)
    } catch (error) {
      console.error('获取模型列表失败:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          模型设置
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          选择用于对话、语音和图片功能的AI模型。
        </p>
      </div>

      {/* 对话模型设置 */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-white">对话模型</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI提供商
            </label>
            <Select
              value={settings.chatProvider || ''}
              onValueChange={(value) => {
                updateSettings({ chatProvider: value, chatModel: '' })
                fetchModels(value)
              }}
            >
              <option value="">请选择提供商</option>
              {Object.entries(providers).map(([providerId, provider]) => (
                <option key={providerId} value={providerId}>
                  {provider.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型
            </label>
            <Select
              value={settings.chatModel || ''}
              onValueChange={(value) => updateSettings({ chatModel: value })}
              disabled={!settings.chatProvider}
            >
              <option value="">请选择模型</option>
              {Object.entries(models).map(([modelId, modelConfig]) => (
                <option key={modelId} value={modelId}>
                  {modelConfig.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* 刷新配置按钮 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          onClick={fetchProviders}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新模型配置'}
        </Button>
      </div>
    </div>
  )
}