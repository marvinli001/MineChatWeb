'use client'

import { useState } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon, WrenchScrewdriverIcon, ServerIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { usePluginStore, type Plugin, type MCPServer } from '@/store/pluginStore'

interface PluginMarketProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'plugins' | 'mcp'

export default function PluginMarket({ isOpen, onClose }: PluginMarketProps) {
  const {
    plugins,
    mcpServers,
    addPlugin,
    removePlugin,
    addMCPServer,
    removeMCPServer
  } = usePluginStore()

  const [activeTab, setActiveTab] = useState<TabType>('plugins')
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  // Plugin form state
  const [pluginForm, setPluginForm] = useState({
    name: '',
    description: '',
    parameters: '{\n  "type": "object",\n  "properties": {\n    \n  },\n  "required": [],\n  "additionalProperties": false\n}',
    strict: true
  })
  
  // MCP Server form state
  const [mcpForm, setMcpForm] = useState({
    name: '',
    description: '',
    url: ''
  })

  const handleAddPlugin = () => {
    if (!pluginForm.name.trim()) {
      toast.error('请输入插件名称')
      return
    }

    try {
      const parameters = JSON.parse(pluginForm.parameters)

      addPlugin({
        name: pluginForm.name.trim(),
        description: pluginForm.description.trim() || '自定义插件',
        type: 'function',
        parameters,
        strict: pluginForm.strict
      })

      setPluginForm({
        name: '',
        description: '',
        parameters: '{\n  "type": "object",\n  "properties": {\n    \n  },\n  "required": [],\n  "additionalProperties": false\n}',
        strict: true
      })
      setShowAddDialog(false)
      toast.success('插件已添加')
    } catch (error) {
      toast.error('参数格式错误，请检查JSON格式')
    }
  }

  const handleAddMCPServer = () => {
    if (!mcpForm.name.trim()) {
      toast.error('请输入服务器名称')
      return
    }

    if (!mcpForm.url.trim()) {
      toast.error('请输入服务器URL')
      return
    }

    addMCPServer({
      name: mcpForm.name.trim(),
      description: mcpForm.description.trim() || '外置MCP服务器',
      url: mcpForm.url.trim()
    })

    setMcpForm({
      name: '',
      description: '',
      url: ''
    })
    setShowAddDialog(false)
    toast.success('MCP服务器已添加')
  }

  const handleRemovePlugin = (id: string, name: string) => {
    if (confirm(`确定要删除插件 "${name}" 吗？`)) {
      removePlugin(id)
      toast.success('插件已删除')
    }
  }

  const handleRemoveMCPServer = (id: string, name: string) => {
    if (confirm(`确定要删除MCP服务器 "${name}" 吗？`)) {
      removeMCPServer(id)
      toast.success('MCP服务器已删除')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              插件市场
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              管理您的插件和MCP服务器
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              添加{activeTab === 'plugins' ? '插件' : 'MCP服务器'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab切换 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('plugins')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'plugins'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <WrenchScrewdriverIcon className="w-4 h-4" />
            插件 ({plugins.length})
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'mcp'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <ServerIcon className="w-4 h-4" />
            MCP服务器 ({mcpServers.length})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 h-[60vh] overflow-y-auto">
          {activeTab === 'plugins' ? (
            // 插件列表
            <div>
              {plugins.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <WrenchScrewdriverIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无插件</p>
                  <p className="text-sm mt-2">点击右上角按钮添加您的第一个插件</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {plugins.map((plugin) => (
                    <div
                      key={plugin.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {plugin.name}
                            </h4>
                            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-1 rounded-full">
                              Function
                            </span>
                            {plugin.strict && (
                              <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 px-2 py-1 rounded-full">
                                严格模式
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {plugin.description}
                          </p>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            参数: {Object.keys(plugin.parameters.properties || {}).length} 个
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            创建时间: {new Date(plugin.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemovePlugin(plugin.id, plugin.name)}
                          className="p-2 text-red-600 hover:text-red-700 transition-colors"
                          title="删除插件"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // MCP服务器列表
            <div>
              {mcpServers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <ServerIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无MCP服务器</p>
                  <p className="text-sm mt-2">点击右上角按钮添加您的第一个MCP服务器</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {mcpServers.map((server) => (
                    <div
                      key={server.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {server.name}
                            </h4>
                            <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 px-2 py-1 rounded-full">
                              MCP
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {server.description}
                          </p>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {server.url}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            创建时间: {new Date(server.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveMCPServer(server.id, server.name)}
                          className="p-2 text-red-600 hover:text-red-700 transition-colors"
                          title="删除MCP服务器"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 添加对话框 */}
      {showAddDialog && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                添加{activeTab === 'plugins' ? '插件' : 'MCP服务器'}
              </h3>
              <button
                onClick={() => {
                  setShowAddDialog(false)
                  if (activeTab === 'plugins') {
                    setPluginForm({
                      name: '',
                      description: '',
                      parameters: '{\n  "type": "object",\n  "properties": {\n    \n  },\n  "required": [],\n  "additionalProperties": false\n}',
                      strict: true
                    })
                  } else {
                    setMcpForm({ name: '', description: '', url: '' })
                  }
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            {activeTab === 'plugins' ? (
              // 插件添加表单
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    插件名称 *
                  </label>
                  <input
                    type="text"
                    value={pluginForm.name}
                    onChange={(e) => setPluginForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例如：get_weather"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    插件描述
                  </label>
                  <textarea
                    value={pluginForm.description}
                    onChange={(e) => setPluginForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="描述插件的功能..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    参数定义 (JSON Schema) *
                  </label>
                  <textarea
                    value={pluginForm.parameters}
                    onChange={(e) => setPluginForm(prev => ({ ...prev, parameters: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                    placeholder="JSON Schema格式的参数定义"
                    rows={8}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="strict_mode"
                    checked={pluginForm.strict}
                    onChange={(e) => setPluginForm(prev => ({ ...prev, strict: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="strict_mode" className="text-sm text-gray-700 dark:text-gray-300">
                    启用严格模式 (推荐)
                  </label>
                </div>
              </div>
            ) : (
              // MCP服务器添加表单
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    服务器名称 *
                  </label>
                  <input
                    type="text"
                    value={mcpForm.name}
                    onChange={(e) => setMcpForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例如：My MCP Server"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    服务器描述
                  </label>
                  <textarea
                    value={mcpForm.description}
                    onChange={(e) => setMcpForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="描述MCP服务器的功能..."
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    服务器URL *
                  </label>
                  <input
                    type="url"
                    value={mcpForm.url}
                    onChange={(e) => setMcpForm(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/mcp"
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddDialog(false)
                  if (activeTab === 'plugins') {
                    setPluginForm({
                      name: '',
                      description: '',
                      parameters: '{\n  "type": "object",\n  "properties": {\n    \n  },\n  "required": [],\n  "additionalProperties": false\n}',
                      strict: true
                    })
                  } else {
                    setMcpForm({ name: '', description: '', url: '' })
                  }
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={activeTab === 'plugins' ? handleAddPlugin : handleAddMCPServer}
                disabled={activeTab === 'plugins' ? !pluginForm.name.trim() : !mcpForm.name.trim() || !mcpForm.url.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                添加{activeTab === 'plugins' ? '插件' : '服务器'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}