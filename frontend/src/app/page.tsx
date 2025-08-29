'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatMain from '@/components/chat/ChatMain'
import SettingsDialog from '@/components/settings/SettingsDialog'
import ModelMarket from '@/components/ui/ModelMarket'
import DeepResearchPage from '@/components/deep-research/DeepResearchPage'
import { useSettingsStore } from '@/store/settingsStore'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showModelMarket, setShowModelMarket] = useState(false)
  const [currentView, setCurrentView] = useState<'chat' | 'deep-research'>('chat')
  const { initialized, initializeSettings } = useSettingsStore()

  useEffect(() => {
    if (!initialized) {
      initializeSettings()
    }
  }, [initialized, initializeSettings])

  const handleModelMarketClick = () => {
    setShowModelMarket(true)
  }

  const handleDeepResearchClick = () => {
    setCurrentView('deep-research')
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 overflow-hidden">
      {/* 桌面端侧边栏 - 移动端隐藏 */}
      <div className="flex-shrink-0 desktop-sidebar">
        <ChatSidebar 
          onSettingsClick={() => setShowSettings(true)}
          onLoginClick={() => setShowLogin(true)}
          onModelMarketClick={handleModelMarketClick}
          onDeepResearchClick={handleDeepResearchClick}
          onBackToChat={currentView === 'deep-research' ? () => setCurrentView('chat') : undefined}
        />
      </div>
      
      {/* 主内容区域 */}
      <div className="flex-1 min-w-0">
        {currentView === 'chat' ? (
          <ChatMain 
            onModelMarketClick={handleModelMarketClick}
            onSettingsClick={() => setShowSettings(true)}
            onLoginClick={() => setShowLogin(true)}
            onDeepResearchClick={handleDeepResearchClick}
          />
        ) : (
          <DeepResearchPage 
            onBackToChat={() => setCurrentView('chat')} 
            onSettingsClick={() => setShowSettings(true)}
            onLoginClick={() => setShowLogin(true)}
            onModelMarketClick={handleModelMarketClick}
          />
        )}
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