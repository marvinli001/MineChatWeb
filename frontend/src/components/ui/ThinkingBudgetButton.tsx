"use client"

import { useState } from 'react'
import { LightBulbIcon } from '@heroicons/react/24/outline'
import { ThinkingBudget } from '@/lib/types'

interface ThinkingBudgetButtonProps {
  budget: ThinkingBudget
  onChange: (budget: ThinkingBudget) => void
  provider?: string
  thinkingEnabled?: boolean
  onThinkingToggle?: (enabled: boolean) => void
  className?: string
}

interface ThinkingBudgetPopoverProps {
  current: ThinkingBudget
  onChange: (budget: ThinkingBudget) => void
  onClose: () => void
  provider?: string
}

const budgetOptions: { value: ThinkingBudget; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: '快速响应，轻度思考' },
  { value: 'medium', label: 'Medium', description: '平衡思考深度与速度' },
  { value: 'high', label: 'High', description: '深度思考，详细分析' }
]

// OpenAI GPT-5 特有的预算选项（包含 Instant）
const openaiGPT5BudgetOptions: { value: ThinkingBudget; label: string; description: string }[] = [
  { value: 'instant', label: 'Instant', description: '即刻回答，最快响应' },
  { value: 'low', label: 'Low', description: '快速响应，轻度思考' },
  { value: 'medium', label: 'Medium', description: '平衡思考深度与速度' },
  { value: 'high', label: 'High', description: '深度思考，详细分析' }
]

function ThinkingBudgetPopover({ current, onChange, onClose, provider = 'openai' }: ThinkingBudgetPopoverProps) {
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

  // 根据提供商选择预算选项
  const options = provider === 'openai' ? openaiGPT5BudgetOptions : budgetOptions

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-10 animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover 内容 */}
      <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
        <div className="p-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 px-2 animate-in fade-in-0 slide-in-from-left-1 duration-300 delay-75">
            思考预算
          </div>

          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              onKeyDown={(e) => handleKeyDown(e, option.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 animate-in fade-in-0 slide-in-from-left-1 sm:active:scale-[0.98] ${
                current === option.value
                  ? 'bg-[#C96342]/10 dark:bg-[#C96342]/20 text-[#C96342] dark:text-[#C96342] md:scale-[1.02]'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 md:hover:scale-[1.02]'
              }`}
              role="menuitem"
              tabIndex={0}
              style={{ animationDelay: `${(index + 1) * 50}ms` }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {option.description}
                </div>
              </div>
              {current === option.value && (
                <div className="w-2 h-2 bg-[#C96342] rounded-full flex-shrink-0 animate-in fade-in-0 scale-in-0 duration-200 delay-100" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default function ThinkingBudgetButton({ 
  budget, 
  onChange, 
  provider = 'openai', 
  thinkingEnabled = false, 
  onThinkingToggle, 
  className = "" 
}: ThinkingBudgetButtonProps) {
  const [showPopover, setShowPopover] = useState(false)
  
  const currentOption = budgetOptions.find(opt => opt.value === budget)
  const isAnthropicProvider = provider === 'anthropic'
  const isGoogleProvider = provider === 'google'

  // Anthropic扩展思考模式：显示为开关按钮
  if (isAnthropicProvider && onThinkingToggle) {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => onThinkingToggle(!thinkingEnabled)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200 sm:active:scale-[0.98] ${
            thinkingEnabled
              ? 'bg-[#C96342] text-white border-[#C96342] shadow-lg'
              : 'border-[#DDDDDD] dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={thinkingEnabled ? '扩展思考已启用 (budget_tokens: 10000)' : '点击启用扩展思考'}
          aria-label={thinkingEnabled ? 'Disable extended thinking' : 'Enable extended thinking'}
        >
          <LightBulbIcon className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // Google思考模式：显示为开关按钮（使用动态思维）
  if (isGoogleProvider && onThinkingToggle) {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => onThinkingToggle(!thinkingEnabled)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200 sm:active:scale-[0.98] ${
            thinkingEnabled
              ? 'bg-[#C96342] text-white border-[#C96342] shadow-lg'
              : 'border-[#DDDDDD] dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={thinkingEnabled ? '动态思考已启用（模型自动调整思考深度）' : '点击启用动态思考'}
          aria-label={thinkingEnabled ? 'Disable dynamic thinking' : 'Enable dynamic thinking'}
        >
          <LightBulbIcon className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // OpenAI预算选择模式：显示为原来的预算选择器
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200 sm:active:scale-[0.98] ${
          showPopover
            ? 'bg-[#C96342]/10 text-[#C96342] border-[#C96342]/30 dark:bg-[#C96342]/20 dark:border-[#C96342]/40'
            : 'border-[#DDDDDD] dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
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
          provider={provider}
        />
      )}
    </div>
  )
}