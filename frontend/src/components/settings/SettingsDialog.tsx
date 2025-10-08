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
    { id: 'api', name: 'API设置', mobileName: 'API' },
    { id: 'model', name: '模型设置', mobileName: '模型' },
    { id: 'voice', name: '语音设置', mobileName: '语音' },
    { id: 'sync', name: '云同步设置', mobileName: '云同步' }
  ]

  const handleSave = () => {
    saveSettings()
    onClose()
  }

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-white/30 dark:bg-black/30 flex items-center justify-center z-50">
      {/* 桌面端布局 */}
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden max-sm:hidden">
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
                  className={`w-full px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100/80 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50'
                  }`}
                >
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

      {/* 移动端布局 - 浮窗 */}
      <div className="hidden max-sm:flex max-sm:flex-col bg-white dark:bg-gray-800 rounded-t-2xl w-full max-h-[90vh] shadow-2xl" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        {/* 移动端头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 移动端标签页 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[80px] px-3 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {tab.mobileName}
            </button>
          ))}
        </div>

        {/* 移动端内容区 */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
          {activeTab === 'api' && <ApiSettings />}
          {activeTab === 'model' && <ModelSettings />}
          {activeTab === 'voice' && <VoiceSettings />}
          {activeTab === 'sync' && <CloudSyncSettings />}
        </div>

        {/* 移动端底部按钮 */}
        <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} className="flex-1">
            取消
          </Button>
          <Button onClick={handleSave} className="flex-1">
            保存设置
          </Button>
        </div>
      </div>
    </div>
  )
}