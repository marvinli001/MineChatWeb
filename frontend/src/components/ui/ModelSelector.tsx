'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useSettingsStore } from '@/store/settingsStore'
import { modelConfigService, type ModelConfig } from '@/services/modelConfigService'

interface ModelSelectorProps {
  onModelMarketClick?: () => void
  showDetailedInfo?: boolean // 新增属性控制是否显示详细信息
  dropdownDirection?: 'up' | 'down' | 'auto' // 控制浮窗弹出方向
}

export default function ModelSelector({ onModelMarketClick, showDetailedInfo = false, dropdownDirection = 'down' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentModelConfig, setCurrentModelConfig] = useState<ModelConfig | null>(null)
  const { settings } = useSettingsStore()
  const { chatProvider, chatModel, openaiCompatibleConfig, apiKeys } = settings

  useEffect(() => {
    const loadCurrentModelConfig = async () => {
      if (chatProvider && chatModel) {
        if (chatProvider === 'openai_compatible') {
          const customModel = openaiCompatibleConfig?.customModels?.find(
            m => m.id === chatModel
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
          const config = await modelConfigService.getModelConfig(chatProvider, chatModel)
          setCurrentModelConfig(config)
        }
      } else {
        setCurrentModelConfig(null)
      }
    }

    loadCurrentModelConfig()
  }, [chatProvider, chatModel, openaiCompatibleConfig])

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

  const hasValidConfig = useMemo(() => {
    if (!chatProvider || !chatModel) {
      return false
    }
    return Boolean(apiKeys[chatProvider])
  }, [apiKeys, chatProvider, chatModel])

  const handleMoreModelsClick = () => {
    setIsOpen(false)
    if (onModelMarketClick) {
      onModelMarketClick()
    }
  }

  // 判断浮窗实际弹出方向
  const getDropdownDirection = (): 'up' | 'down' => {
    if (dropdownDirection === 'up') return 'up'
    if (dropdownDirection === 'down') return 'down'
    
    // auto 模式：根据屏幕尺寸和位置自动判断
    if (dropdownDirection === 'auto') {
      // 检测是否为移动端
      const isMobile = window.innerWidth < 1024 // lg 断点
      if (isMobile) return 'down' // 移动端始终向下
      
      // PC端：检测元素位置，如果在屏幕下半部分则向上弹出
      // 这里暂时返回 'up'，在实际使用时会根据具体位置调整
      return 'up'
    }
    
    return 'down' // 默认向下
  }

  const actualDirection = getDropdownDirection()

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
          <div className={`absolute left-0 w-80 bg-white dark:bg-gray-900 border border-black/10 dark:border-white/10 rounded-xl z-20 lg:left-0 lg:w-80 sm:mx-4 sm:left-0 sm:right-4 sm:w-auto ${
            actualDirection === 'up'
              ? 'bottom-full mb-2'
              : 'top-full mt-2'
          }`} style={{boxShadow: '0px 4.35px 21.75px rgba(0, 0, 0, 0.10)'}}>
            <div className="p-4">
              {/* 当前选择的模型信息 */}
              <div className="mb-4 p-3 bg-black/[0.04] dark:bg-white/[0.04] rounded-lg">
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
                className="w-full text-center py-2.5 text-sm text-gray-900 dark:text-white font-medium border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
