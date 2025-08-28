'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, CheckIcon, ArrowPathIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useSettingsStore, type CustomModel } from '@/store/settingsStore'
import { modelConfigService, type ModelsConfig, type ModelConfig } from '@/services/modelConfigService'
import { toast } from 'react-hot-toast'

interface ModelMarketProps {
  isOpen: boolean
  onClose: () => void
}

export default function ModelMarket({ isOpen, onClose }: ModelMarketProps) {
  const [config, setConfig] = useState<ModelsConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('openai')
  const [showAddModelDialog, setShowAddModelDialog] = useState(false)
  const [newModelForm, setNewModelForm] = useState({
    name: '',
    description: '',
    supports_reasoning: false
  })
  const { 
    settings, 
    updateSettings, 
    addCustomModel, 
    removeCustomModel, 
    updateCustomModel 
  } = useSettingsStore()

  useEffect(() => {
    if (isOpen) {
      loadModelsConfig()
    }
  }, [isOpen])

  const loadModelsConfig = async () => {
    setLoading(true)
    try {
      const configData = await modelConfigService.loadConfig()
      setConfig(configData)
    } catch (error) {
      toast.error('加载模型配置失败')
    } finally {
      setLoading(false)
    }
  }

  const refreshConfig = async () => {
    setLoading(true)
    try {
      const configData = await modelConfigService.refreshConfig()
      setConfig(configData)
      toast.success('模型配置已更新')
    } catch (error) {
      toast.error('刷新配置失败')
    } finally {
      setLoading(false)
    }
  }

  const selectModel = (providerId: string, modelId: string) => {
    updateSettings({
      chatProvider: providerId,
      chatModel: modelId
    })
    toast.success(`已选择 ${config?.providers[providerId]?.models[modelId]?.name}`)
    onClose()
  }

  const isCurrentModel = (providerId: string, modelId: string) => {
    return settings.chatProvider === providerId && settings.chatModel === modelId
  }

  const hasApiKey = (providerId: string) => {
    return Boolean(settings.apiKeys[providerId])
  }

  // 自定义模型管理方法
  const handleAddCustomModel = () => {
    if (!newModelForm.name.trim()) {
      toast.error('请输入模型名称')
      return
    }
    
    addCustomModel({
      name: newModelForm.name.trim(),
      description: newModelForm.description.trim() || '自定义模型',
      supports_reasoning: newModelForm.supports_reasoning
    })
    
    setNewModelForm({
      name: '',
      description: '',
      supports_reasoning: false
    })
    setShowAddModelDialog(false)
    toast.success('模型已添加')
  }

  const handleRemoveCustomModel = (modelId: string, modelName: string) => {
    if (confirm(`确定要删除模型 "${modelName}" 吗？`)) {
      removeCustomModel(modelId)
      toast.success('模型已删除')
    }
  }

  const getCustomModels = (): CustomModel[] => {
    return settings.openaiCompatibleConfig?.customModels || []
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              模型市场
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              选择适合您需求的 AI 模型
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshConfig}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="刷新配置"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex h-[70vh]">
          {/* 侧边栏 - 提供商列表 */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                AI 提供商
              </h3>
              {config && Object.entries(config.providers).map(([providerId, provider]) => (
                <button
                  key={providerId}
                  onClick={() => setSelectedProvider(providerId)}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                    selectedProvider === providerId
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {provider.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.keys(provider.models).length} 个模型
                      </div>
                    </div>
                    {hasApiKey(providerId) && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="已配置 API 密钥" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 主内容 - 模型列表 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : config && selectedProvider && config.providers[selectedProvider] ? (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {config.providers[selectedProvider].name} 模型
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {config.providers[selectedProvider].description}
                    </p>
                    {!hasApiKey(selectedProvider) && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          ⚠️ 请先在设置中配置 {config.providers[selectedProvider].name} 的 API 密钥
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4">
                    {selectedProvider === 'openai_compatible' ? (
                      // OpenAI兼容提供商的自定义模型管理界面
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-md font-medium text-gray-900 dark:text-white">
                            自定义模型
                          </h4>
                          <button
                            onClick={() => setShowAddModelDialog(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <PlusIcon className="w-4 h-4" />
                            添加模型
                          </button>
                        </div>

                        {getCustomModels().length === 0 ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <p>暂无自定义模型</p>
                            <p className="text-sm mt-2">点击上方按钮添加您的第一个自定义模型</p>
                          </div>
                        ) : (
                          getCustomModels().map((model) => (
                            <div
                              key={model.id}
                              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-medium text-gray-900 dark:text-white">
                                      {model.name}
                                    </h4>
                                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-1 rounded-full">
                                      自定义
                                    </span>
                                    {isCurrentModel('openai_compatible', model.id) && (
                                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 px-2 py-1 rounded-full">
                                        当前使用
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    {model.description}
                                  </p>
                                  <div className="flex gap-2">
                                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                                      📝 纯文本对话
                                    </span>
                                    {model.supports_reasoning && (
                                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                                        🧠 支持推理
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    创建时间: {new Date(model.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <button
                                    onClick={() => selectModel('openai_compatible', model.id)}
                                    disabled={!hasApiKey('openai_compatible')}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                      isCurrentModel('openai_compatible', model.id)
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                        : hasApiKey('openai_compatible')
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {isCurrentModel('openai_compatible', model.id) ? (
                                      <>
                                        <CheckIcon className="w-4 h-4 inline mr-1" />
                                        已选择
                                      </>
                                    ) : (
                                      '选择'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleRemoveCustomModel(model.id, model.name)}
                                    className="p-2 text-red-600 hover:text-red-700 transition-colors"
                                    title="删除模型"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    ) : (
                      // 其他提供商的标准模型列表
                      Object.entries(config.providers[selectedProvider].models).map(([modelId, model]) => (
                      <div
                        key={modelId}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {model.name}
                              </h4>
                              {selectedProvider === 'openai' && (
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  modelConfigService.isOpenAIResponsesAPI(modelId)
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                                }`}>
                                  {modelConfigService.isOpenAIResponsesAPI(modelId) ? 'Responses API' : 'Chat Completions'}
                                </span>
                              )}
                              {isCurrentModel(selectedProvider, modelId) && (
                                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 px-2 py-1 rounded-full">
                                  当前使用
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {model.description}
                            </p>
                            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                              <div>上下文: {model.context_length.toLocaleString()}</div>
                              <div>输入: ${model.pricing.input}/1M tokens</div>
                              <div>输出: ${model.pricing.output}/1M tokens</div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              {model.supports_vision && (
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                                  🖼️ 图像
                                </span>
                              )}
                              {model.supports_function_calling && (
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                                  🔧 函数调用
                                </span>
                              )}
                              {model.supports_thinking && (
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                                  🧠 思考模式
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => selectModel(selectedProvider, modelId)}
                            disabled={!hasApiKey(selectedProvider)}
                            className={`ml-4 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              isCurrentModel(selectedProvider, modelId)
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                : hasApiKey(selectedProvider)
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isCurrentModel(selectedProvider, modelId) ? (
                              <>
                                <CheckIcon className="w-4 h-4 inline mr-1" />
                                已选择
                              </>
                            ) : (
                              '选择'
                            )}
                          </button>
                        </div>
                      </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  暂无模型数据
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        {config && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              配置版本: {config.version} | 最后更新: {new Date(config.last_updated).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* 添加自定义模型对话框 */}
      {showAddModelDialog && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                添加自定义模型
              </h3>
              <button
                onClick={() => {
                  setShowAddModelDialog(false)
                  setNewModelForm({
                    name: '',
                    description: '',
                    supports_reasoning: false
                  })
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  模型名称 *
                </label>
                <input
                  type="text"
                  value={newModelForm.name}
                  onChange={(e) => setNewModelForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：gpt-4-turbo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  模型描述
                </label>
                <textarea
                  value={newModelForm.description}
                  onChange={(e) => setNewModelForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="可选的模型描述..."
                  rows={3}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="supports_reasoning"
                  checked={newModelForm.supports_reasoning}
                  onChange={(e) => setNewModelForm(prev => ({ ...prev, supports_reasoning: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="supports_reasoning" className="text-sm text-gray-700 dark:text-gray-300">
                  支持推理模式
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModelDialog(false)
                  setNewModelForm({
                    name: '',
                    description: '',
                    supports_reasoning: false
                  })
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddCustomModel}
                disabled={!newModelForm.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                添加模型
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}