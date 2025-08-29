'use client'

import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface ScrollToBottomButtonProps {
  isVisible: boolean
  onClick: () => void
}

export default function ScrollToBottomButton({ isVisible, onClick }: ScrollToBottomButtonProps) {
  if (!isVisible) return null

  return (
    <button
      onClick={onClick}
      className="scroll-to-bottom
        fixed z-30 
        flex items-center justify-center
        bg-white dark:bg-gray-800 
        border border-gray-200 dark:border-gray-600 
        rounded-full shadow-lg hover:shadow-xl
        transition-all duration-200 
        hover:scale-105 active:scale-95
        text-gray-600 dark:text-gray-400 
        hover:text-gray-900 dark:hover:text-white
        sm:w-12 sm:h-12 sm:bottom-24 sm:right-6
        w-11 h-11 bottom-24 right-4
      "
      style={{ 
        minWidth: '44px', 
        minHeight: '44px',
        bottom: 'calc(100px + max(1rem, env(safe-area-inset-bottom, 0)))',
        right: 'max(1rem, env(safe-area-inset-right, 0))'
      }}
      aria-label="回到底部"
    >
      <ChevronDownIcon className="w-5 h-5 sm:w-6 sm:h-6" />
    </button>
  )
}