'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatMain from '@/components/chat/ChatMain'
import SettingsDialog from '@/components/settings/SettingsDialog'
import LoginForm from '@/components/auth/LoginForm'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'

export default function Home() {
  const [showSettings, setShowSettings] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const { user, isAuthenticated } = useAuthStore()
  const { initialized, initializeSettings } = useSettingsStore()

  useEffect(() => {
    if (!initialized) {
      initializeSettings()
    }
  }, [initialized, initializeSettings])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* 侧边栏 */}
      <ChatSidebar 
        onSettingsClick={() => setShowSettings(true)}
        onLoginClick={() => setShowLogin(true)}
      />
      
      {/* 主聊天区域 */}
      <ChatMain />
      
      {/* 设置对话框 */}
      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}
      
      {/* 登录对话框 */}
      {showLogin && !isAuthenticated && (
        <LoginForm onClose={() => setShowLogin(false)} />
      )}
    </div>
  )
}