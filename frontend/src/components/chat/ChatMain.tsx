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
import { motion } from 'motion/react'

interface ChatMainProps {
  onModelMarketClick?: () => void
  onPluginMarketClick?: () => void
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

export default function ChatMain({ onModelMarketClick, onPluginMarketClick, onSettingsClick, onLoginClick, onDeepResearchClick }: ChatMainProps) {
  const currentConversation = useCurrentConversation()
  // 使用当前对话的loading状态
  const isLoading = currentConversation?.isLoading || false
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [welcomeTitle, setWelcomeTitle] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const isAtBottom = useIsAtBottom(messagesContainerRef, 100)

  // 跟踪当前对话ID，用于判断是否切换了对话
  const conversationIdRef = useRef<string | null>(null)
  const [shouldAnimate, setShouldAnimate] = useState(true)

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

  const handlePluginMarketClick = () => {
    if (onPluginMarketClick) {
      onPluginMarketClick()
    }
  }

  // 设置随机欢迎标题
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * welcomeTitles.length)
    setWelcomeTitle(welcomeTitles[randomIndex])
  }, [])

  // 检测对话切换，只在首次加载或新消息添加时播放动画
  useEffect(() => {
    const currentId = currentConversation?.id

    // 如果对话ID改变（切换了对话），禁用动画
    if (conversationIdRef.current !== null && conversationIdRef.current !== currentId) {
      setShouldAnimate(false)
    } else if (conversationIdRef.current === null) {
      // 首次加载，启用动画
      setShouldAnimate(true)
    }

    conversationIdRef.current = currentId || null
  }, [currentConversation?.id])

  useEffect(() => {
    scrollToBottom()
  }, [currentConversation?.messages])

  if (!currentConversation || currentConversation.messages.length === 0) {
    return (
      <>
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 chat-layout overflow-hidden">
          {/* 移动端头部 */}
          <ChatHeader onMenuClick={handleMenuClick} onModelMarketClick={onModelMarketClick} />

          {/* 主内容区域 - 居中显示欢迎信息和输入框 */}
          <motion.div
            className="flex-1 min-h-0 flex flex-col items-center justify-center welcome-container px-4 py-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <motion.div
              className="text-center max-w-2xl mx-auto mb-6 sm:mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              <motion.h1
                className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
              >
                {welcomeTitle}
              </motion.h1>
            </motion.div>

            {/* 居中的输入区域 */}
            <motion.div
              className="w-full max-w-3xl input-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            >
              <InputArea isWelcomeMode={true} onModelMarketClick={onModelMarketClick} />
            </motion.div>
          </motion.div>
        </div>
        
        {/* 移动端抽屉侧边栏 */}
        <MobileDrawer isOpen={isSidebarOpen} onClose={handleCloseSidebar}>
          <ChatSidebar
            onSettingsClick={onSettingsClick}
            onLoginClick={onLoginClick}
            onModelMarketClick={onModelMarketClick}
            onPluginMarketClick={handlePluginMarketClick}
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
          <motion.div
            className="max-w-3xl mx-auto px-4 py-6 messages-content"
            initial={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {currentConversation.messages.map((message, index) => (
              <motion.div
                key={index}
                initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldAnimate ? {
                  duration: 0.4,
                  delay: index * 0.05,
                  ease: "easeOut"
                } : { duration: 0 }}
              >
                <MessageItem
                  message={message}
                  isLast={index === currentConversation.messages.length - 1}
                />
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
            {/* 移动端底部填充 */}
            <div className="h-20 lg:hidden" />
          </motion.div>
        </div>

        {/* 输入区域 */}
        <motion.div
          className="flex-shrink-0 input-area"
          initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldAnimate ? { duration: 0.4, delay: 0.2, ease: "easeOut" } : { duration: 0 }}
        >
          <InputArea isWelcomeMode={false} onModelMarketClick={onModelMarketClick} />
        </motion.div>
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
          onPluginMarketClick={handlePluginMarketClick}
          onDeepResearchClick={handleDeepResearchClick}
        />
      </MobileDrawer>
    </>
  )
}