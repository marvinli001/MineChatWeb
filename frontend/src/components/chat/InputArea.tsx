'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, MicrophoneIcon, PhotoIcon, StopIcon, PlusIcon, WrenchScrewdriverIcon, XMarkIcon, CheckIcon, PaperClipIcon, EyeIcon } from '@heroicons/react/24/outline'
import { MagnifyingGlassIcon, CubeIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useChatStore, useCurrentConversation } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import ModelSelector from '@/components/ui/ModelSelector'
import ThinkingBudgetButton from '@/components/ui/ThinkingBudgetButton'
import { ThinkingBudget, ImageAttachment } from '@/lib/types'
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

interface ImagePreviewModalProps {
  image: ImageAttachment
  onClose: () => void
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

// 图片预览模态框组件
function ImagePreviewModal({ image, onClose }: ImagePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 玻璃蒙版背景 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      
      {/* 图片容器 */}
      <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl animate-in zoom-in-95 duration-200">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors z-10"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        
        {/* 图片 */}
        <img
          src={`data:${image.mime_type};base64,${image.data}`}
          alt={image.filename}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        
        {/* 图片信息 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium truncate">{image.filename}</p>
            <p>大小: {(image.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InputArea({ isWelcomeMode = false, onModelMarketClick }: InputAreaProps) {
  const [input, setInput] = useState('')
  const [selectedTools, setSelectedTools] = useState<Tool[]>([])
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [showTools, setShowTools] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)
  
  const { 
    sendMessage, 
    isLoading, 
    createNewConversation 
  } = useChatStore()
  
  const currentConversation = useCurrentConversation()
  const { settings, updateSettings } = useSettingsStore()

  // 检查是否为GPT-5系列模型
  const isGPT5Model = (model: string): boolean => {
    const gpt5Models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest']
    return gpt5Models.includes(model)
  }

  // 检查当前选择的模型是否支持thinking mode
  const showThinkingToggle = (): boolean => {
    if (!settings.chatModel || !settings.chatProvider) return false
    
    // 对于OpenAI，只有GPT-5系列支持thinking mode
    if (settings.chatProvider === 'openai') {
      return isGPT5Model(settings.chatModel)
    }
    
    return false
  }

  // 自动调整文本框高度，限制最大高度（统一两种模式）
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      
      // 统一计算最大高度：基础高度 + 8行内容
      const baseHeight = 56 // 基础最小高度
      const lineHeight = 24 // 每行大约24px（统一行高）
      const maxLines = 8 // 最多显示8行
      const maxHeight = baseHeight + (lineHeight * (maxLines - 1))
      
      if (scrollHeight <= maxHeight) {
        textareaRef.current.style.height = scrollHeight + 'px'
        textareaRef.current.style.overflowY = 'hidden'
      } else {
        textareaRef.current.style.height = maxHeight + 'px'
        textareaRef.current.style.overflowY = 'auto'
      }
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

  const removeImage = (imageId: string) => {
    setAttachedImages(attachedImages.filter(img => img.id !== imageId))
  }

  // 图片上传到后端
  const uploadImages = async (files: File[]): Promise<ImageAttachment[]> => {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file) // 字段名必须是 'files' 与后端一致
    })

    try {
      const response = await fetch('/api/v1/image/upload', {
        method: 'POST',
        body: formData,
        // 不设置 Content-Type，让浏览器自动设置 multipart/form-data
      })

      if (!response.ok) {
        try {
          const errorData = await response.json()
          // 提取结构化错误信息
          const errorMessage = errorData.detail?.message || errorData.message || errorData.detail || '图片上传失败'
          throw new Error(errorMessage)
        } catch (parseError) {
          // 如果无法解析JSON，使用状态码错误信息
          throw new Error(`图片上传失败 (${response.status})`)
        }
      }

      const result = await response.json()
      
      // 根据新的响应格式解析
      const images = result.data?.images || result.images || []
      return images.map((img: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        filename: img.filename,
        mime_type: img.mime_type,
        data: img.data,
        size: img.size
      }))
    } catch (error) {
      console.error('图片上传失败:', error)
      // 确保抛出的是Error对象，不是其他类型
      if (error instanceof Error) {
        throw error
      } else {
        throw new Error(String(error) || '图片上传失败')
      }
    }
  }

  // 处理图片文件
  const handleImageFiles = async (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    const nonImageFiles = files.filter(file => !file.type.startsWith('image/'))
    
    // 验证图片格式
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    const validImageFiles = imageFiles.filter(file => supportedFormats.includes(file.type))
    const invalidFiles = imageFiles.filter(file => !supportedFormats.includes(file.type))
    
    // 验证文件大小
    const MAX_SIZE = 15 * 1024 * 1024 // 15MB
    const oversizedFiles = validImageFiles.filter(file => file.size > MAX_SIZE)
    const validSizeFiles = validImageFiles.filter(file => file.size <= MAX_SIZE)
    
    // 显示错误提示
    if (invalidFiles.length > 0) {
      toast.error(`不支持的图片格式: ${invalidFiles.map(f => f.name).join(', ')}。支持的格式: JPG, PNG, WebP, GIF`)
    }
    
    if (oversizedFiles.length > 0) {
      toast.error(`文件过大: ${oversizedFiles.map(f => f.name).join(', ')}。最大支持15MB`)
    }
    
    // 处理非图片文件
    nonImageFiles.forEach(file => {
      const newFile: AttachedFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size
      }
      setAttachedFiles(prev => [...prev, newFile])
    })
    
    // 上传有效的图片文件
    if (validSizeFiles.length > 0) {
      try {
        toast.loading('正在上传图片...', { id: 'upload-images' })
        const uploadedImages = await uploadImages(validSizeFiles)
        setAttachedImages(prev => [...prev, ...uploadedImages])
        toast.success(`成功上传 ${uploadedImages.length} 张图片`, { id: 'upload-images' })
      } catch (error: any) {
        toast.error(error.message || '图片上传失败', { id: 'upload-images' })
      }
    }
  }

  // 文件上传处理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      await handleImageFiles(Array.from(files))
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

  // 拖拽处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCountRef.current = 0

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await handleImageFiles(files)
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
  if ((!input.trim() && attachedImages.length === 0) || isLoading) return

  const messageContent = input.trim()
  const messagImages = [...attachedImages]
  
  // 先清空输入，避免重复提交
  setInput('')
  setSelectedTools([])
  setAttachedFiles([])
  setAttachedImages([])
  setShowTools(false)

  try {
    // sendMessage 内部已经处理创建新对话的逻辑，不需要手动调用 createNewConversation
    await sendMessage(messageContent, messagImages.length > 0 ? messagImages : undefined)
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
  const hasAttachments = selectedTools.length > 0 || attachedFiles.length > 0 || attachedImages.length > 0

  // 欢迎模式（首页居中样式）
  if (isWelcomeMode) {
    return (
      <div className="w-full">
        <form 
          onSubmit={handleSubmit} 
          className="relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* 拖拽蒙版 */}
          {isDragging && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm animate-in fade-in-0 duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border-2 border-dashed border-blue-500 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="text-center">
                  <PhotoIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                    拖入图片到消息
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    支持 JPG, PNG, WebP, GIF 格式
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 两行一体式容器 - 固定宽度作为默认形态 */}
          <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 max-w-[min(1100px,90vw)] mx-auto">
            
            {/* 第一行：输入框 */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="询问任何问题..."
                className="w-full resize-none border-none rounded-none px-6 py-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-base leading-6"
                rows={1}
                disabled={isLoading}
                style={{ minHeight: '56px', lineHeight: '24px' }}
              />
            </div>

            {/* 第二行：按钮组 + 工具 Chips + 右侧操作按钮 */}
            <div className="relative flex items-center gap-2 px-6 py-3 min-h-[56px]">
              {/* 左侧：按钮组 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTools(!showTools)}
                    className={`p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
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
                        className="fixed inset-0 z-10 animate-in fade-in-0 duration-200" 
                        onClick={() => setShowTools(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                        <div className="p-3">
                          {/* 添加照片和文件部分 */}
                          <div className="mb-3 animate-in fade-in-0 slide-in-from-left-1 duration-300 delay-75">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                              添加照片和文件
                            </div>
                            
                            <button
                              type="button"
                              onClick={triggerImageUpload}
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                          <div className="animate-in fade-in-0 slide-in-from-left-1 duration-300 delay-150">
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
                                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                    isSelected 
                                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 scale-[1.02]' 
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1'
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
                
                {/* 思考预算按钮 - 仅在思考模式启用时显示 */}
                {showThinkingToggle() && (
                  <ThinkingBudgetButton
                    budget={settings.reasoning}
                    onChange={(budget) => updateSettings({ reasoning: budget })}
                  />
                )}
              </div>

              {/* 中间：工具 Chips - flex换行处理溢出 */}
              {hasAttachments && (
                <div className="flex flex-wrap gap-2 flex-1 min-w-0 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                  {/* 显示附加的图片 */}
                  {attachedImages.map((image, index) => (
                    <div
                      key={image.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 rounded-full text-sm border border-green-200 dark:border-green-800 animate-in fade-in-0 slide-in-from-left-2 duration-200 hover:scale-105 transition-all cursor-pointer"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => setPreviewImage(image)}
                    >
                      <PhotoIcon className="w-4 h-4" />
                      <span className="truncate max-w-24">{image.filename}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeImage(image.id)
                        }}
                        className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition-all duration-200 hover:scale-110 hover:rotate-90"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* 显示附加的文件 */}
                  {attachedFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm border animate-in fade-in-0 slide-in-from-left-2 duration-200 hover:scale-105 transition-all"
                      style={{ animationDelay: `${(attachedImages.length + index) * 50}ms` }}
                    >
                      <PaperClipIcon className="w-4 h-4" />
                      <span className="truncate max-w-32">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5 transition-all duration-200 hover:scale-110 hover:rotate-90"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* 显示附加的工具 */}
                  {selectedTools.map((tool, index) => (
                    <div
                      key={tool.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-sm border border-blue-200 dark:border-blue-800 animate-in fade-in-0 slide-in-from-left-2 duration-200 hover:scale-105 transition-all"
                      style={{ animationDelay: `${(attachedImages.length + attachedFiles.length + index) * 50}ms` }}
                    >
                      <tool.icon className="w-4 h-4" />
                      <span>{tool.name}</span>
                      <button
                        type="button"
                        onClick={() => removeTool(tool.id)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-all duration-200 hover:scale-110 hover:rotate-90"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 右侧操作按钮 - 绝对定位在右下角 */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                {/* 语音按钮 */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse hover:bg-red-600' 
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={isRecording ? '停止录音' : '开始录音'}
                >
                  {isRecording ? (
                    <StopIcon className="w-4 h-4 transition-transform duration-200" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
                  )}
                </button>

                {/* 发送按钮 */}
                {isLoading ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    className="px-4 py-3 bg-gray-300 cursor-not-allowed rounded-full opacity-50"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!input.trim()}
                    className={`px-4 py-3 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                      input.trim() 
                        ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 hover:shadow-lg' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <PaperAirplaneIcon className="w-4 h-4 transition-transform duration-200 hover:translate-x-0.5" />
                  </Button>
                )}
              </div>
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
        </div>
      </div>
    )
  }

  // 对话模式输入框样式（与欢迎页保持一致）
  return (
    <div className="bg-white dark:bg-gray-900 py-4">
      <div className="max-w-[min(1100px,90vw)] mx-auto px-4">
        <form onSubmit={handleSubmit} className="relative">
          {/* 两行一体式容器 - 与欢迎页样式保持一致 */}
          <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300">
            
            {/* 第一行：输入框 */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="询问任何问题..."
                className="w-full resize-none border-none rounded-none px-6 py-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-base leading-6"
                rows={1}
                disabled={isLoading}
                style={{ minHeight: '56px', lineHeight: '24px' }}
              />
            </div>

            {/* 第二行：按钮组 + 工具 Chips + 右侧操作按钮 */}
            <div className="relative flex items-center gap-2 px-6 py-3 min-h-[56px]">
              {/* 左侧：按钮组 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTools(!showTools)}
                    className={`p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
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
                        className="fixed inset-0 z-10 animate-in fade-in-0 duration-200" 
                        onClick={() => setShowTools(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                        <div className="p-3">
                          {/* 添加照片和文件部分 */}
                          <div className="mb-3 animate-in fade-in-0 slide-in-from-left-1 duration-300 delay-75">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
                              添加照片和文件
                            </div>
                            
                            <button
                              type="button"
                              onClick={triggerImageUpload}
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
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
                          <div className="animate-in fade-in-0 slide-in-from-left-1 duration-300 delay-150">
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
                                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                                    isSelected 
                                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 scale-[1.02]' 
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1'
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
                
                {/* 思考预算按钮 - 仅在思考模式启用时显示 */}
                {showThinkingToggle() && (
                  <ThinkingBudgetButton
                    budget={settings.reasoning}
                    onChange={(budget) => updateSettings({ reasoning: budget })}
                  />
                )}
              </div>

              {/* 中间：工具 Chips - flex换行处理溢出 */}
              {hasAttachments && (
                <div className="flex flex-wrap gap-2 flex-1 min-w-0 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                  {/* 显示附加的图片 */}
                  {attachedImages.map((image, index) => (
                    <div
                      key={image.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 rounded-full text-sm border border-green-200 dark:border-green-800 animate-in fade-in-0 slide-in-from-left-2 duration-200 hover:scale-105 transition-all cursor-pointer"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => setPreviewImage(image)}
                    >
                      <PhotoIcon className="w-4 h-4" />
                      <span className="truncate max-w-24">{image.filename}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeImage(image.id)
                        }}
                        className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition-all duration-200 hover:scale-110 hover:rotate-90"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* 显示附加的文件 */}
                  {attachedFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm border animate-in fade-in-0 slide-in-from-left-2 duration-200 hover:scale-105 transition-all"
                      style={{ animationDelay: `${(attachedImages.length + index) * 50}ms` }}
                    >
                      <PaperClipIcon className="w-4 h-4" />
                      <span className="truncate max-w-32">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5 transition-all duration-200 hover:scale-110 hover:rotate-90"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* 显示附加的工具 */}
                  {selectedTools.map((tool, index) => (
                    <div
                      key={tool.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-sm border border-blue-200 dark:border-blue-800 animate-in fade-in-0 slide-in-from-left-2 duration-200 hover:scale-105 transition-all"
                      style={{ animationDelay: `${(attachedImages.length + attachedFiles.length + index) * 50}ms` }}
                    >
                      <tool.icon className="w-4 h-4" />
                      <span>{tool.name}</span>
                      <button
                        type="button"
                        onClick={() => removeTool(tool.id)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-all duration-200 hover:scale-110 hover:rotate-90"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 右侧操作按钮 - 绝对定位在右下角 */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
                {/* 语音按钮 */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse hover:bg-red-600' 
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={isRecording ? '停止录音' : '开始录音'}
                >
                  {isRecording ? (
                    <StopIcon className="w-4 h-4 transition-transform duration-200" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
                  )}
                </button>

                {/* 发送按钮 */}
                {isLoading ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    className="px-4 py-3 bg-gray-300 cursor-not-allowed rounded-full opacity-50"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!input.trim()}
                    className={`px-4 py-3 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                      input.trim() 
                        ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 hover:shadow-lg' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <PaperAirplaneIcon className="w-4 h-4 transition-transform duration-200 hover:translate-x-0.5" />
                  </Button>
                )}
              </div>
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
        <div className="mt-2 flex items-center justify-center gap-4">
          <ModelSelector onModelMarketClick={onModelMarketClick} />
        </div>

        {/* 图片预览模态框 */}
        {previewImage && (
          <ImagePreviewModal 
            image={previewImage} 
            onClose={() => setPreviewImage(null)} 
          />
        )}
      </div>
    </div>
  )
}