'use client'

import { useState } from 'react'
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useSettingsStore } from '@/store/settingsStore'

export default function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const { settings } = useSettingsStore()
  
  // 模拟的模型列表，实际应该从设置中获取
  const models = [
    { id: 'gpt-4o', name: 'GPT-4o', description: '适用于复杂任务', provider: 'OpenAI' },
    { id: 'gpt-4o-mini', name: 'GPT-4o-mini', description: '快速且高效的模型', provider: 'OpenAI' },
    { id: 'o3', name: 'o3', description: '推理模型', provider: 'OpenAI' },
    { id: 'o4-mini', name: 'o4-mini', description: '快速推理模型', provider: 'OpenAI' },
    { id: 'o4-mini-high', name: 'o4-mini-high', description: '高质量推理模型', provider: 'OpenAI' },
  ]

  const currentModel = models.find(m => m.id === settings.chatModel)
  const hasValidConfig = settings.chatProvider && settings.chatModel

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <span className="text-xs">
          {hasValidConfig ? currentModel?.name || '未选择' : '未选择'}
        </span>
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 font-medium">
                可用模型
              </div>
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    // 这里应该调用设置store来更新模型
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {model.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {model.description}
                    </div>
                  </div>
                  {currentModel?.id === model.id && (
                    <CheckIcon className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                <button className="w-full text-left px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  更多模型 →
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}