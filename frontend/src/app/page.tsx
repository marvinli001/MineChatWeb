'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatMain from '@/components/chat/ChatMain'
import SettingsDialog from '@/components/settings/SettingsDialog'
import ModelMarket from '@/components/ui/ModelMarket'
import PluginMarket from '@/components/ui/PluginMarket'
import DeepResearchPage from '@/components/deep-research/DeepResearchPage'
import { useSettingsStore } from '@/store/settingsStore'
import { useChatStore } from '@/store/chatStore'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showModelMarket, setShowModelMarket] = useState(false)
  const [showPluginMarket, setShowPluginMarket] = useState(false)
  const [currentView, setCurrentView] = useState<'chat' | 'deep-research'>('chat')
  const { initialized, initializeSettings, settings } = useSettingsStore()
  const prewarmWebSocket = useChatStore(state => state._prewarmWebSocket)

  useEffect(() => {
    if (!initialized) {
      initializeSettings()
    }
  }, [initialized, initializeSettings])

  // 页面加载后预热 WebSocket 连接
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[App] 触发 WebSocket 预热')
      prewarmWebSocket()
    }, 1000) // 延迟1秒,让页面先渲染

    return () => clearTimeout(timer)
  }, [prewarmWebSocket])

  const handleModelMarketClick = () => {
    setShowModelMarket(true)
  }

  const handlePluginMarketClick = () => {
    // 只有支持插件市场的提供商才能打开
    const supportedProviders = ['openai', 'anthropic']
    if (supportedProviders.includes(settings.chatProvider)) {
      setShowPluginMarket(true)
    } else {
      // 可以显示提示信息
      console.warn(`插件市场暂不支持提供商: ${settings.chatProvider}`)
    }
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
          onPluginMarketClick={handlePluginMarketClick}
          onDeepResearchClick={handleDeepResearchClick}
          onBackToChat={currentView === 'deep-research' ? () => setCurrentView('chat') : undefined}
        />
      </div>
      
      {/* 主内容区域 */}
      <div className="flex-1 min-w-0">
        {currentView === 'chat' ? (
          <ChatMain
            onModelMarketClick={handleModelMarketClick}
            onPluginMarketClick={handlePluginMarketClick}
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
            onPluginMarketClick={handlePluginMarketClick}
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
      
      {/* 插件市场弹窗 */}
      <PluginMarket
        isOpen={showPluginMarket}
        onClose={() => setShowPluginMarket(false)}
        currentProvider={settings.chatProvider}
      />
    </div>
  )
}