'use client'

import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Conversation } from '@/lib/types'
import { motion } from 'motion/react'

interface ChatSidebarProps {
  onSettingsClick: () => void
  onLoginClick: () => void
  onModelMarketClick?: () => void
  onPluginMarketClick?: () => void
  onDeepResearchClick?: () => void
  onBackToChat?: () => void
}

export default function ChatSidebar({ onSettingsClick, onLoginClick, onModelMarketClick, onPluginMarketClick, onDeepResearchClick, onBackToChat }: ChatSidebarProps) {
  const { conversations, currentConversationId, createNewConversation, setCurrentConversation, deleteConversation } = useChatStore()
  const { settings } = useSettingsStore()

  // 检查当前提供商是否支持插件市场
  const supportedProviders = ['openai', 'anthropic']
  const isPluginMarketSupported = supportedProviders.includes(settings.chatProvider)

  const handleNewChat = () => {
    createNewConversation()
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
    if (days < 7) return '最近7天'
    if (days < 30) return '最近30天'
    return '更早'
  }

  const groupedConversations = conversations.reduce((groups, conv) => {
    const date = formatDate(new Date(conv.created_at))
    if (!groups[date]) groups[date] = []
    groups[date].push(conv)
    return groups
  }, {} as Record<string, typeof conversations>)

  return (
    <div className="w-full lg:w-64 h-screen px-3 py-3 bg-gray-50 dark:bg-[#171717] inline-flex flex-col justify-start items-start">
      {/* Apps */}
      <div className="self-stretch flex flex-col justify-start items-start">
        {/* 新建对话 */}
        <motion.div
          onClick={handleNewChat}
          className="self-stretch p-2.5 bg-gray-50 dark:bg-[#171717] rounded-lg inline-flex justify-start items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="size-7 p-1.5 rounded-2xl outline outline-1 outline-offset-[-0.92px] outline-gray-300 dark:outline-[#434242] inline-flex flex-col justify-center items-center overflow-hidden flex-shrink-0">
            <svg className="w-full h-full text-gray-700 dark:text-[#D9D9D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="flex-1 justify-start text-gray-900 dark:text-white text-xs font-normal">新建对话</div>
        </motion.div>

        {/* 模型市场 */}
        <motion.div
          onClick={handleModelMarketClick}
          className="self-stretch p-2.5 bg-gray-50 dark:bg-[#171717] rounded-lg inline-flex justify-start items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="size-7 p-1.5 rounded-2xl outline outline-1 outline-offset-[-0.92px] outline-gray-300 dark:outline-[#434242] inline-flex flex-col justify-center items-center overflow-hidden flex-shrink-0">
            <svg className="w-full h-full text-gray-700 dark:text-[#D9D9D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className="flex-1 justify-start text-gray-900 dark:text-white text-xs font-normal">模型市场</div>
        </motion.div>

        {/* 插件市场 */}
        {isPluginMarketSupported && (
          <motion.div
            onClick={handlePluginMarketClick}
            className="self-stretch p-2.5 bg-gray-50 dark:bg-[#171717] rounded-lg inline-flex justify-start items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="size-7 p-1.5 rounded-2xl outline outline-1 outline-offset-[-0.92px] outline-gray-300 dark:outline-[#434242] inline-flex flex-col justify-center items-center overflow-hidden flex-shrink-0">
              <svg className="w-full h-full text-gray-700 dark:text-[#D9D9D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
            </div>
            <div className="flex-1 justify-start text-gray-900 dark:text-white text-xs font-normal">插件市场</div>
          </motion.div>
        )}

        {/* 深度研究 */}
        <motion.div
          onClick={handleDeepResearchClick}
          className="self-stretch p-2.5 bg-gray-50 dark:bg-[#171717] rounded-lg inline-flex justify-start items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="size-7 p-1.5 rounded-2xl outline outline-1 outline-offset-[-0.92px] outline-gray-300 dark:outline-[#434242] inline-flex flex-col justify-center items-center overflow-hidden flex-shrink-0">
            <svg className="w-full h-full text-gray-700 dark:text-[#D9D9D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <div className="flex-1 justify-start text-gray-900 dark:text-white text-xs font-normal">深度研究</div>
        </motion.div>

        {/* 设置 */}
        <motion.div
          onClick={onSettingsClick}
          className="self-stretch p-2.5 bg-gray-50 dark:bg-[#171717] rounded-lg inline-flex justify-start items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="size-7 p-1.5 rounded-2xl outline outline-1 outline-offset-[-0.92px] outline-gray-300 dark:outline-[#434242] inline-flex flex-col justify-center items-center overflow-hidden flex-shrink-0">
            <svg className="w-full h-full text-gray-700 dark:text-[#D9D9D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="23" y1="12" x2="21" y2="12" />
              <line x1="3" y1="12" x2="1" y2="12" />
              <line x1="20.5" y1="20.5" x2="18.5" y2="18.5" />
              <line x1="5.5" y1="5.5" x2="3.5" y2="3.5" />
              <line x1="20.5" y1="3.5" x2="18.5" y2="5.5" />
              <line x1="5.5" y1="18.5" x2="3.5" y2="20.5" />
            </svg>
          </div>
          <div className="flex-1 justify-start text-gray-900 dark:text-white text-xs font-normal">设置</div>
        </motion.div>
      </div>

      {/* Chat group */}
      <div className="self-stretch flex-1 pt-4 flex flex-col justify-start items-start gap-6 overflow-y-auto scrollbar-thin">
        {Object.entries(groupedConversations).map(([date, convs]) => (
          <div key={date} className="self-stretch flex flex-col justify-start items-start gap-1">
            {/* Header */}
            <div className="self-stretch px-2.5 inline-flex justify-start items-center mb-1">
              <div className="flex-1 justify-start text-gray-500 dark:text-[#B5B5B5] text-[10px] font-normal">{date}</div>
            </div>
            {/* Conversations */}
            {(convs as Conversation[]).map((conversation) => (
              <motion.div
                key={conversation.id}
                onClick={() => {
                  setCurrentConversation(conversation.id)
                  if (onBackToChat) {
                    onBackToChat()
                  }
                }}
                className={`self-stretch h-8 px-2.5 py-2 relative rounded-lg inline-flex justify-start items-center overflow-hidden cursor-pointer group ${
                  currentConversationId === conversation.id
                    ? 'bg-black/10 dark:bg-white/10'
                    : 'bg-gray-50 dark:bg-[#171717] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex-1 justify-start text-gray-900 dark:text-white text-xs font-normal truncate">
                  {conversation.title || '新对话'}
                </div>
                <div className="w-6 h-8 absolute right-0 top-0 bg-gradient-to-l from-gray-50 dark:from-[#171717] to-transparent pointer-events-none" />
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(conversation.id)
                  }}
                  className="absolute right-1.5 opacity-0 group-hover:opacity-100 text-gray-400 dark:text-[#B5B5B5] hover:text-red-400 text-base z-10"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ×
                </motion.button>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
