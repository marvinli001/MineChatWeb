'use client'

import { useState } from 'react'
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useSettingsStore } from '@/store/settingsStore'

interface ModelUsage {
  id: string
  name: string
  description: string
  provider: string
  usageCount: number
}

interface ModelSelectorProps {
  onModelMarketClick?: () => void
}

export default function ModelSelector({ onModelMarketClick }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { settings, updateSettings } = useSettingsStore()
  
  // 模型列表，包含使用次数（用于内部排序，但不显示）
  const [models] = useState<ModelUsage[]>([
    { id: 'gpt-4o', name: 'GPT-4o', description: '适用于复杂任务', provider: 'OpenAI', usageCount: 15 },
    { id: 'gpt-4o-mini', name: 'GPT-4o-mini', description: '快速且高效的模型', provider: 'OpenAI', usageCount: 32 },
    { id: 'o3', name: 'o3', description: '推理模型', provider: 'OpenAI', usageCount: 8 },
    { id: 'o4-mini', name: 'o4-mini', description: '快速推理模型', provider: 'OpenAI', usageCount: 21 },
    { id: 'o4-mini-high', name: 'o4-mini-high', description: '高质量推理模型', provider: 'OpenAI', usageCount: 5 },
  ])

  // 按使用次数排序（从多到少）
  const sortedModels = [...models].sort((a, b) => b.usageCount - a.usageCount)
  
  const currentModel = models.find(m => m.id === settings.chatModel)
  const hasValidConfig = settings.chatProvider && settings.chatModel

  const handleModelSelect = (modelId: string) => {
    // 更新设置中的模型
    updateSettings({ chatModel: modelId })
    
    // 增加使用次数（实际项目中应该保存到本地存储或后端）
    const modelIndex = models.findIndex(m => m.id === modelId)
    if (modelIndex !== -1) {
      models[modelIndex].usageCount += 1
    }
    
    setIsOpen(false)
  }

  const handleMoreModelsClick = () => {
    setIsOpen(false)
    if (onModelMarketClick) {
      onModelMarketClick()
    }
  }

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
              {sortedModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
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
                <button 
                  onClick={handleMoreModelsClick}
                  className="w-full text-left px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
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