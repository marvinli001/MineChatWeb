'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, PaperClipIcon, StopIcon } from '@heroicons/react/24/outline'
import DeepResearchModelSelector from './DeepResearchModelSelector'
import DeepResearchTaskList from './DeepResearchTaskList'
import DeepResearchHeader from './DeepResearchHeader'
import MobileDrawer from '../chat/MobileDrawer'
import ChatSidebar from '../chat/ChatSidebar'

export interface DeepResearchTask {
  id: string
  title: string
  query: string
  model: string
  status: 'running' | 'completed' | 'failed'
  created_at: string
  result?: string
  files?: File[]
}

interface DeepResearchPageProps {
  onBackToChat?: () => void
  onSettingsClick?: () => void
  onLoginClick?: () => void
  onModelMarketClick?: () => void
}

export default function DeepResearchPage({ onBackToChat, onSettingsClick, onLoginClick, onModelMarketClick }: DeepResearchPageProps) {
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState('o3-deep-research')
  const [tasks, setTasks] = useState<DeepResearchTask[]>([])
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleMenuClick = () => {
    setIsSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const newTask: DeepResearchTask = {
      id: Date.now().toString(),
      title: input.length > 50 ? input.substring(0, 50) + '...' : input,
      query: input,
      model: selectedModel,
      status: 'running',
      created_at: new Date().toISOString(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    }

    setTasks(prev => [newTask, ...prev])
    setSelectedTask(newTask.id)
    setInput('')
    setAttachedFiles([])

    // 模拟异步研究过程
    setTimeout(() => {
      setTasks(prev => prev.map(task => 
        task.id === newTask.id 
          ? { ...task, status: 'completed', result: '深度研究结果示例...' }
          : task
      ))
    }, 5000)
  }

  const handleStopTask = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: 'failed' }
        : task
    ))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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
                  {currentTask.status === 'running' && (
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
                ) : currentTask.status === 'completed' ? (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">研究结果</h3>
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {currentTask.result}
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
        <div className="lg:hidden flex flex-col flex-1">
          {/* 任务详情头部 */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-blue-600 hover:text-blue-700 text-sm mb-2"
                >
                  ← 返回任务列表
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {currentTask.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  模型: {currentTask.model}
                </p>
              </div>
              {currentTask.status === 'running' && (
                <button
                  onClick={() => handleStopTask(currentTask.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full text-sm hover:bg-red-200 dark:hover:bg-red-900/50"
                >
                  中止
                </button>
              )}
            </div>
          </div>

          {/* 任务状态显示 */}
          <div className="flex-1 p-4 bg-white dark:bg-gray-900">
            {currentTask.status === 'running' ? (
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
                <span className="text-blue-900 dark:text-blue-100 font-medium">深度研究中...</span>
              </div>
            ) : currentTask.status === 'completed' ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">研究结果</h3>
                <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {currentTask.result}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <span className="text-red-900 dark:text-red-100">研究任务已中止</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 移动端侧边栏抽屉 */}
        <MobileDrawer isOpen={isSidebarOpen} onClose={handleCloseSidebar}>
          <ChatSidebar 
            onSettingsClick={onSettingsClick || (() => {})}
            onLoginClick={onLoginClick || (() => {})}
            onModelMarketClick={onModelMarketClick}
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
              {/* 输入框 */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="请输入您想要深度研究的主题或问题..."
                  className="w-full p-4 border-0 rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all duration-200"
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
                  disabled={!input.trim()}
                  className={`px-4 py-2 rounded-xl transition-colors ${
                    input.trim()
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 移动端输入区域 */}
      <div className="lg:hidden p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          深度研究
        </h1>
        
        {/* 输入区域 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 输入框 */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="请输入您想要深度研究的主题或问题..."
              className="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
              disabled={!input.trim()}
              className={`px-4 py-2 rounded-lg transition-colors ${
                input.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-900 lg:px-4 lg:pb-8">
        <div className="lg:max-w-[min(1100px,90vw)] lg:mx-auto h-full lg:bg-white lg:dark:bg-gray-800 lg:border lg:border-gray-200 lg:dark:border-gray-600 lg:rounded-3xl lg:shadow-lg lg:hover:shadow-xl lg:transition-all lg:duration-300 lg:overflow-hidden">
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