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
      
      {/* 模型市场浮窗 */}
      {showModelMarket && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/30 dark:bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">模型市场</h2>
              <button
                onClick={() => setShowModelMarket(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="text-gray-600 dark:text-gray-400 mb-6">
              <p>模型市场内容待实现...</p>
              <p className="text-sm mt-2">在这里你可以浏览和添加更多AI模型。</p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowModelMarket(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => setShowModelMarket(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}