'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import ThinkingModeToggle from '@/components/ui/ThinkingModeToggle'
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

  // 检查是否为GPT-5系列模型
  const isGPT5Model = (model: string): boolean => {
    const gpt5Models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest']
    return gpt5Models.includes(model)
  }

  // 检查当前选择的模型是否支持thinking mode
  const currentModelSupportsThinking = (): boolean => {
    if (!settings.chatModel || !settings.chatProvider) return false
    
    // 对于OpenAI，只有GPT-5系列支持thinking mode
    if (settings.chatProvider === 'openai') {
      return isGPT5Model(settings.chatModel)
    }
    
    // 对于其他提供商，检查模型配置
    const currentModel = models[settings.chatModel]
    return currentModel?.supports_thinking || false
  }

  const showThinkingToggle = currentModelSupportsThinking()

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

        {/* GPT-5 Thinking模式切换 */}
        {showThinkingToggle && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-900 dark:text-white">
                  GPT-5 思考模式
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  启用深度推理和思维链，提供更详细的分析过程
                </p>
              </div>
              <ThinkingModeToggle
                enabled={settings.thinkingMode || false}
                onChange={(enabled) => updateSettings({ thinkingMode: enabled })}
              />
            </div>
          </div>
        )}
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