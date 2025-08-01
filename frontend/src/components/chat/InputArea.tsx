'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, MicrophoneIcon, PhotoIcon, StopIcon, PlusIcon, WrenchScrewdriverIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { MagnifyingGlassIcon, CubeIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import ModelSelector from '@/components/ui/ModelSelector'
import toast from 'react-hot-toast'

interface InputAreaProps {
  isWelcomeMode?: boolean
}

interface Tool {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
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

export default function InputArea({ isWelcomeMode = false }: InputAreaProps) {
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [selectedTools, setSelectedTools] = useState<Tool[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const { sendMessage, isLoading, stopGeneration } = useChatStore()
  const { settings } = useSettingsStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // 检查是否配置了AI提供商
    if (!settings.chatProvider || !settings.chatModel) {
      toast.error('请先在设置中配置AI模型')
      return
    }

    const message = input.trim()
    setInput('')
    
    try {
      await sendMessage(message)
    } catch (error) {
      toast.error('发送消息失败')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const toggleTool = (tool: Tool) => {
    setSelectedTools(prev => {
      const isSelected = prev.some(t => t.id === tool.id)
      if (isSelected) {
        return prev.filter(t => t.id !== tool.id)
      } else {
        return [...prev, tool]
      }
    })
    setShowTools(false)
  }

  const removeTool = (toolId: string) => {
    setSelectedTools(prev => prev.filter(t => t.id !== toolId))
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      
      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' })
        await handleVoiceInput(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      toast.success('开始录音...')
    } catch (error) {
      toast.error('无法访问麦克风')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleVoiceInput = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob)
      
      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      setInput(data.transcript)
      toast.success('语音转录完成')
    } catch (error) {
      toast.error('语音转录失败')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    toast('图片功能开发中...')
  }

  // 欢迎模式的样式 - 类似 OpenAI ChatGPT
  if (isWelcomeMode) {
    return (
      <div className="w-full">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200">
            {/* 工具泡泡显示区域 */}
            {selectedTools.length > 0 && (
              <div className="absolute bottom-full left-4 mb-2 flex gap-2">
                {selectedTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-xs border border-blue-200 dark:border-blue-800"
                  >
                    <tool.icon className="w-3 h-3" />
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
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="询问任何问题..."
              className="w-full resize-none border-none rounded-2xl px-4 py-4 pl-12 pr-16 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-base"
              rows={1}
              disabled={isLoading}
              style={{ minHeight: '56px' }}
            />
            
            {/* 左侧工具按钮 */}
            <div className="absolute left-3 bottom-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTools(!showTools)}
                  className={`p-2 rounded-full transition-colors ${
                    selectedTools.length > 0 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  title="工具"
                >
                  <WrenchScrewdriverIcon className="w-4 h-4" />
                </button>

                {/* 工具下拉菜单 */}
                {showTools && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowTools(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                      <div className="p-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 font-medium">
                          选择工具
                        </div>
                        {availableTools.map((tool) => {
                          const isSelected = selectedTools.some(t => t.id === tool.id)
                          return (
                            <button
                              key={tool.id}
                              onClick={() => toggleTool(tool)}
                              className={`w-full flex items-center gap-3 px-2 py-2 text-left text-sm rounded transition-colors ${
                                isSelected 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <tool.icon className="w-4 h-4" />
                              <div>
                                <div className="font-medium">{tool.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {tool.description}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 右侧按钮组 */}
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              {/* 语音和图片按钮 */}
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
              
              <label className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
                <PhotoIcon className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {/* 发送按钮 */}
              {isLoading ? (
                <Button
                  type="button"
                  onClick={stopGeneration}
                  variant="outline"
                  size="sm"
                  className="p-2 text-red-600 border-red-300 hover:bg-red-50 rounded-full"
                >
                  <StopIcon className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!input.trim()}
                  size="sm"
                  className={`p-2 rounded-full transition-all ${
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
        </form>

        {/* 底部模型选择和提示文字 */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <ModelSelector />
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
          {/* 工具泡泡显示区域 */}
          {selectedTools.length > 0 && (
            <div className="absolute bottom-full left-12 mb-2 flex gap-2">
              {selectedTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-full text-xs border border-blue-200 dark:border-blue-800"
                >
                  <tool.icon className="w-3 h-3" />
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
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的消息... (Shift+Enter换行)"
                className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pl-12 pr-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                disabled={isLoading}
              />
              
              {/* 左侧工具按钮 */}
              <div className="absolute left-2 bottom-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTools(!showTools)}
                    className={`p-2 rounded-full transition-colors ${
                      selectedTools.length > 0 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                    title="工具"
                  >
                    <WrenchScrewdriverIcon className="w-4 h-4" />
                  </button>

                  {/* 工具下拉菜单 */}
                  {showTools && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowTools(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                        <div className="p-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 font-medium">
                            选择工具
                          </div>
                          {availableTools.map((tool) => {
                            const isSelected = selectedTools.some(t => t.id === tool.id)
                            return (
                              <button
                                key={tool.id}
                                onClick={() => toggleTool(tool)}
                                className={`w-full flex items-center gap-3 px-2 py-2 text-left text-sm rounded transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <tool.icon className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">{tool.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {tool.description}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 右侧语音和图片按钮 */}
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
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
                
                <label className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
                  <PhotoIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {isLoading ? (
              <Button
                type="button"
                onClick={stopGeneration}
                variant="outline"
                className="px-4 py-3 text-red-600 border-red-300 hover:bg-red-50"
              >
                <StopIcon className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>

        {/* 当前模型显示 */}
        <div className="mt-2 flex items-center justify-center">
          <ModelSelector />
        </div>
      </div>
    </div>
  )
}