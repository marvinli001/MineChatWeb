'use client'

import { Bars3Icon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'

interface DeepResearchHeaderProps {
  onMenuClick: () => void
  onBackToChat?: () => void
}

export default function DeepResearchHeader({ onMenuClick, onBackToChat }: DeepResearchHeaderProps) {
  return (
    <header className="mobile-header sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 backdrop-filter backdrop-blur-sm">
      {/* 菜单按钮 */}
      <button
        onClick={onMenuClick}
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
        aria-label="打开菜单"
        style={{ minWidth: '44px', minHeight: '44px' }}
      >
        <Bars3Icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      </button>

      {/* 页面标题 */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          深度研究
        </h1>
      </div>

      {/* 返回聊天按钮 */}
      {onBackToChat && (
        <button
          onClick={onBackToChat}
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label="返回聊天"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <ChatBubbleLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
      )}
    </header>
  )
}