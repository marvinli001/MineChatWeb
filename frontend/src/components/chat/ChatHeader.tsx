'use client'

import { Bars3Icon } from '@heroicons/react/24/outline'
import ModelSelector from '@/components/ui/ModelSelector'

interface ChatHeaderProps {
  onMenuClick: () => void
  onModelMarketClick?: () => void
}

export default function ChatHeader({ onMenuClick, onModelMarketClick }: ChatHeaderProps) {
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

      {/* 模型选择器 - 紧贴菜单按钮右侧 */}
      <div className="flex-1 max-w-xs">
        <ModelSelector 
          onModelMarketClick={onModelMarketClick} 
          showDetailedInfo={false}
        />
      </div>
    </header>
  )
}