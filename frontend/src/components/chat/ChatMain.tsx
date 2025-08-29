'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatStore, useCurrentConversation } from '@/store/chatStore'
import { useIsAtBottom } from '@/hooks/useIsAtBottom'
import MessageItem from './MessageItem'
import InputArea from './InputArea'
import ChatHeader from './ChatHeader'
import ScrollToBottomButton from './ScrollToBottomButton'
import MobileDrawer from './MobileDrawer'
import ChatSidebar from './ChatSidebar'

interface ChatMainProps {
  onModelMarketClick?: () => void
  onSettingsClick: () => void
  onLoginClick: () => void
  onDeepResearchClick?: () => void
}

// 欢迎页随机标题文案
const welcomeTitles = [
  "我们先从哪里开始呢？",
  "您在忙什么？",
  "我能帮什么忙吗？",
  "今天有什么议程？",
  "您今天在想什么？",
  "您好。准备好开始了吗？",
  "在时刻准备着。",
  "您今天想聊什么？"
]

export default function ChatMain({ onModelMarketClick, onSettingsClick, onLoginClick, onDeepResearchClick }: ChatMainProps) {
  const { isLoading } = useChatStore()
  const currentConversation = useCurrentConversation()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [welcomeTitle, setWelcomeTitle] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const isAtBottom = useIsAtBottom(messagesContainerRef, 100)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleMenuClick = () => {
    setIsSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
  }

  const handleDeepResearchClick = () => {
    setIsSidebarOpen(false) // 关闭移动端抽屉
    if (onDeepResearchClick) {
      onDeepResearchClick()
    }
  }

  // 设置随机欢迎标题
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * welcomeTitles.length)
    setWelcomeTitle(welcomeTitles[randomIndex])
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentConversation?.messages])

  if (!currentConversation || currentConversation.messages.length === 0) {
    return (
      <>
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 chat-layout">
          {/* 移动端头部 */}
          <ChatHeader onMenuClick={handleMenuClick} onModelMarketClick={onModelMarketClick} />
          
          {/* 主内容区域 - 居中显示欢迎信息和输入框 */}
          <div className="flex-1 flex flex-col items-center justify-center welcome-container">
            <div className="text-center max-w-2xl mx-auto px-4 mb-8">
              <h1 className="text-3xl sm:text-4xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-8 animate-in fade-in-0 slide-in-from-bottom-3 duration-500">
                {welcomeTitle}
              </h1>
            </div>
            
            {/* 居中的输入区域 */}
            <div className="w-full max-w-3xl px-4 input-container">
              <InputArea isWelcomeMode={true} onModelMarketClick={onModelMarketClick} />
            </div>
          </div>
        </div>
        
        {/* 移动端抽屉侧边栏 */}
        <MobileDrawer isOpen={isSidebarOpen} onClose={handleCloseSidebar}>
          <ChatSidebar 
            onSettingsClick={onSettingsClick} 
            onLoginClick={onLoginClick} 
            onModelMarketClick={onModelMarketClick}
            onDeepResearchClick={handleDeepResearchClick}
          />
        </MobileDrawer>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-gray-900 chat-layout">
        {/* 移动端头部 */}
        <ChatHeader onMenuClick={handleMenuClick} onModelMarketClick={onModelMarketClick} />
        
        {/* 消息列表 */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto scrollbar-thin messages-container"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 messages-content">
            {currentConversation.messages.map((message, index) => (
              <MessageItem
                key={index}
                message={message}
                isLast={index === currentConversation.messages.length - 1}
              />
            ))}
            <div ref={messagesEndRef} />
            {/* 移动端底部填充 */}
            <div className="h-20 lg:hidden" />
          </div>
        </div>

        {/* 输入区域 */}
        <div className="flex-shrink-0 input-area">
          <InputArea isWelcomeMode={false} onModelMarketClick={onModelMarketClick} />
        </div>
      </div>
      
      {/* 回到底部按钮 */}
      <ScrollToBottomButton 
        isVisible={!isAtBottom && currentConversation.messages.length > 0}
        onClick={scrollToBottom}
      />
      
      {/* 移动端抽屉侧边栏 */}
      <MobileDrawer isOpen={isSidebarOpen} onClose={handleCloseSidebar}>
        <ChatSidebar 
          onSettingsClick={onSettingsClick} 
          onLoginClick={onLoginClick} 
          onModelMarketClick={onModelMarketClick}
          onDeepResearchClick={handleDeepResearchClick}
        />
      </MobileDrawer>
    </>
  )
}