'use client'

import { PlusIcon, ChatBubbleLeftIcon, Cog6ToothIcon, UserIcon, CubeIcon, PuzzlePieceIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'
import { Button } from '@/components/ui/button'
import { Conversation } from '@/lib/types'

interface ChatSidebarProps {
  onSettingsClick: () => void
  onLoginClick: () => void
  onModelMarketClick?: () => void
}

export default function ChatSidebar({ onSettingsClick, onLoginClick, onModelMarketClick }: ChatSidebarProps) {
  const { conversations, currentConversationId, createNewConversation, setCurrentConversation, deleteConversation } = useChatStore()

  const handleNewChat = () => {
    createNewConversation()
  }

  const handleModelMarketClick = () => {
    if (onModelMarketClick) {
      onModelMarketClick()
    }
  }

  const handlePluginMarketClick = () => {
    // TODO: 打开插件市场浮窗
    console.log('打开插件市场')
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
    <div className="w-64 bg-gray-50 dark:bg-gray-800 flex flex-col">
      {/* 头部 - 新建对话 */}
      <div className="p-4">
        <Button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <PlusIcon className="w-4 h-4" />
          新建对话
        </Button>
      </div>

      {/* 模型市场按钮 */}
      <div className="px-4 pb-2">
        <button
          onClick={handleModelMarketClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left"
        >
          <SparklesIcon className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">模型市场</span>
        </button>
      </div>

      {/* 插件市场按钮 */}
      <div className="px-4 pb-2">
        <button
          onClick={handlePluginMarketClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left"
        >
          <PuzzlePieceIcon className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">插件市场</span>
        </button>
      </div>

      {/* 设置按钮 */}
      <div className="px-4 pb-4">
        <button
          onClick={onSettingsClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors text-left"
        >
          <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">设置</span>
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
        <div className="px-2 py-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">聊天记录</span>
        </div>
        
        {Object.entries(groupedConversations).map(([date, convs]) => (
          <div key={date} className="mb-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 font-medium">
              {date}
            </div>
            {(convs as Conversation[]).map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setCurrentConversation(conversation.id)}
                className={`
                  flex items-center gap-2 p-2 rounded-lg cursor-pointer group
                  ${currentConversationId === conversation.id 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <ChatBubbleLeftIcon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate text-sm">
                  {conversation.title || '新对话'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(conversation.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}