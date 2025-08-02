'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatMain from '@/components/chat/ChatMain'
import SettingsDialog from '@/components/settings/SettingsDialog'
import { useSettingsStore } from '@/store/settingsStore'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showModelMarket, setShowModelMarket] = useState(false)
  const { initialized, initializeSettings } = useSettingsStore()

  useEffect(() => {
    if (!initialized) {
      initializeSettings()
    }
  }, [initialized, initializeSettings])

  const handleModelMarketClick = () => {
    setShowModelMarket(true)
    // TODO: 实现模型市场浮窗
    console.log('打开模型市场浮窗')
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 overflow-hidden">
      {/* 侧边栏 */}
      <div className="flex-shrink-0">
        <ChatSidebar 
          onSettingsClick={() => setShowSettings(true)}
          onLoginClick={() => setShowLogin(true)}
          onModelMarketClick={handleModelMarketClick}
        />
      </div>
      
      {/* 主聊天区域 */}
      <div className="flex-1 min-w-0">
        <ChatMain onModelMarketClick={handleModelMarketClick} />
      </div>
      
      {/* 设置对话框 */}
      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
      
      {/* 模型市场浮窗 - TODO: 实现 */}
      {showModelMarket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold mb-4">模型市场</h2>
            <p>模型市场内容待实现...</p>
            <button 
              onClick={() => setShowModelMarket(false)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}