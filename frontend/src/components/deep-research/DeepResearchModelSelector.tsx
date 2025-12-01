'use client'

import { useState } from 'react'
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline'

interface DeepResearchModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
}

const DEEP_RESEARCH_MODELS = [
  {
    id: 'o3-deep-research',
    name: 'o3-deep-research',
    provider: 'OpenAI',
    description: 'OpenAI ?????????'
  },
  {
    id: 'o4-mini-deep-research',
    name: 'o4-mini-deep-research', 
    provider: 'OpenAI',
    description: 'OpenAI ?????????'
  }
]


export default function DeepResearchModelSelector({ selectedModel, onModelChange }: DeepResearchModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentModel = DEEP_RESEARCH_MODELS.find(m => m.id === selectedModel) || DEEP_RESEARCH_MODELS[0]

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px]"
      >
        <div className="flex-1 text-left">
          <div className="font-medium text-gray-900 dark:text-white">
            {currentModel.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {currentModel.provider}
          </div>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
                深度研究模型
              </div>
              {DEEP_RESEARCH_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedModel === model.id 
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {model.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {model.description}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {model.provider}
                    </div>
                  </div>
                  {selectedModel === model.id && (
                    <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}