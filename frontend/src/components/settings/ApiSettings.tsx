'use client'

import { useSettingsStore } from '@/store/settingsStore'
import { Input } from '@/components/ui/input'

export default function ApiSettings() {
  const { settings, updateSettings } = useSettingsStore()

  const providers = [
    { id: 'openai', name: 'OpenAI', description: 'ChatGPT, GPT-4, o1系列等模型（仅Responses API）' },
    { id: 'openai_compatible', name: 'OpenAI兼容', description: '自定义OpenAI兼容API（支持Chat Completions API）' },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude系列模型' },
    { id: 'google', name: 'Google', description: 'Gemini系列模型' },
    { id: 'azure', name: 'Azure OpenAI', description: '微软Azure OpenAI服务' },
    { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek模型' },
    { id: 'moonshot', name: 'Moonshot', description: 'Kimi模型' }
  ]

  const handleApiKeyChange = (provider: string, value: string) => {
    updateSettings({
      apiKeys: {
        ...settings.apiKeys,
        [provider]: value
      }
    })
  }

  const handleBaseUrlChange = (value: string) => {
    updateSettings({
      openaiCompatibleConfig: {
        ...settings.openaiCompatibleConfig,
        baseUrl: value
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          API密钥设置
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          请输入您的API密钥。所有密钥都保存在本地浏览器中，不会上传到服务器。
        </p>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {provider.name}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {provider.description}
            </p>
            
            {/* OpenAI兼容提供商的额外设置 */}
            {provider.id === 'openai_compatible' && (
              <div className="space-y-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    基础URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://api.openai.com/v1"
                    value={settings.openaiCompatibleConfig?.baseUrl || ''}
                    onChange={(e) => handleBaseUrlChange(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    设置OpenAI兼容API的基础URL
                  </p>
                </div>
              </div>
            )}
            
            <Input
              type="password"
              placeholder={`请输入${provider.name} API Key`}
              value={settings.apiKeys[provider.id] || ''}
              onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
              className="font-mono"
            />
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          ⚠️ 安全提示
        </h4>
        <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• API密钥仅保存在您的浏览器本地存储中</li>
          <li>• 请不要在公共设备上保存API密钥</li>
          <li>• 定期更换API密钥以确保安全</li>
          <li>• 如果怀疑密钥泄露，请立即在提供商处撤销</li>
        </ul>
      </div>
    </div>
  )
}