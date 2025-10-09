'use client'

import { useState } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon, WrenchScrewdriverIcon, ServerIcon, CogIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import { usePluginStore, type Plugin, type MCPServer } from '@/store/pluginStore'
import { motion } from 'motion/react'
import {
  SiGithub,
  SiStripe,
  SiAsana,
  SiAtlassian,
  SiIntercom,
  SiLinear,
  SiPaypal,
  SiSquare,
  SiZapier
} from 'react-icons/si'

interface PluginMarketProps {
  isOpen: boolean
  onClose: () => void
  currentProvider: string
}

type TabType = 'mcp' | 'function'

// OpenAI推荐的公开MCP服务器 (无需OAuth认证或使用简单API密钥)
const OPENAI_MCP_SERVERS = [
  {
    id: 'mcp_github',
    name: 'GitHub',
    description: '访问GitHub仓库、Issues和Pull Requests',
    icon: SiGithub,
    url: 'https://api.githubcopilot.com/mcp/',
    requiresAuth: true,
    authType: 'GitHub Token'
  },
  {
    id: 'mcp_stripe',
    name: 'Stripe',
    description: '创建支付链接、查询交易记录',
    icon: SiStripe,
    url: 'https://mcp.stripe.com',
    requiresAuth: true,
    authType: 'Stripe API Key'
  },
  {
    id: 'mcp_deepwiki',
    name: 'DeepWiki',
    description: '搜索和阅读技术文档（如MCP规范）',
    icon: '📚', // 保留emoji，因为没有对应的品牌图标
    url: 'https://mcp.deepwiki.com/mcp',
    requiresAuth: false
  }
]

// Anthropic内置MCP服务器
const ANTHROPIC_MCP_SERVERS = [
  {
    id: 'mcp_asana',
    name: 'Asana',
    description: '通过AI工具与您的Asana工作区交互，保持项目正常进行',
    icon: SiAsana,
    url: 'https://mcp.asana.com/sse',
    requiresAuth: true,
    authType: 'Asana Token'
  },
  {
    id: 'mcp_atlassian',
    name: 'Atlassian',
    description: '访问Atlassian的协作和生产力工具',
    icon: SiAtlassian,
    url: 'https://mcp.atlassian.com/v1/sse',
    requiresAuth: true,
    authType: 'Atlassian API Key'
  },
  {
    id: 'mcp_intercom',
    name: 'Intercom',
    description: '访问来自Intercom的实时客户对话、工单和用户数据',
    icon: SiIntercom,
    url: 'https://mcp.intercom.com/sse',
    requiresAuth: true,
    authType: 'Intercom Token'
  },
  {
    id: 'mcp_invideo',
    name: 'invideo',
    description: '在您的应用程序中构建视频创建功能',
    icon: '🎥', // 保留emoji，Simple Icons中没有InVideo
    url: 'https://mcp.invideo.io/sse',
    requiresAuth: true,
    authType: 'InVideo API Key'
  },
  {
    id: 'mcp_linear',
    name: 'Linear',
    description: '与Linear的问题跟踪和项目管理系统集成',
    icon: SiLinear,
    url: 'https://mcp.linear.app/sse',
    requiresAuth: true,
    authType: 'Linear API Key'
  },
  {
    id: 'mcp_paypal',
    name: 'PayPal',
    description: '集成PayPal商务功能',
    icon: SiPaypal,
    url: 'https://mcp.paypal.com/sse',
    requiresAuth: true,
    authType: 'PayPal Token'
  },
  {
    id: 'mcp_plaid',
    name: 'Plaid',
    description: '分析、排除故障并优化Plaid集成',
    icon: '🏦', // Plaid图标在react-icons中不可用，使用emoji
    url: 'https://api.dashboard.plaid.com/mcp/sse',
    requiresAuth: true,
    authType: 'Plaid API Key'
  },
  {
    id: 'mcp_square',
    name: 'Square',
    description: '使用代理在Square API上构建。支付、库存、订单等',
    icon: SiSquare,
    url: 'https://mcp.squareup.com/sse',
    requiresAuth: true,
    authType: 'Square Token'
  },
  {
    id: 'mcp_zapier',
    name: 'Zapier',
    description: '通过Zapier的自动化平台连接到近8,000个应用程序',
    icon: SiZapier,
    url: 'https://mcp.zapier.com/',
    requiresAuth: true,
    authType: 'Zapier API Key'
  }
]

export default function PluginMarket({ isOpen, onClose, currentProvider }: PluginMarketProps) {
  const {
    plugins,
    mcpServers,
    addPlugin,
    removePlugin,
    addMCPServer,
    removeMCPServer,
    updateMCPServer
  } = usePluginStore()

  const [activeTab, setActiveTab] = useState<TabType>('mcp')
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
    const service = getServiceById(serviceId)
    if (!service) return

    const existingServer = mcpServers.find(s => s.url === service.url)

    if (existingServer) {
      // 如果服务器已存在，切换启用/禁用状态
      const newEnabled = !existingServer.enabled
      updateMCPServer(existingServer.id, { enabled: newEnabled })
      toast.success(newEnabled ? `${service.name} 已启用` : `${service.name} 已禁用`)
    } else {
      // 如果服务器不存在，打开配置对话框
      setSelectedService(service)
      setShowConfigDialog(true)
    }
  }

  const getServiceById = (serviceId: string) => {
    if (currentProvider === 'openai') {
      return OPENAI_MCP_SERVERS.find(c => c.id === serviceId)
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

    // 如果需要认证但未提供token，给出提示
    if (selectedService.requiresAuth && !configForm.authorization.trim()) {
      toast.error(`${selectedService.name} 需要提供 ${selectedService.authType || 'API密钥'}`)
      return
    }

    const serverConfig: any = {
      name: selectedService.name,
      description: selectedService.description,
      url: selectedService.url, // OpenAI也使用url字段表示MCP服务器地址
      enabled: true, // 新添加的服务器默认启用
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
    const existingServer = mcpServers.find(s => s.url === selectedService.url)

    if (existingServer) {
      // 更新现有服务器
      updateMCPServer(existingServer.id, serverConfig)
    } else {
      // 添加新服务器
      addMCPServer(serverConfig)
    }
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

    if (!mcpForm.url.trim()) {
      toast.error('请输入服务器URL')
      return
    }

    const serverConfig: any = {
      name: mcpForm.name.trim(),
      description: mcpForm.description.trim() || '自定义MCP服务器',
      url: mcpForm.url.trim(),
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

  // 根据当前提供商获取MCP服务器列表
  const builtInServices = currentProvider === 'openai' ? OPENAI_MCP_SERVERS : ANTHROPIC_MCP_SERVERS

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md" onClick={onClose} />

      {/* 桌面端布局 */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden max-sm:hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              插件市场 - {currentProvider === 'openai' ? 'OpenAI' : 'Anthropic MCP服务器'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {currentProvider === 'openai'
                ? '管理您的MCP服务器和函数调用'
                : '管理您的MCP服务器和自定义插件'}
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
              添加自定义{activeTab === 'mcp' ? 'MCP服务器' : '函数'}
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
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              activeTab === 'mcp'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            whileHover={{
              color: activeTab !== 'mcp' ? "#3b82f6" : undefined,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
          >
            <ServerIcon className="w-4 h-4" />
            MCP服务器 ({builtInServices.length})
          </motion.button>
          {/* 只有OpenAI提供商才显示函数调用tab */}
          {currentProvider === 'openai' && (
            <motion.button
              onClick={() => setActiveTab('function')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
                activeTab === 'function'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              whileHover={{
                color: activeTab !== 'function' ? "#3b82f6" : undefined,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.98 }}
            >
              <WrenchScrewdriverIcon className="w-4 h-4" />
              函数调用 ({plugins.length})
            </motion.button>
          )}
        </div>

        {/* 内容区域 */}
        <div className="p-6 h-[60vh] overflow-y-auto">
          {activeTab === 'mcp' ? (
            // MCP服务器卡片网格
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {builtInServices.map((service) => {
                const existingServer = mcpServers.find(s =>
                  s.connector_id === service.id || s.url === service.url
                )
                const isEnabled = !!existingServer && existingServer.enabled !== false
                const hasConfig = !!existingServer

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
                        {/* 支持React组件图标或emoji字符串 */}
                        {typeof service.icon === 'string' ? (
                          <span className="text-2xl">{service.icon}</span>
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center">
                            {(() => {
                              const IconComponent = service.icon
                              return <IconComponent className="w-6 h-6" />
                            })()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {service.name}
                          </h4>
                          <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 px-2 py-1 rounded-full">
                            MCP
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

                    {/* 显示认证要求 */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <div className="flex items-center gap-1">
                        {service.requiresAuth ? (
                          <>
                            <span className="text-yellow-600 dark:text-yellow-400">🔑</span>
                            <span>需要 {service.authType || 'API密钥'}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            <span>无需认证</span>
                          </>
                        )}
                      </div>
                    </div>

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
            // 函数调用列表（仅OpenAI）
            <div>
              {plugins.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <WrenchScrewdriverIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无函数调用</p>
                  <p className="text-sm mt-2">点击右上角按钮添加您的第一个函数</p>
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

      {/* 移动端布局 - 浮窗 */}
      <div className="hidden max-sm:flex max-sm:flex-col bg-white dark:bg-gray-800 rounded-t-2xl w-full max-h-[90vh] shadow-2xl" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        {/* 移动端头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              插件市场
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {currentProvider === 'openai' ? 'OpenAI MCP' : 'Anthropic MCP'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <motion.button
              onClick={() => setShowAddDialog(true)}
              className="p-2 text-blue-600"
              whileTap={{ scale: 0.95 }}
            >
              <PlusIcon className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={onClose}
              className="p-2 text-gray-400"
              whileTap={{ scale: 0.95 }}
            >
              <XMarkIcon className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* 移动端标签页 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <motion.button
            onClick={() => setActiveTab('mcp')}
            className={`flex-1 px-3 py-3 text-sm font-medium transition-all ${
              activeTab === 'mcp'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            MCP ({builtInServices.length})
          </motion.button>
          {currentProvider === 'openai' && (
            <motion.button
              onClick={() => setActiveTab('function')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-all ${
                activeTab === 'function'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              函数 ({plugins.length})
            </motion.button>
          )}
        </div>

        {/* 移动端内容区 */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
          {activeTab === 'mcp' ? (
            // MCP服务器列表（移动端）
            <div className="space-y-3">
              {builtInServices.map((service) => {
                const existingServer = mcpServers.find(s => s.url === service.url)
                const isEnabled = !!existingServer && existingServer.enabled !== false
                const hasConfig = !!existingServer

                return (
                  <div
                    key={service.id}
                    className={`border rounded-lg p-3 ${
                      isEnabled
                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {/* 图标 */}
                      {typeof service.icon === 'string' ? (
                        <span className="text-xl flex-shrink-0">{service.icon}</span>
                      ) : (
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                          {(() => {
                            const IconComponent = service.icon
                            return <IconComponent className="w-5 h-5" />
                          })()}
                        </div>
                      )}
                      {/* 名称和状态 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {service.name}
                          </h4>
                          <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 px-1.5 py-0.5 rounded">
                            MCP
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {service.description}
                        </p>
                      </div>
                    </div>

                    {/* 认证信息 */}
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        {service.requiresAuth ? (
                          <>
                            <span className="text-yellow-600">🔑</span>
                            <span>需要密钥</span>
                          </>
                        ) : (
                          <>
                            <span className="text-green-600">✓</span>
                            <span>无需认证</span>
                          </>
                        )}
                      </div>
                      {hasConfig && (
                        <span className="text-green-600 dark:text-green-400">
                          ✓ 已配置
                        </span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfigureService(service)}
                        className="flex-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg"
                      >
                        配置
                      </button>
                      <button
                        onClick={() => handleToggleService(service.id)}
                        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg ${
                          isEnabled
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {isEnabled ? '已启用' : '启用'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // 函数调用列表（移动端）
            <div>
              {plugins.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <WrenchScrewdriverIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无函数调用</p>
                  <p className="text-xs mt-2">点击右上角 + 添加函数</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {plugins.map((plugin) => (
                    <div
                      key={plugin.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {plugin.name}
                            </h4>
                            {plugin.strict && (
                              <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 px-1.5 py-0.5 rounded flex-shrink-0">
                                严格
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {plugin.description}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemovePlugin(plugin.id, plugin.name)}
                          className="p-1.5 text-red-600 flex-shrink-0"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.keys(plugin.parameters.properties || {}).length} 个参数
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
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto">
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
              {selectedService.requiresAuth && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {selectedService.authType || 'API密钥'}
                    {selectedService.requiresAuth && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type="password"
                    value={configForm.authorization}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, authorization: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`输入您的 ${selectedService.authType || 'API密钥'}`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {selectedService.authType === 'GitHub Token' && '从 GitHub Settings > Developer settings > Personal access tokens 获取'}
                    {selectedService.authType === 'Stripe API Key' && '从 Stripe Dashboard > Developers > API keys 获取'}
                    {!selectedService.authType && '从服务提供商处获取API密钥'}
                  </p>
                </div>
              )}

              {!selectedService.requiresAuth && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✓ 此MCP服务器无需认证，可直接使用
                  </p>
                </div>
              )}

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
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                添加自定义{activeTab === 'mcp' ? 'MCP服务器' : '函数'}
              </h3>
              <button
                onClick={() => setShowAddDialog(false)}
                className="text-gray-400 "
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {activeTab === 'function' ? (
              // 函数添加表单（OpenAI Function Calling）
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    函数名称 *
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
                    函数描述
                  </label>
                  <textarea
                    value={pluginForm.description}
                    onChange={(e) => setPluginForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="描述函数的功能和使用场景..."
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    输入MCP服务器的完整URL地址
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    授权令牌 (可选)
                  </label>
                  <input
                    type="password"
                    value={mcpForm.authorization}
                    onChange={(e) => setMcpForm(prev => ({ ...prev, authorization: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="如服务器需要认证，请输入API密钥或令牌"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    仅在MCP服务器需要认证时填写
                  </p>
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
                onClick={activeTab === 'function' ? handleAddPlugin : handleAddMCPServer}
                disabled={
                  activeTab === 'function'
                    ? !pluginForm.name.trim()
                    : !mcpForm.name.trim() || !mcpForm.url.trim()
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                添加{activeTab === 'function' ? '函数' : 'MCP服务器'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}