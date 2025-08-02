'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useSettingsStore } from '@/store/settingsStore'
import ApiSettings from './ApiSettings'
import ModelSettings from './ModelSettings'
import VoiceSettings from './VoiceSettings'
import CloudSyncSettings from './CloudSyncSettings'
import { Button } from '@/components/ui/button'

interface SettingsDialogProps {
  onClose: () => void
}

export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('api')
  const { saveSettings } = useSettingsStore()

  const tabs = [
    { id: 'api', name: 'API设置', icon: '🔑' },
    { id: 'model', name: '模型设置', icon: '🤖' },
    { id: 'voice', name: '语音设置', icon: '🎵' },
    { id: 'sync', name: '云同步设置', icon: '☁️' }
  ]

  const handleSave = () => {
    saveSettings()
    onClose()
  }

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-white/30 dark:bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-[60vh]">
          {/* 侧边栏 */}
          <div className="w-64 border-r border-gray-200/50 dark:border-gray-700/50 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100/80 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* 主内容区 */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'api' && <ApiSettings />}
            {activeTab === 'model' && <ModelSettings />}
            {activeTab === 'voice' && <VoiceSettings />}
            {activeTab === 'sync' && <CloudSyncSettings />}
          </div>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200/50 dark:border-gray-700/50">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </div>
    </div>
  )
}