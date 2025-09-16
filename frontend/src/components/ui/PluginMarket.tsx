'use client'

import { useState } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon, WrenchScrewdriverIcon, ServerIcon, CogIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { usePluginStore, type Plugin, type MCPServer } from '@/store/pluginStore'
import { motion } from 'motion/react'

interface PluginMarketProps {
  isOpen: boolean
  onClose: () => void
  currentProvider: string
}

type TabType = 'built-in' | 'custom'

// OpenAI内置连接器
const OPENAI_CONNECTORS = [
  {
    id: 'connector_dropbox',
    name: 'Dropbox',
    description: '访问和管理您的Dropbox文件',
    icon: '📁',
    scopes: ['files.metadata.read', 'files.content.read', 'account_info.read']
  },
  {
    id: 'connector_gmail',
    name: 'Gmail',
    description: '搜索和阅读Gmail邮件',
    icon: '📧',
    scopes: ['gmail.modify', 'userinfo.email', 'userinfo.profile']
  },
  {
    id: 'connector_googlecalendar',
    name: 'Google Calendar',
    description: '查看和管理Google日历事件',
    icon: '📅',
    scopes: ['calendar.events', 'userinfo.email', 'userinfo.profile']
  },
  {
    id: 'connector_googledrive',
    name: 'Google Drive',
    description: '搜索和访问Google Drive文件',
    icon: '☁️',
    scopes: ['drive.readonly', 'userinfo.email', 'userinfo.profile']
  },
  {
    id: 'connector_microsoftteams',
    name: 'Microsoft Teams',
    description: '搜索Teams聊天和频道消息',
    icon: '💬',
    scopes: ['Chat.Read', 'ChannelMessage.Read.All', 'User.Read']
  },
  {
    id: 'connector_outlookcalendar',
    name: 'Outlook Calendar',
    description: '查看Outlook日历事件',
    icon: '📆',
    scopes: ['Calendars.Read', 'User.Read']
  },
  {
    id: 'connector_outlookemail',
    name: 'Outlook Email',
    description: '搜索和阅读Outlook邮件',
    icon: '📨',
    scopes: ['Mail.Read', 'User.Read']
  },
  {
    id: 'connector_sharepoint',
    name: 'SharePoint',
    description: '搜索SharePoint/OneDrive文档',
    icon: '📚',
    scopes: ['Sites.Read.All', 'Files.Read.All', 'User.Read']
  }
]

// Anthropic内置MCP服务器
const ANTHROPIC_MCP_SERVERS = [
  {
    id: 'mcp_asana',
    name: 'Asana',
    description: '通过AI工具与您的Asana工作区交互，保持项目正常进行',
    icon: '🎯',
    url: 'https://mcp.asana.com/sse'
  },
  {
    id: 'mcp_atlassian',
    name: 'Atlassian',
    description: '访问Atlassian的协作和生产力工具',
    icon: '🔧',
    url: 'https://mcp.atlassian.com/v1/sse'
  },
  {
    id: 'mcp_intercom',
    name: 'Intercom',
    description: '访问来自Intercom的实时客户对话、工单和用户数据',
    icon: '💬',
    url: 'https://mcp.intercom.com/sse'
  },
  {
    id: 'mcp_invideo',
    name: 'invideo',
    description: '在您的应用程序中构建视频创建功能',
    icon: '🎥',
    url: 'https://mcp.invideo.io/sse'
  },
  {
    id: 'mcp_linear',
    name: 'Linear',
    description: '与Linear的问题跟踪和项目管理系统集成',
    icon: '📊',
    url: 'https://mcp.linear.app/sse'
  },
  {
    id: 'mcp_paypal',
    name: 'PayPal',
    description: '集成PayPal商务功能',
    icon: '💳',
    url: 'https://mcp.paypal.com/sse'
  },
  {
    id: 'mcp_plaid',
    name: 'Plaid',
    description: '分析、排除故障并优化Plaid集成',
    icon: '🏦',
    url: 'https://api.dashboard.plaid.com/mcp/sse'
  },
  {
    id: 'mcp_square',
    name: 'Square',
    description: '使用代理在Square API上构建。支付、库存、订单等',
    icon: '💰',
    url: 'https://mcp.squareup.com/sse'
  },
  {
    id: 'mcp_zapier',
    name: 'Zapier',
    description: '通过Zapier的自动化平台连接到近8,000个应用程序',
    icon: '⚡',
    url: 'https://mcp.zapier.com/'
  }
]

export default function PluginMarket({ isOpen, onClose, currentProvider }: PluginMarketProps) {
  const {
    plugins,
    mcpServers,
    addPlugin,
    removePlugin,
    addMCPServer,
    removeMCPServer
  } = usePluginStore()

  const [activeTab, setActiveTab] = useState<TabType>('built-in')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [enabledServices, setEnabledServices] = useState<Set<string>>(new Set())

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
    url: '',
    connector_id: '',
    authorization: '',
    require_approval: 'always',
    allowed_tools: ''
  })

  // 服务配置表单状态
  const [configForm, setConfigForm] = useState({
    authorization: '',
    require_approval: 'always',
    allowed_tools: ''
  })

  const handleToggleService = (serviceId: string) => {
    const newEnabledServices = new Set(Array.from(enabledServices))
    if (newEnabledServices.has(serviceId)) {
      newEnabledServices.delete(serviceId)
      // 从存储中移除
      const existingServer = mcpServers.find(s => s.connector_id === serviceId || s.url?.includes(serviceId))
      if (existingServer) {
        removeMCPServer(existingServer.id)
      }
    } else {
      newEnabledServices.add(serviceId)
      // 如果没有配置授权信息，先提示配置
      setSelectedService(getServiceById(serviceId))
      setShowConfigDialog(true)
    }
    setEnabledServices(newEnabledServices)
  }

  const getServiceById = (serviceId: string) => {
    if (currentProvider === 'openai') {
      return OPENAI_CONNECTORS.find(c => c.id === serviceId)
    } else {
      return ANTHROPIC_MCP_SERVERS.find(s => s.id === serviceId)
    }
  }

  const handleConfigureService = (service: any) => {
    setSelectedService(service)
    setShowConfigDialog(true)
    // 预填已有配置
    const existingServer = mcpServers.find(s =>
      s.connector_id === service.id || s.url === service.url
    )
    if (existingServer) {
      setConfigForm({
        authorization: existingServer.authorization || '',
        require_approval: existingServer.require_approval || 'always',
        allowed_tools: Array.isArray(existingServer.allowed_tools) ? existingServer.allowed_tools.join(', ') : ''
      })
    }
  }

  const handleSaveConfig = () => {
    if (!selectedService) return

    const serverConfig: any = {
      name: selectedService.name,
      description: selectedService.description,
    }

    if (currentProvider === 'openai') {
      serverConfig.connector_id = selectedService.id
    } else {
      serverConfig.url = selectedService.url
    }

    if (configForm.authorization.trim()) {
      serverConfig.authorization = configForm.authorization.trim()
    }

    serverConfig.require_approval = configForm.require_approval

    if (configForm.allowed_tools.trim()) {
      const tools = configForm.allowed_tools.split(',').map(t => t.trim()).filter(Boolean)
      if (tools.length > 0) {
        serverConfig.allowed_tools = tools
      }
    }

    // 检查是否已存在，如果存在则更新
    const existingServer = mcpServers.find(s =>
      s.connector_id === selectedService.id || s.url === selectedService.url
    )

    if (existingServer) {
      // 更新现有服务器（这里需要添加更新方法到store）
      removeMCPServer(existingServer.id)
    }

    addMCPServer(serverConfig)
    setEnabledServices(prev => new Set([...Array.from(prev), selectedService.id]))
    setShowConfigDialog(false)
    setSelectedService(null)
    setConfigForm({
      authorization: '',
      require_approval: 'always',
      allowed_tools: ''
    })
    toast.success(`${selectedService.name} 配置已保存`)
  }

  // 其他表单处理函数保持不变...
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

    if (!mcpForm.connector_id.trim() && !mcpForm.url.trim()) {
      toast.error('请输入连接器ID或服务器URL')
      return
    }

    const serverConfig: any = {
      name: mcpForm.name.trim(),
      description: mcpForm.description.trim() || (mcpForm.connector_id ? '内置连接器' : '外置MCP服务器'),
    }

    if (mcpForm.connector_id.trim()) {
      serverConfig.connector_id = mcpForm.connector_id.trim()
    } else {
      serverConfig.url = mcpForm.url.trim()
    }

    if (mcpForm.authorization.trim()) {
      serverConfig.authorization = mcpForm.authorization.trim()
    }

    if (mcpForm.require_approval) {
      serverConfig.require_approval = mcpForm.require_approval
    }

    if (mcpForm.allowed_tools.trim()) {
      try {
        const tools = mcpForm.allowed_tools.split(',').map(t => t.trim()).filter(Boolean)
        if (tools.length > 0) {
          serverConfig.allowed_tools = tools
        }
      } catch (error) {
        toast.error('允许工具列表格式错误')
        return
      }
    }

    addMCPServer(serverConfig)

    setMcpForm({
      name: '',
      description: '',
      url: '',
      connector_id: '',
      authorization: '',
      require_approval: 'always',
      allowed_tools: ''
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

  // 根据当前提供商获取内置服务
  const builtInServices = currentProvider === 'openai' ? OPENAI_CONNECTORS : ANTHROPIC_MCP_SERVERS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              插件市场 - {currentProvider === 'openai' ? 'OpenAI连接器' : 'Anthropic MCP服务器'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              管理您的{currentProvider === 'openai' ? '内置连接器' : 'MCP服务器'}和自定义插件
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
              whileHover={{
                backgroundColor: "#2563eb",
                scale: 1.02,
                transition: { duration: 0.15 }
              }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <PlusIcon className="w-4 h-4" />
              </motion.div>
              添加自定义{activeTab === 'built-in' ? '服务' : '插件'}
            </motion.button>
            <motion.button
              onClick={onClose}
              className="p-2 text-gray-400"
              whileHover={{
                backgroundColor: "rgba(0, 0, 0, 0.05)",
                scale: 1.1,
                transition: { duration: 0.15 }
              }}
              whileTap={{ scale: 0.95 }}
            >
              <XMarkIcon className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Tab切换 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <motion.button
            onClick={() => setActiveTab('built-in')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              activeTab === 'built-in'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            whileHover={{
              color: activeTab !== 'built-in' ? "#3b82f6" : undefined,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <ServerIcon className="w-4 h-4" />
            内置服务 ({builtInServices.length})
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              activeTab === 'custom'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            whileHover={{
              color: activeTab !== 'custom' ? "#3b82f6" : undefined,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <WrenchScrewdriverIcon className="w-4 h-4" />
            自定义插件 ({plugins.length})
          </motion.button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 h-[60vh] overflow-y-auto">
          {activeTab === 'built-in' ? (
            // 内置服务卡片网格
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {builtInServices.map((service) => {
                const isEnabled = enabledServices.has(service.id)
                const hasConfig = mcpServers.some(s =>
                  s.connector_id === service.id || s.url === service.url
                )

                return (
                  <div
                    key={service.id}
                    className={`border rounded-lg p-4 ${
                      isEnabled
                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{service.icon}</span>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {service.name}
                          </h4>
                          <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 px-2 py-1 rounded-full">
                            {currentProvider === 'openai' ? '连接器' : 'MCP'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 设置按钮 */}
                        <button
                          onClick={() => handleConfigureService(service)}
                          className="p-1.5 text-gray-500 dark:text-gray-400"
                          title="配置服务"
                        >
                          <CogIcon className="w-4 h-4" />
                        </button>
                        {/* 开关按钮 */}
                        <button
                          onClick={() => handleToggleService(service.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white ${
                              isEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {service.description}
                    </p>

                    {currentProvider === 'openai' && service.scopes && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <div className="font-medium mb-1">所需权限:</div>
                        <div className="flex flex-wrap gap-1">
                          {service.scopes.map((scope, idx) => (
                            <span
                              key={idx}
                              className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasConfig && (
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                        ✓ 已配置
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // 自定义插件列表（保持原有逻辑）
            <div>
              {plugins.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <WrenchScrewdriverIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无自定义插件</p>
                  <p className="text-sm mt-2">点击右上角按钮添加您的第一个插件</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {plugins.map((plugin) => (
                    <div
                      key={plugin.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
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
                          className="p-2 text-red-600"
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
          )}
        </div>
      </div>

      {/* 配置对话框 */}
      {showConfigDialog && selectedService && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                配置 {selectedService.name}
              </h3>
              <button
                onClick={() => {
                  setShowConfigDialog(false)
                  setSelectedService(null)
                  setConfigForm({
                    authorization: '',
                    require_approval: 'always',
                    allowed_tools: ''
                  })
                }}
                className="text-gray-400 "
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  授权令牌 {currentProvider === 'openai' ? '(OAuth Access Token)' : '(API Token)'}
                </label>
                <input
                  type="password"
                  value={configForm.authorization}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, authorization: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={currentProvider === 'openai' ? '从OAuth提供商获取的访问令牌' : '服务API密钥或令牌'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  审批要求
                </label>
                <select
                  value={configForm.require_approval}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, require_approval: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="always">总是需要审批</option>
                  <option value="never">不需要审批</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  允许的工具 (可选)
                </label>
                <input
                  type="text"
                  value={configForm.allowed_tools}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, allowed_tools: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="用逗号分隔工具名称，留空表示允许所有工具"
                />
                <p className="text-xs text-gray-500 mt-1">
                  例如: search, fetch, list_files
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConfigDialog(false)
                  setSelectedService(null)
                  setConfigForm({
                    authorization: '',
                    require_approval: 'always',
                    allowed_tools: ''
                  })
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg "
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg "
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加自定义插件对话框（保持原有逻辑，但简化） */}
      {showAddDialog && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                添加自定义{activeTab === 'built-in' ? 'MCP服务器' : '插件'}
              </h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="text-gray-400 "
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {activeTab === 'custom' ? (
              // 插件添加表单（保持原有逻辑）
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
              // MCP服务器添加表单（保持原有逻辑）
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
                    placeholder="例如：My Custom MCP Server"
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
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {currentProvider === 'openai' ? '连接器ID' : '服务器URL'}
                    </label>
                    {currentProvider === 'openai' ? (
                      <input
                        type="text"
                        value={mcpForm.connector_id}
                        onChange={(e) => setMcpForm(prev => ({ ...prev, connector_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="connector_custom"
                      />
                    ) : (
                      <input
                        type="url"
                        value={mcpForm.url}
                        onChange={(e) => setMcpForm(prev => ({ ...prev, url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/mcp"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      授权令牌
                    </label>
                    <input
                      type="password"
                      value={mcpForm.authorization}
                      onChange={(e) => setMcpForm(prev => ({ ...prev, authorization: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="OAuth访问令牌"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      审批要求
                    </label>
                    <select
                      value={mcpForm.require_approval}
                      onChange={(e) => setMcpForm(prev => ({ ...prev, require_approval: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="always">总是需要审批</option>
                      <option value="never">不需要审批</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      允许的工具
                    </label>
                    <input
                      type="text"
                      value={mcpForm.allowed_tools}
                      onChange={(e) => setMcpForm(prev => ({ ...prev, allowed_tools: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="tool1, tool2, tool3"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddDialog(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg "
              >
                取消
              </button>
              <button
                onClick={activeTab === 'custom' ? handleAddPlugin : handleAddMCPServer}
                disabled={
                  activeTab === 'custom'
                    ? !pluginForm.name.trim()
                    : !mcpForm.name.trim() || (currentProvider === 'openai' ? !mcpForm.connector_id.trim() : !mcpForm.url.trim())
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                添加{activeTab === 'custom' ? '插件' : '服务器'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}