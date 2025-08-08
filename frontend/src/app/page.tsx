'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatMain from '@/components/chat/ChatMain'
import SettingsDialog from '@/components/settings/SettingsDialog'
import ModelMarket from '@/components/ui/ModelMarket'  // 添加这行
import { useSettingsStore } from '@/store/settingsStore'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showModelMarket, setShowModelMarket] = useState(false)  // 确保这行存在
  const { initialized, initializeSettings } = useSettingsStore()

  useEffect(() => {
    if (!initialized) {
      initializeSettings()
    }
  }, [initialized, initializeSettings])

  const handleModelMarketClick = () => {
    setShowModelMarket(true)
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
      
      {/* 模型市场弹窗 */}
      <ModelMarket 
        isOpen={showModelMarket}
        onClose={() => setShowModelMarket(false)}
      />
    </div>
  )
}