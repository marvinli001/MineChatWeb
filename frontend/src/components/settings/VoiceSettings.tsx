'use client'

import { useSettingsStore } from '@/store/settingsStore'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function VoiceSettings() {
  const { settings, updateSettings } = useSettingsStore()

  const voiceProviders = [
    { id: 'openai', name: 'OpenAI Whisper/TTS' },
    { id: 'azure', name: 'Azure Speech Services' },
    { id: 'google', name: 'Google Cloud Speech' }
  ]

  const voiceOptions = {
    openai: [
      { id: 'alloy', name: 'Alloy (中性)' },
      { id: 'echo', name: 'Echo (男性)' },
      { id: 'fable', name: 'Fable (中性)' },
      { id: 'onyx', name: 'Onyx (男性)' },
      { id: 'nova', name: 'Nova (女性)' },
      { id: 'shimmer', name: 'Shimmer (女性)' }
    ],
    azure: [],
    google: []
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          语音设置
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          配置语音转文字和文字转语音功能。
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            语音提供商
          </label>
          <Select
            value={settings.voiceProvider || ''}
            onValueChange={(value) => updateSettings({ voiceProvider: value })}
          >
            <option value="">请选择提供商</option>
            {voiceProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </div>

        {settings.voiceProvider && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              语音类型
            </label>
            <Select
              value={settings.voiceModel || ''}
              onValueChange={(value) => updateSettings({ voiceModel: value })}
            >
              <option value="">请选择语音</option>
              {voiceOptions[settings.voiceProvider as keyof typeof voiceOptions]?.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            语音识别语言
          </label>
          <Select
            value={settings.language || 'zh-CN'}
            onValueChange={(value) => updateSettings({ language: value })}
          >
            <option value="zh-CN">中文（简体）</option>
            <option value="zh-TW">中文（繁体）</option>
            <option value="en-US">英语（美国）</option>
            <option value="ja-JP">日语</option>
            <option value="ko-KR">韩语</option>
          </Select>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          💡 使用提示
        </h4>
        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <li>• 点击输入框右侧的麦克风图标开始录音</li>
          <li>• 支持语音转文字和文字转语音功能</li>
          <li>• 需要先配置对应提供商的API密钥</li>
        </ul>
      </div>
    </div>
  )
}