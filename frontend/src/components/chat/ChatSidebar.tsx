'use client'

import { PlusIcon, ChatBubbleLeftIcon, Cog6ToothIcon, UserIcon, CubeIcon, PuzzlePieceIcon, SparklesIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import { Conversation } from '@/lib/types'
import { motion } from 'motion/react'

interface ChatSidebarProps {
  onSettingsClick: () => void
  onLoginClick: () => void
  onModelMarketClick?: () => void
  onPluginMarketClick?: () => void
  onDeepResearchClick?: () => void
  onBackToChat?: () => void // 新增：返回聊天的回调
}

export default function ChatSidebar({ onSettingsClick, onLoginClick, onModelMarketClick, onPluginMarketClick, onDeepResearchClick, onBackToChat }: ChatSidebarProps) {
  const { conversations, currentConversationId, createNewConversation, setCurrentConversation, deleteConversation } = useChatStore()
  const { settings } = useSettingsStore()

  // 检查当前提供商是否支持插件市场
  const supportedProviders = ['openai', 'anthropic']
  const isPluginMarketSupported = supportedProviders.includes(settings.chatProvider)

  const handleNewChat = () => {
    createNewConversation()
    // 如果在深度研究页面，返回聊天页面
    if (onBackToChat) {
      onBackToChat()
    }
  }

  const handleModelMarketClick = () => {
    if (onModelMarketClick) {
      onModelMarketClick()
    }
  }

  const handlePluginMarketClick = () => {
    if (onPluginMarketClick) {
      onPluginMarketClick()
    }
  }

  const handleDeepResearchClick = () => {
    if (onDeepResearchClick) {
      onDeepResearchClick()
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  }

  const groupedConversations = conversations.reduce((groups, conv) => {
    const date = formatDate(new Date(conv.created_at))
    if (!groups[date]) groups[date] = []
    groups[date].push(conv)
    return groups
  }, {} as Record<string, typeof conversations>)

  return (
    <div className="w-[235px] bg-gray-50 dark:bg-gray-800 flex flex-col h-screen flex-shrink-0">
      {/* 头部 - 新建对话 */}
      <motion.div
        className="p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <Button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <motion.div
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <PlusIcon className="w-4 h-4" />
            </motion.div>
            新建对话
          </Button>
        </motion.div>
      </motion.div>

      {/* 模型市场按钮 */}
      <motion.div
        className="px-4 pb-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
      >
        <motion.button
          onClick={handleModelMarketClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-left group"
          whileHover={{
            backgroundColor: "rgba(0, 0, 0, 0.05)",
            transition: { duration: 0.15 }
          }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <SparklesIcon className="w-4 h-4 text-purple-500" />
          </motion.div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">模型市场</span>
        </motion.button>
      </motion.div>

      {/* 插件市场按钮 - 只在支持的提供商时显示 */}
      {isPluginMarketSupported && (
        <motion.div
          className="px-4 pb-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
        >
          <motion.button
            onClick={handlePluginMarketClick}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-left group"
            whileHover={{
              backgroundColor: "rgba(0, 0, 0, 0.05)",
              transition: { duration: 0.15 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <PuzzlePieceIcon className="w-4 h-4 text-blue-500" />
            </motion.div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">插件市场</span>
          </motion.button>
        </motion.div>
      )}

      {/* 深度研究按钮 */}
      <motion.div
        className="px-4 pb-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
      >
        <motion.button
          onClick={handleDeepResearchClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-left group"
          whileHover={{
            backgroundColor: "rgba(0, 0, 0, 0.05)",
            transition: { duration: 0.15 }
          }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <MagnifyingGlassIcon className="w-4 h-4 text-green-500" />
          </motion.div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">深度研究</span>
        </motion.button>
      </motion.div>

      {/* 设置按钮 */}
      <motion.div
        className="px-4 pb-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.25, ease: "easeOut" }}
      >
        <motion.button
          onClick={onSettingsClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-left group"
          whileHover={{
            backgroundColor: "rgba(0, 0, 0, 0.05)",
            transition: { duration: 0.15 }
          }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
          </motion.div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">设置</span>
        </motion.button>
      </motion.div>

      {/* 对话列表 */}
      <motion.div
        className="flex-1 overflow-y-auto scrollbar-thin px-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
      >
        <div className="px-2 py-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">聊天记录</span>
        </div>

        {Object.entries(groupedConversations).map(([date, convs], groupIndex) => (
          <motion.div
            key={date}
            className="mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.35 + (groupIndex * 0.05),
              ease: "easeOut"
            }}
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 font-medium">
              {date}
            </div>
            {(convs as Conversation[]).map((conversation, convIndex) => (
              <motion.div
                key={conversation.id}
                onClick={() => {
                  setCurrentConversation(conversation.id)
                  // 如果在深度研究页面，返回聊天页面
                  if (onBackToChat) {
                    onBackToChat()
                  }
                }}
                className={`
                  flex items-center gap-2 p-2 rounded-lg cursor-pointer group
                  ${currentConversationId === conversation.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : ''
                  }
                `}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 0.4 + (groupIndex * 0.05) + (convIndex * 0.02),
                  ease: "easeOut"
                }}
                whileHover={{
                  backgroundColor: currentConversationId !== conversation.id ? "rgba(0, 0, 0, 0.05)" : undefined,
                  x: currentConversationId !== conversation.id ? 4 : 0,
                  transition: { duration: 0.15 }
                }}
                whileTap={{ scale: 0.98 }}
              >
                <ChatBubbleLeftIcon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate text-sm">
                  {conversation.title || '新对话'}
                </span>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(conversation.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400"
                  whileHover={{
                    scale: 1.1,
                    rotate: 90,
                    color: "#ef4444",
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.9 }}
                >
                  ×
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}