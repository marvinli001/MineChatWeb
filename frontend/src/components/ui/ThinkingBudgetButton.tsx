"use client"

import { useState } from 'react'
import { LightBulbIcon } from '@heroicons/react/24/outline'
import { ThinkingBudget } from '@/lib/types'

interface ThinkingBudgetButtonProps {
  budget: ThinkingBudget
  onChange: (budget: ThinkingBudget) => void
  className?: string
}

interface ThinkingBudgetPopoverProps {
  current: ThinkingBudget
  onChange: (budget: ThinkingBudget) => void
  onClose: () => void
}

const budgetOptions: { value: ThinkingBudget; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: '快速响应，轻度思考' },
  { value: 'medium', label: 'Medium', description: '平衡思考深度与速度' },
  { value: 'high', label: 'High', description: '深度思考，详细分析' }
]

function ThinkingBudgetPopover({ current, onChange, onClose }: ThinkingBudgetPopoverProps) {
  const handleSelect = (budget: ThinkingBudget) => {
    onChange(budget)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent, budget: ThinkingBudget) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect(budget)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 z-10" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Popover 内容 */}
      <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20">
        <div className="p-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 px-2">
            思考预算
          </div>
          
          {budgetOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              onKeyDown={(e) => handleKeyDown(e, option.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                current === option.value
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              role="menuitem"
              tabIndex={0}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {option.description}
                </div>
              </div>
              {current === option.value && (
                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default function ThinkingBudgetButton({ budget, onChange, className = "" }: ThinkingBudgetButtonProps) {
  const [showPopover, setShowPopover] = useState(false)
  
  const currentOption = budgetOptions.find(opt => opt.value === budget)

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className={`p-2 rounded-full transition-colors ${
          showPopover
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
        title={`思考预算: ${currentOption?.label || 'Medium'}`}
        aria-label="Set thinking budget"
        aria-expanded={showPopover}
        aria-haspopup="menu"
      >
        <LightBulbIcon className="w-5 h-5" />
      </button>

      {showPopover && (
        <ThinkingBudgetPopover
          current={budget}
          onChange={onChange}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  )
}