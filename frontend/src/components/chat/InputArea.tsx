'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, MicrophoneIcon, PhotoIcon, StopIcon, PlusIcon, WrenchScrewdriverIcon, XMarkIcon, CheckIcon, PaperClipIcon } from '@heroicons/react/24/outline'
import { MagnifyingGlassIcon, CubeIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import ModelSelector from '@/components/ui/ModelSelector'
import toast from 'react-hot-toast'

interface InputAreaProps {
  isWelcomeMode?: boolean
  onModelMarketClick?: () => void
}

interface Tool {
  id: string
  name: string
  icon: React.ComponentType<any>
  description: string
}

interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
}

const availableTools: Tool[] = [
  {
    id: 'search',
    name: '搜索',
    icon: MagnifyingGlassIcon,
    description: '网络搜索功能'
  },
  {
    id: 'vector',
    name: '向量',
    icon: CubeIcon,
    description: '向量数据库查询'
  }
]

export default function InputArea({ isWelcomeMode = false, onModelMarketClick }: InputAreaProps) {
  const [input, setInput] = useState('')
  const [selectedTools, setSelectedTools] = useState<Tool[]>([])
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [showTools, setShowTools] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { 
    sendMessage, 
    isLoading, 
    currentConversation,
    createNewConversation 
  } = useChatStore()
  
  const { settings } = useSettingsStore()

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])

  // 工具管理函数
  const toggleTool = (tool: Tool) => {
    const isSelected = selectedTools.some(t => t.id === tool.id)
    if (isSelected) {
      setSelectedTools(selectedTools.filter(t => t.id !== tool.id))
    } else {
      setSelectedTools([...selectedTools, tool])
    }
    setShowTools(false)
  }

  const removeTool = (toolId: string) => {
    setSelectedTools(selectedTools.filter(t => t.id !== toolId))
  }

  const removeFile = (fileId: string) => {
    setAttachedFiles(attachedFiles.filter(f => f.id !== fileId))
  }

  // 文件上传处理
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      Array.from(files).forEach(file => {
        const newFile: AttachedFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          size: file.size
        }
        setAttachedFiles(prev => [...prev, newFile])
      })
    }
    // 清空input以允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setShowTools(false)
  }

  // 触发文件选择
  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  // 触发图片上传
  const triggerImageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*'
      fileInputRef.current.click()
    }
  }

  // Google Drive 集成（占位符）
  const connectGoogleDrive = () => {
    toast.success('Google Drive 集成功能开发中...')
    setShowTools(false)
  }

  // OneDrive 集成（占位符）
  const connectOneDrive = () => {
    toast.success('OneDrive 集成功能开发中...')
    setShowTools(false)
  }

  // 录音功能
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      setMediaRecorder(recorder)
      setAudioChunks([])
      setIsRecording(true)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data])
        }
      }

      recorder.start()
    } catch (error) {
      toast.error('无法访问麦克风')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        // 这里可以处理音频文件
        toast.success('录音完成')
      }
    }
  }

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!input.trim() || isLoading) return

  const messageContent = input.trim()
  
  // 先清空输入，避免重复提交
  setInput('')
  setSelectedTools([])
  setAttachedFiles([])
  setShowTools(false)

  try {
    // sendMessage 内部已经处理创建新对话的逻辑，不需要手动调用 createNewConversation
    await sendMessage(messageContent)
  } catch (error: any) {
    console.error('发送消息失败:', error)
    toast.error(error.message || '发送消息失败')
  }
}

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // 检查是否有附加内容
  const hasAttachments = selectedTools.length > 0 || attachedFiles.length > 0

  // 欢迎模式（首页居中样式）
  if (isWelcomeMode) {
    return (
      <div className="w-full">
        <form onSubmit={handleSubmit} className="relative">
          {/* 主输入框容器 - 带动画过渡 */}
          <div className={`relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 ${
            hasAttachments ? 'pb-16' : ''
          }`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="询问任何问题..."
              className="w-full resize-none border-none rounded-3xl px-6 py-4 pl-14 pr-20 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-base leading-6"
              rows={1}
              disabled={isLoading}
              style={{ minHeight: '56px' }}
            />

            {/* 附加内容显示区域 - 在输入框内部 */}
            {hasAttachments && (
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-2 pt-3">
                  {/* 显示附加的文件 */}
                  {attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm border"
                    >
                      <PaperClipIcon className="w-4 h-4" />
                      <span className="truncate max-w-32">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* 显示附加的工具 */}
                  {selectedTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-sm border border-blue-200 dark:border-blue-800"
                    >
                      <tool.icon className="w-4 h-4" />
                      <span>{tool.name}</span>
                      <button
                        type="button"
                        onClick={() => removeTool(tool.id)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 左侧加号按钮 */}
            <div className="absolute left-4 top-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTools(!showTools)}
                  className={`p-2 rounded-full transition-colors ${
                    showTools
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  title="添加内容和工具"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>

                {/* 工具下拉菜单 */}
                {showTools && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowTools(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20">
                      <div className="p-3">
                        {/* 添加照片和文件部分 */}
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                            添加照片和文件
                          </div>
                          
                          <button
                            type="button"
                            onClick={triggerImageUpload}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <PhotoIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">添加照片</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                上传图片文件
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={triggerFileUpload}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <PaperClipIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">添加文件</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                上传其他文件
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={connectGoogleDrive}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FolderIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">从Google Drive中添加</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                从Google Drive选择文件
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={connectOneDrive}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FolderIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">从OneDrive中添加</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                从OneDrive选择文件
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* 分隔线 */}
                        <div className="border-t border-gray-200 dark:border-gray-600 my-3"></div>

                        {/* 工具部分 */}
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                            工具
                          </div>
                          {availableTools.map((tool) => {
                            const isSelected = selectedTools.some(t => t.id === tool.id)
                            return (
                              <button
                                key={tool.id}
                                type="button"
                                onClick={() => toggleTool(tool)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <tool.icon className="w-5 h-5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{tool.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {tool.description}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 右侧按钮组 */}
            <div className="absolute right-4 top-4 flex items-center gap-2">
              {/* 语音按钮 */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-full transition-colors ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title={isRecording ? '停止录音' : '开始录音'}
              >
                {isRecording ? (
                  <StopIcon className="w-4 h-4" />
                ) : (
                  <MicrophoneIcon className="w-4 h-4" />
                )}
              </button>

              {/* 发送按钮 */}
              {isLoading ? (
                <Button
                  type="button"
                  size="sm"
                  disabled
                  className="px-4 py-3 bg-gray-300 cursor-not-allowed rounded-full"
                >
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim()}
                  className={`px-4 py-3 rounded-full transition-colors ${
                    input.trim() 
                      ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </form>

        {/* 底部模型选择和提示文字 */}
        <div className="mt-4 flex items-center justify-center gap-4">
            <ModelSelector 
              onModelMarketClick={onModelMarketClick} 
              showDetailedInfo={false} // 欢迎模式下不显示详细信息
            />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {settings.thinkingMode && '思考模式已启用'}
          </div>
        </div>
      </div>
    )
  }

  // 原有的底部输入框样式（对话模式）
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="relative">
          {/* 主输入框容器 - 带动画过渡 */}
          <div className={`relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-sm transition-all duration-300 ${
            hasAttachments ? 'pb-14' : ''
          }`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="询问任何问题..."
              className="w-full resize-none border-none rounded-2xl px-4 py-3 pl-12 pr-16 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-sm"
              rows={1}
              disabled={isLoading}
              style={{ minHeight: '48px' }}
            />

            {/* 附加内容显示区域 - 在输入框内部 */}
            {hasAttachments && (
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-2 pt-3">
                  {/* 显示附加的文件 */}
                  {attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm border"
                    >
                      <PaperClipIcon className="w-4 h-4" />
                      <span className="truncate max-w-32">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* 显示附加的工具 */}
                  {selectedTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-sm border border-blue-200 dark:border-blue-800"
                    >
                      <tool.icon className="w-4 h-4" />
                      <span>{tool.name}</span>
                      <button
                        type="button"
                        onClick={() => removeTool(tool.id)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 左侧工具按钮 */}
            <div className="absolute left-2 top-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTools(!showTools)}
                  className={`p-2 rounded-full transition-colors ${
                    showTools
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  title="添加内容和工具"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>

                {/* 工具下拉菜单 */}
                {showTools && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowTools(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20">
                      <div className="p-3">
                        {/* 添加照片和文件部分 */}
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                            添加照片和文件
                          </div>
                          
                          <button
                            type="button"
                            onClick={triggerImageUpload}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <PhotoIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">添加照片</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                上传图片文件
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={triggerFileUpload}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <PaperClipIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">添加文件</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                上传其他文件
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={connectGoogleDrive}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FolderIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">从Google Drive中添加</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                从Google Drive选择文件
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={connectOneDrive}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FolderIcon className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">从OneDrive中添加</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                从OneDrive选择文件
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* 分隔线 */}
                        <div className="border-t border-gray-200 dark:border-gray-600 my-3"></div>

                        {/* 工具部分 */}
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                            工具
                          </div>
                          {availableTools.map((tool) => {
                            const isSelected = selectedTools.some(t => t.id === tool.id)
                            return (
                              <button
                                key={tool.id}
                                type="button"
                                onClick={() => toggleTool(tool)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <tool.icon className="w-5 h-5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{tool.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {tool.description}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 右侧按钮组 */}
            <div className="absolute right-3 top-3 flex items-center gap-2">
              {/* 语音按钮 */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-full transition-colors ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title={isRecording ? '停止录音' : '开始录音'}
              >
                {isRecording ? (
                  <StopIcon className="w-4 h-4" />
                ) : (
                  <MicrophoneIcon className="w-4 h-4" />
                )}
              </button>

              {/* 发送按钮 */}
              {isLoading ? (
                <Button
                  type="button"
                  size="sm"
                  disabled
                  className="px-4 py-3 bg-gray-300 cursor-not-allowed"
                >
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim()}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </form>

        {/* 当前模型显示 */}
        <div className="mt-2 flex items-center justify-center">
          <ModelSelector onModelMarketClick={onModelMarketClick} />
        </div>
      </div>
    </div>
  )
}