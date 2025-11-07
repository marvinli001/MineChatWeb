'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, PaperClipIcon, StopIcon } from '@heroicons/react/24/outline'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DeepResearchModelSelector from './DeepResearchModelSelector'
import DeepResearchTaskList from './DeepResearchTaskList'
import DeepResearchHeader from './DeepResearchHeader'
import MobileDrawer from '../chat/MobileDrawer'
import ChatSidebar from '../chat/ChatSidebar'
import { deepResearchService, DeepResearchTask, DeepResearchFile } from '../../services/deepResearchService'
import { useSettingsStore } from '../../store/settingsStore'

interface DeepResearchPageProps {
  onBackToChat?: () => void
  onSettingsClick?: () => void
  onLoginClick?: () => void
  onModelMarketClick?: () => void
  onPluginMarketClick?: () => void
}

export default function DeepResearchPage({ onBackToChat, onSettingsClick, onLoginClick, onModelMarketClick, onPluginMarketClick }: DeepResearchPageProps) {
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState('o3-deep-research')
  const [tasks, setTasks] = useState<DeepResearchTask[]>([])
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<DeepResearchFile[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  // 从设置存储中获取API密钥
  const { settings } = useSettingsStore()
  
  // 获取OpenAI API密钥
  const getApiKey = () => {
    return settings.apiKeys['openai'] || settings.apiKeys['OpenAI'] || ''
  }
  
  // 获取base URL
  const getBaseUrl = () => {
    if (settings.openaiCompatibleConfig?.baseUrl && settings.openaiCompatibleConfig.baseUrl !== 'https://api.openai.com/v1') {
      return settings.openaiCompatibleConfig.baseUrl
    }
    return undefined
  }

  const handleMenuClick = () => {
    setIsSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
  }

  // 从localStorage加载任务
  const loadTasksFromLocalStorage = (): DeepResearchTask[] => {
    try {
      const storedTasks = localStorage.getItem('deepResearchTasks')
      if (storedTasks) {
        return JSON.parse(storedTasks)
      }
    } catch (error) {
      console.error('从localStorage加载任务失败:', error)
    }
    return []
  }

  // 保存任务到localStorage
  const saveTasksToLocalStorage = (tasksToSave: DeepResearchTask[]) => {
    try {
      localStorage.setItem('deepResearchTasks', JSON.stringify(tasksToSave))
    } catch (error) {
      console.error('保存任务到localStorage失败:', error)
    }
  }

  // 自动保存任务到localStorage
  useEffect(() => {
    if (tasks.length > 0) {
      saveTasksToLocalStorage(tasks)
    }
  }, [tasks])

  // 初始化WebSocket和加载任务
  useEffect(() => {
    const initializeService = async () => {
      try {
        // 1. 先从localStorage恢复任务（即时显示）
        const localTasks = loadTasksFromLocalStorage()
        if (localTasks.length > 0) {
          setTasks(localTasks)
          console.log(`从localStorage恢复了 ${localTasks.length} 个任务`)

          // 为正在运行或警告状态的任务重新订阅更新
          localTasks.forEach(task => {
            if (task.status === 'running' || task.status === 'warning') {
              const pollInterval = subscribeToTaskUpdates(task.id)
              pollIntervalsRef.current.set(task.id, pollInterval)
              console.log(`重新订阅任务 ${task.id} 的状态更新`)
            }
          })
        }

        // 2. 连接WebSocket（静默失败，不影响功能使用）
        await deepResearchService.connectWebSocket().catch((wsError) => {
          // WebSocket连接失败不影响主要功能，因为有轮询机制兜底
          console.log('WebSocket连接失败，将使用轮询方式获取任务状态:', wsError.message)
        })

        // 3. 从后端加载任务并合并更新
        await loadTasks()
      } catch (error) {
        console.error('初始化深度研究服务时出错:', error)
        // 只有在加载任务列表失败时才显示错误
        // WebSocket连接失败不影响使用，因为有轮询机制
      }
    }

    initializeService()

    // 清理函数
    const intervalRegistry = pollIntervalsRef.current
    return () => {
      deepResearchService.disconnect()

      // 清理所有轮询间隔
      intervalRegistry.forEach((interval) => {
        clearInterval(interval)
      })
      intervalRegistry.clear()
    }
  }, [])

  // 加载任务列表（合并本地和远程数据）
  const loadTasks = async () => {
    try {
      const response = await deepResearchService.getTasks(50, 0)

      // 合并远程任务和本地任务
      setTasks(prevTasks => {
        const remoteTasks = response.tasks
        const taskMap = new Map<string, DeepResearchTask>()

        // 先添加本地任务
        prevTasks.forEach(task => {
          taskMap.set(task.id, task)
        })

        // 用远程任务更新（远程数据优先，因为是最新状态）
        remoteTasks.forEach(task => {
          taskMap.set(task.id, task)
        })

        // 转换为数组并按创建时间排序
        return Array.from(taskMap.values()).sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      })
    } catch (error) {
      console.error('加载任务列表失败:', error)
      // 不显示错误，因为可能是第一次使用或网络问题
      // 本地数据仍然可用
    }
  }

  // 订阅任务状态更新
  const subscribeToTaskUpdates = (taskId: string) => {
    deepResearchService.subscribeToTask(taskId, (data) => {
      if (data.type === 'task_update' && data.task_id === taskId) {
        setTasks(prev => prev.map(task =>
          task.id === taskId
            ? {
                ...task,
                status: data.status,
                result: data.result || task.result,
                warning_message: data.warning_message || task.warning_message
              }
            : task
        ))
      }
    })

    // 定期轮询任务状态以防WebSocket更新丢失
    const pollInterval = setInterval(async () => {
      try {
        const updatedTask = await deepResearchService.getTask(taskId)
        if (updatedTask) {
          setTasks(prev => prev.map(task =>
            task.id === taskId ? updatedTask : task
          ))

          // 如果任务已完成或失败，停止轮询
          if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
            clearInterval(pollInterval)
            pollIntervalsRef.current.delete(taskId)
            console.log(`任务 ${taskId} 已完成，停止轮询`)
          }
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error)
      }
    }, 2000) // 每2秒轮询一次

    // 存储轮询间隔ID以便后续清理
    return pollInterval
  }

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      
      // 3-5行基础高度，超过8行显示滚动条
      const baseHeight = 80 // 约3行高度
      const lineHeight = 24 // 每行高度
      const maxLines = 8 // 最大行数
      const maxHeight = baseHeight + (lineHeight * (maxLines - 3))
      
      if (scrollHeight <= maxHeight) {
        textareaRef.current.style.height = scrollHeight + 'px'
        textareaRef.current.style.overflowY = 'hidden'
      } else {
        textareaRef.current.style.height = maxHeight + 'px'
        textareaRef.current.style.overflowY = 'auto'
      }
    }
  }, [input])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSubmitting) return

    const apiKey = getApiKey()
    if (!apiKey) {
      setError('请先在设置中配置OpenAI API密钥')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // 收集vector store IDs（来自已上传的文件）
      const vectorStoreIds = attachedFiles
        .filter(file => file.vector_store_id)
        .map(file => file.vector_store_id!)

      // 创建研究任务
      const response = await deepResearchService.createTask({
        query: input,
        model: selectedModel,
        api_key: apiKey,
        files: attachedFiles.length > 0 ? attachedFiles : undefined,
        base_url: getBaseUrl(),
        enable_web_search: true,
        enable_code_interpreter: true,
        vector_store_ids: vectorStoreIds.length > 0 ? vectorStoreIds : undefined
      })

      // 添加任务到列表
      setTasks(prev => [response.task, ...prev])
      setSelectedTask(response.task.id)
      setInput('')
      setAttachedFiles([])

      // 订阅任务状态更新
      const pollInterval = subscribeToTaskUpdates(response.task.id)
      pollIntervalsRef.current.set(response.task.id, pollInterval)

    } catch (error) {
      console.error('创建深度研究任务失败:', error)
      setError(error instanceof Error ? error.message : '创建任务失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStopTask = async (taskId: string) => {
    try {
      await deepResearchService.stopTask(taskId)
      // WebSocket会自动更新状态，但也可以立即更新UI
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'failed' }
          : task
      ))
    } catch (error) {
      console.error('停止任务失败:', error)
      setError(error instanceof Error ? error.message : '停止任务失败')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const apiKey = getApiKey()
    if (!apiKey) {
      setError('请先在设置中配置OpenAI API密钥')
      return
    }

    setError(null)

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          return await deepResearchService.uploadFile(file, apiKey, getBaseUrl())
        } catch (error) {
          console.error(`上传文件 ${file.name} 失败:`, error)
          throw error
        }
      })

      const uploadedFiles = await Promise.all(uploadPromises)
      setAttachedFiles(prev => [...prev, ...uploadedFiles])
      
      console.log('文件上传成功:', uploadedFiles.map(f => f.name).join(', '))
    } catch (error) {
      console.error('文件上传失败:', error)
      setError(error instanceof Error ? error.message : '文件上传失败')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const currentTask = selectedTask ? tasks.find(t => t.id === selectedTask) : null

  // 如果选择了任务，显示任务详情
  if (currentTask) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        {/* 移动端头部导航 */}
        <div className="lg:hidden">
          <DeepResearchHeader 
            onMenuClick={handleMenuClick}
            onBackToChat={onBackToChat}
          />
        </div>
        
        {/* PC端任务详情 */}
        <div className="lg:block hidden py-8 px-4 flex-1">
          <div className="max-w-[min(1100px,90vw)] mx-auto h-full">
            {/* 任务详情容器 */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col">
              {/* 任务详情头部 */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <button
                      onClick={() => setSelectedTask(null)}
                      className="text-blue-600 hover:text-blue-700 text-sm mb-3 hover:underline transition-colors"
                    >
                      ← 返回任务列表
                    </button>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                      {currentTask.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      模型: {currentTask.model}
                    </p>
                  </div>
                  {(currentTask.status === 'running' || currentTask.status === 'warning') && (
                    <button
                      onClick={() => handleStopTask(currentTask.id)}
                      className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-xl text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      中止任务
                    </button>
                  )}
                </div>
              </div>

              {/* 任务状态显示 */}
              <div className="flex-1 p-6">
                {currentTask.status === 'running' ? (
                  <div className="flex items-center gap-3 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                    <span className="text-blue-900 dark:text-blue-100 font-medium text-lg">深度研究中...</span>
                  </div>
                ) : currentTask.status === 'warning' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-600 border-t-transparent" />
                      <span className="text-yellow-900 dark:text-yellow-100 font-medium text-lg">深度研究中（警告状态）</span>
                    </div>
                    {currentTask.warning_message && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                        <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">提示信息</h4>
                        <p className="text-yellow-700 dark:text-yellow-300 text-sm">{currentTask.warning_message}</p>
                      </div>
                    )}
                    {currentTask.result && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">研究结果（可能不完整）</h3>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentTask.result}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ) : currentTask.status === 'completed' ? (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">研究结果</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentTask.result}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                    <span className="text-red-900 dark:text-red-100 font-medium text-lg">研究任务已中止</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 移动端任务详情 */}
        <div className="lg:hidden flex flex-col flex-1 bg-gray-50 dark:bg-gray-900 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col">
            {/* 任务详情头部 */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-3 hover:underline transition-colors"
                  >
                    ← 返回任务列表
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {currentTask.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    模型: {currentTask.model}
                  </p>
                </div>
                {(currentTask.status === 'running' || currentTask.status === 'warning') && (
                  <button
                    onClick={() => handleStopTask(currentTask.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-xl text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    中止任务
                  </button>
                )}
              </div>
            </div>

            {/* 任务状态显示 */}
            <div className="flex-1 p-6">
              {currentTask.status === 'running' ? (
                <div className="flex items-center gap-3 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                  <span className="text-blue-900 dark:text-blue-100 font-medium text-lg">深度研究中...</span>
                </div>
              ) : currentTask.status === 'warning' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-600 border-t-transparent" />
                    <span className="text-yellow-900 dark:text-yellow-100 font-medium text-lg">深度研究中（警告状态）</span>
                  </div>
                  {currentTask.warning_message && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                      <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">提示信息</h4>
                      <p className="text-yellow-700 dark:text-yellow-300 text-sm">{currentTask.warning_message}</p>
                    </div>
                  )}
                  {currentTask.result && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">研究结果（可能不完整）</h3>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentTask.result}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ) : currentTask.status === 'completed' ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">研究结果</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {currentTask.result}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                  <span className="text-red-900 dark:text-red-100 font-medium text-lg">研究任务已中止</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 移动端侧边栏抽屉 */}
        <MobileDrawer isOpen={isSidebarOpen} onClose={handleCloseSidebar}>
          <ChatSidebar
            onSettingsClick={onSettingsClick || (() => {})}
            onLoginClick={onLoginClick || (() => {})}
            onModelMarketClick={onModelMarketClick}
            onPluginMarketClick={onPluginMarketClick}
            onDeepResearchClick={() => {}}
            onBackToChat={onBackToChat}
          />
        </MobileDrawer>
      </div>
    )
  }

  // 主页面视图
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 移动端头部导航 */}
      <div className="lg:hidden">
        <DeepResearchHeader 
          onMenuClick={handleMenuClick}
          onBackToChat={onBackToChat}
        />
      </div>
      
      {/* PC端头部和输入区域 */}
      <div className="lg:block hidden bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-[min(1100px,90vw)] mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            深度研究
          </h1>
          
          {/* 输入容器 */}
          <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 错误显示 */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    关闭
                  </button>
                </div>
              )}
              
              {/* 输入框 */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="请输入您想要深度研究的主题或问题..."
                  className="w-full p-4 border-0 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-600 resize-none transition-all duration-200"
                  rows={3}
                />
              </div>
              
              {/* 附加文件显示 */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-sm"
                    >
                      <span className="truncate max-w-32">{file.name}</span>
                      {file.vector_store_id && (
                        <span className="text-xs opacity-70">✓</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 底部控制区 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* 模型选择器 */}
                  <DeepResearchModelSelector
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                  />
                  
                  {/* 上传文件按钮 */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <PaperClipIcon className="w-4 h-4" />
                    上传文件
                  </button>
                </div>
                
                {/* 发送按钮 */}
                <button
                  type="submit"
                  disabled={!input.trim() || isSubmitting}
                  className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                    input.trim() && !isSubmitting
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span className="text-sm">创建中...</span>
                    </>
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 移动端输入区域 */}
      <div className="lg:hidden bg-gray-50 dark:bg-gray-900 p-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          深度研究
        </h1>
        
        {/* 输入容器 */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* 错误显示 */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  关闭
                </button>
              </div>
            )}
            
            {/* 输入框 */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="请输入您想要深度研究的主题或问题..."
                className="w-full p-4 border-0 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-600 resize-none transition-all duration-200"
                rows={3}
              />
            </div>
            
            {/* 附加文件显示 */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-sm"
                  >
                    <span className="truncate max-w-32">{file.name}</span>
                    {file.vector_store_id && (
                      <span className="text-xs opacity-70">✓</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 底部控制区 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* 模型选择器 */}
                <DeepResearchModelSelector
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                />
                
                {/* 上传文件按钮 */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <PaperClipIcon className="w-4 h-4" />
                  上传文件
                </button>
              </div>
              
              {/* 发送按钮 */}
              <button
                type="submit"
                disabled={!input.trim() || isSubmitting}
                className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                  input.trim() && !isSubmitting
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span className="text-sm">创建中...</span>
                  </>
                ) : (
                  <PaperAirplaneIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-900 px-4 pb-4 lg:px-4 lg:pb-8">
        <div className="lg:max-w-[min(1100px,90vw)] mx-auto h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <DeepResearchTaskList
            tasks={tasks}
            selectedTask={selectedTask}
            onTaskSelect={setSelectedTask}
            onStopTask={handleStopTask}
          />
        </div>
      </div>

      {/* 移动端侧边栏抽屉 */}
      <MobileDrawer isOpen={isSidebarOpen} onClose={handleCloseSidebar}>
        <ChatSidebar
          onSettingsClick={onSettingsClick || (() => {})}
          onLoginClick={onLoginClick || (() => {})}
          onModelMarketClick={onModelMarketClick}
          onPluginMarketClick={onPluginMarketClick}
          onDeepResearchClick={() => {}}
          onBackToChat={onBackToChat}
        />
      </MobileDrawer>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  )
}
