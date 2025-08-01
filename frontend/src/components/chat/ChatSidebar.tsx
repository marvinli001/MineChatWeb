'use client'

import { useState } from 'react'
import { PlusIcon, ChatBubbleLeftIcon, Cog6ToothIcon, UserIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'

interface ChatSidebarProps {
  onSettingsClick: () => void
  onLoginClick: () => void
}

export default function ChatSidebar({ onSettingsClick, onLoginClick }: ChatSidebarProps) {
  const { conversations, currentConversationId, createNewConversation, setCurrentConversation, deleteConversation } = useChatStore()
  const { user, isAuthenticated, logout } = useAuthStore()

  const handleNewChat = () => {
    createNewConversation()
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
    <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <PlusIcon className="w-4 h-4" />
          新建对话
        </Button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {Object.entries(groupedConversations).map(([date, convs]) => (
          <div key={date} className="mb-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 font-medium">
              {date}
            </div>
            {convs.map((conversation) => (
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

      {/* 底部用户区域 */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onSettingsClick}
            className="flex items-center gap-2"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            设置
          </Button>
          
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {user?.username}
              </span>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                退出
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoginClick}
              className="flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4" />
              登录
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}