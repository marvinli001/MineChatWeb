"use client"

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ThinkingModeToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  className?: string
}

export default function ThinkingModeToggle({ enabled, onChange, className }: ThinkingModeToggleProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleToggle = () => {
    if (isAnimating) return
    
    setIsAnimating(true)
    onChange(!enabled)
    
    // 重置动画状态
    setTimeout(() => setIsAnimating(false), 200)
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Thinking
      </span>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800",
          enabled
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
        )}
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle thinking mode"
      >
        <span
          className={cn(
            "inline-block h-4 w-4 bg-white rounded-full shadow-lg transform transition-transform duration-200 ease-in-out",
            enabled ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {enabled ? "开启" : "关闭"}
      </span>
    </div>
  )
}