'use client'

import { useState, useEffect } from 'react'
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useSettingsStore } from '@/store/settingsStore'
import { modelConfigService, type ModelConfig } from '@/services/modelConfigService'

interface ModelSelectorProps {
  onModelMarketClick?: () => void
  showDetailedInfo?: boolean // 新增属性控制是否显示详细信息
}

export default function ModelSelector({ onModelMarketClick, showDetailedInfo = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentModelConfig, setCurrentModelConfig] = useState<ModelConfig | null>(null)
  const { settings, updateSettings } = useSettingsStore()

  useEffect(() => {
    loadCurrentModelConfig()
  }, [settings.chatProvider, settings.chatModel])

  const loadCurrentModelConfig = async () => {
    if (settings.chatProvider && settings.chatModel) {
      if (settings.chatProvider === 'openai_compatible') {
        // 对于OpenAI兼容提供商，从设置存储中获取自定义模型
        const customModel = settings.openaiCompatibleConfig?.customModels?.find(
          m => m.id === settings.chatModel
        )
        if (customModel) {
          setCurrentModelConfig({
            name: customModel.name,
            description: customModel.description,
            api_type: 'chat_completions',
            context_length: 0,
            supports_vision: false,
            supports_function_calling: false,
            supports_thinking: false,
            supports_streaming: true,
            pricing: { input: 0, output: 0 }
          })
        } else {
          setCurrentModelConfig(null)
        }
      } else {
        const config = await modelConfigService.getModelConfig(settings.chatProvider, settings.chatModel)
        setCurrentModelConfig(config)
      }
    } else {
      setCurrentModelConfig(null)
    }
  }

  const getProviderDisplayName = (providerId: string) => {
    const providerNames: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      deepseek: 'DeepSeek',
      openai_compatible: 'OpenAI兼容'
    }
    return providerNames[providerId] || providerId
  }

  const hasValidConfig = settings.chatProvider && settings.chatModel && settings.apiKeys[settings.chatProvider]

  const handleMoreModelsClick = () => {
    setIsOpen(false)
    if (onModelMarketClick) {
      onModelMarketClick()
    }
  }

  // 如果没有选择提供商，显示提示
  if (!settings.chatProvider || !settings.chatModel) {
    return (
      <button
        onClick={handleMoreModelsClick}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <span className="text-xs">选择模型</span>
        <ChevronDownIcon className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* 提供商标识 */}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {getProviderDisplayName(settings.chatProvider)}
          </span>
          {/* 模型名称 */}
          <span className="text-xs font-medium">
            {currentModelConfig?.name || settings.chatModel}
          </span>
          {/* 仅在详细模式下显示 API 类型标识和配置状态 */}
          {showDetailedInfo && (
            <>
              {/* API 类型标识（仅 OpenAI） */}
              {settings.chatProvider === 'openai' && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  modelConfigService.isOpenAIResponsesAPI(settings.chatModel)
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                }`}>
                  {modelConfigService.isOpenAIResponsesAPI(settings.chatModel) ? 'R' : 'C'}
                </span>
              )}
              {/* 配置状态指示 */}
              <div className={`w-2 h-2 rounded-full ${
                hasValidConfig ? 'bg-green-500' : 'bg-red-500'
              }`} />
            </>
          )}
        </div>
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 bottom-full mb-2 lg:bottom-full lg:mb-2 sm:top-full sm:mt-2 sm:rounded-xl sm:mx-4 sm:left-0 sm:right-4 sm:w-auto">
            <div className="p-4">
              {/* 当前选择的模型信息 */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    当前模型
                  </span>
                  {showDetailedInfo && (
                    hasValidConfig ? (
                      <span className="text-xs text-green-600 dark:text-green-400">已配置</span>
                    ) : (
                      <span className="text-xs text-red-600 dark:text-red-400">未配置</span>
                    )
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {currentModelConfig?.name || settings.chatModel}
                </div>
                {currentModelConfig && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {currentModelConfig.description}
                  </div>
                )}
                
                {/* 仅在详细模式下显示模型特性标签 */}
                {showDetailedInfo && currentModelConfig && (
                  <div className="flex gap-1 mt-2">
                    {currentModelConfig.supports_thinking && (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 px-2 py-1 rounded">
                        🧠 思考
                      </span>
                    )}
                    {settings.chatProvider === 'openai' && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        modelConfigService.isOpenAIResponsesAPI(settings.chatModel)
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                      }`}>
                        {modelConfigService.isOpenAIResponsesAPI(settings.chatModel) ? 'Responses API' : 'Chat Completions'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 打开模型市场按钮 */}
              <button 
                onClick={handleMoreModelsClick}
                className="w-full text-center py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                打开模型市场 →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}