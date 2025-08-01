'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export default function ModelSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const [providers, setProviders] = useState<any[]>([])
  const [models, setModels] = useState<string[]>([])

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
      const response = await fetch('/api/v1/chat/providers')
      const data = await response.json()
      setProviders(data.providers)
    } catch (error) {
      console.error('获取提供商列表失败:', error)
    }
  }

  const fetchModels = async (provider: string) => {
    try {
      const response = await fetch(`/api/v1/chat/models/${provider}`)
      const data = await response.json()
      setModels(data.models)
    } catch (error) {
      console.error('获取模型列表失败:', error)
    }
  }

  const currentProvider = providers.find(p => p.id === settings.chatProvider)
  const supportsThinking = currentProvider?.supports_thinking || false

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
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
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
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* 思考模式 */}
        {supportsThinking && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="thinking-mode"
              checked={settings.thinkingMode || false}
              onChange={(e) => updateSettings({ thinkingMode: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="thinking-mode" className="text-sm text-gray-700 dark:text-gray-300">
              启用思考模式 (显示AI的推理过程)
            </label>
          </div>
        )}
      </div>

      {/* 语音模型设置 */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-white">语音模型</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              语音提供商
            </label>
            <Select
              value={settings.voiceProvider || ''}
              onValueChange={(value) => updateSettings({ voiceProvider: value })}
            >
              <option value="">请选择提供商</option>
              <option value="openai">OpenAI</option>
              <option value="azure">Azure Speech</option>
              <option value="google">Google Cloud</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              语音类型
            </label>
            <Select
              value={settings.voiceModel || ''}
              onValueChange={(value) => updateSettings({ voiceModel: value })}
              disabled={!settings.voiceProvider}
            >
              <option value="">请选择语音</option>
              <option value="alloy">Alloy (中性)</option>
              <option value="echo">Echo (男性)</option>
              <option value="fable">Fable (中性)</option>
              <option value="onyx">Onyx (男性)</option>
              <option value="nova">Nova (女性)</option>
              <option value="shimmer">Shimmer (女性)</option>
            </Select>
          </div>
        </div>
      </div>

      {/* 图片模型设置 */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-white">图片模型</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              图片提供商
            </label>
            <Select
              value={settings.imageProvider || ''}
              onValueChange={(value) => updateSettings({ imageProvider: value })}
            >
              <option value="">请选择提供商</option>
              <option value="openai">OpenAI DALL-E</option>
              <option value="midjourney">Midjourney</option>
              <option value="stability">Stability AI</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              图片模型
            </label>
            <Select
              value={settings.imageModel || ''}
              onValueChange={(value) => updateSettings({ imageModel: value })}
              disabled={!settings.imageProvider}
            >
              <option value="">请选择模型</option>
              <option value="dall-e-3">DALL-E 3</option>
              <option value="dall-e-2">DALL-E 2</option>
            </Select>
          </div>
        </div>
      </div>

      {/* 测试按钮 */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          disabled={!settings.chatProvider || !settings.chatModel}
          onClick={() => {
            // 测试对话模型
          }}
        >
          测试对话模型
        </Button>
        <Button
          variant="outline"
          disabled={!settings.voiceProvider}
          onClick={() => {
            // 测试语音模型
          }}
        >
          测试语音模型
        </Button>
      </div>
    </div>
  )
}