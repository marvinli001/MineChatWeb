'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ClipboardIcon, CheckIcon, SpeakerWaveIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { ChatMessage, ImageAttachment, FileAttachment } from '@/lib/types'
import { getFileIcon, formatFileSize, downloadFile } from '@/lib/fileUtils'
import { useSettingsStore } from '@/store/settingsStore'
import { useChatStore, useCurrentConversation } from '@/store/chatStore'
import { modelConfigService } from '@/services/modelConfigService'
import ThinkingChain from './ThinkingChain'
import TypewriterEffect from './TypewriterEffect'
import SearchSources from './SearchSources'
import CitationText from './CitationText'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'

interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
}

export default function MessageItem({ message, isLast }: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [currentModelIcon, setCurrentModelIcon] = useState<string | null>(null)
  const [isReasoningModel, setIsReasoningModel] = useState(false)
  const { settings } = useSettingsStore()
  const { regenerateLastMessage } = useChatStore()
  const currentConversation = useCurrentConversation()
  // 使用当前对话的loading状态
  const isLoading = currentConversation?.isLoading || false

  // 获取当前模型的icon和推理模型状态
  useEffect(() => {
    const loadModelIcon = async () => {
      if (settings.chatProvider && settings.chatModel) {
        const modelConfig = await modelConfigService.getModelConfig(settings.chatProvider, settings.chatModel)
        setCurrentModelIcon((modelConfig as any)?.icon || null)
        
        // 检测是否是推理模型
        const reasoningModels = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o1', 'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini']
        const isReasoning = reasoningModels.some(model => settings.chatModel.includes(model)) || settings.thinkingMode
        setIsReasoningModel(isReasoning)
      }
    }
    loadModelIcon()
  }, [settings.chatProvider, settings.chatModel, settings.thinkingMode])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('复制失败')
    }
  }

  const speakText = async (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'zh-CN'
      utterance.onend = () => setIsSpeaking(false)
      speechSynthesis.speak(utterance)
    } else {
      toast.error('您的浏览器不支持语音合成')
    }
  }

  const handleRegenerate = async () => {
    if (!isLast || message.role !== 'assistant') {
      toast.error('只能重新生成最后一条AI消息')
      return
    }

    if (isLoading || isRegenerating) {
      toast.error('正在生成中，请稍候...')
      return
    }

    try {
      setIsRegenerating(true)
      await regenerateLastMessage()
      toast.success('消息已重新生成')
    } catch (error: any) {
      console.error('重新生成失败:', error)
      toast.error(error.message || '重新生成失败，请稍后重试')
    } finally {
      setIsRegenerating(false)
    }
  }

  const renderThinkingContent = (content: string) => {
    // 解析thinking标签
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = thinkingRegex.exec(content)) !== null) {
      // 添加thinking标签前的内容
      if (match.index > lastIndex) {
        parts.push({
          type: 'content',
          text: content.slice(lastIndex, match.index)
        })
      }
      
      // 添加thinking内容
      parts.push({
        type: 'thinking',
        text: match[1].trim()
      })
      
      lastIndex = match.index + match[0].length
    }
    
    // 添加剩余内容
    if (lastIndex < content.length) {
      parts.push({
        type: 'content',
        text: content.slice(lastIndex)
      })
    }

    return parts
  }

  const isUser = message.role === 'user'
  const hasThinking = message.content.includes('<thinking>')
  const contentParts = hasThinking ? renderThinkingContent(message.content) : [{ type: 'content', text: message.content }]

  return (
    <motion.div
      className="mb-6 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {isUser ? (
        // 用户消息 - 右侧对齐，暗灰色气泡，默认markdown渲染
        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="max-w-[70%] lg:max-w-[70%] message-bubble user sm:max-w-[92%]">
            {/* 图片缩略图 - 显示在消息上方 */}
            {message.images && message.images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 justify-end">
                {message.images.map((image) => (
                  <div
                    key={image.id}
                    className="relative group cursor-pointer"
                    onClick={() => {
                      // 创建临时的图片预览窗口
                      const modal = document.createElement('div')
                      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4'
                      modal.innerHTML = `
                        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
                        <div class="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl">
                          <button class="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors z-10">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <img src="data:${image.mime_type};base64,${image.data}" alt="${image.filename}" class="max-w-full max-h-[80vh] object-contain rounded-lg" />
                          <div class="p-4 border-t border-gray-200 dark:border-gray-700">
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                              <p class="font-medium truncate">${image.filename}</p>
                              <p>大小: ${(image.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                        </div>
                      `
                      document.body.appendChild(modal)
                      
                      const closeModal = () => {
                        document.body.removeChild(modal)
                      }
                      
                      modal.addEventListener('click', (e) => {
                        if (e.target === modal || e.target === modal.firstElementChild) {
                          closeModal()
                        }
                      })
                      
                      modal.querySelector('button')?.addEventListener('click', closeModal)
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${image.mime_type};base64,${image.data}`}
                      alt={image.filename}
                      className="w-12 h-12 object-cover rounded-lg border-2 border-white shadow-lg"
                    />
                    {/* 文件名提示 */}
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {image.filename}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* 文件附件 - 显示在消息上方 */}
            {message.files && message.files.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 justify-end">
                {message.files.map((file) => (
                  <div
                    key={file.id}
                    className="relative group max-w-xs"
                    title={`${file.filename} - ${formatFileSize(file.size)}`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg border">
                      <span className="text-lg">{getFileIcon(file.filename)}</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">{file.filename}</span>
                        <div className="flex items-center gap-2 text-xs opacity-70">
                          <span>{formatFileSize(file.size)}</span>
                          {file.status === 'completed' && (
                            <span className="text-green-400">✓ 已处理</span>
                          )}
                          {file.status === 'error' && (
                            <span className="text-red-400">✗ 处理失败</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-gray-700 text-white rounded-2xl px-4 py-3">
              <div className="prose prose-sm prose-invert max-w-none text-sm lg:text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => (
                      <p className="mb-1 last:mb-0" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="mb-1 ml-4" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="mb-1 ml-4" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="mb-0" {...props} />
                    ),
                    code: ({ node, ...props }) => {
                      const { inline, ...restProps } = props as any
                      return inline ? (
                        <code
                          className="bg-gray-600 px-1 py-0.5 rounded text-xs"
                          {...restProps}
                        />
                      ) : (
                        <code {...restProps} />
                      )
                    },
                    pre: ({ node, ...props }) => (
                      <pre
                        className="bg-gray-600 rounded p-2 overflow-x-auto text-xs mt-2"
                        {...props}
                      />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        // AI消息 - 左侧对齐，OpenAI风格
        <motion.div
          className="flex gap-3 group"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* AI头像 - 使用模型的icon */}
          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden lg:w-8 lg:h-8">
            {currentModelIcon ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={currentModelIcon} 
                  alt="AI Model" 
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    // 如果图片加载失败，显示默认emoji
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling!.textContent = '🤖'
                  }}
                />
                <span className="text-sm hidden">🤖</span>
              </>
            ) : (
              <span className="text-sm">🤖</span>
            )}
          </div>

          {/* 消息内容 */}
          <div className="flex-1 min-w-0 message-bubble assistant sm:max-w-[92%]">
            {/* 显示推理链（推理模型的消息都显示思维链） */}
            {isReasoningModel && message.thinking_start_time && (
              <ThinkingChain 
                reasoning={message.reasoning || ''} 
                startTime={message.thinking_start_time}
                isComplete={!isLoading || !isLast}
                messageId={message.id}
                className="mb-4" 
              />
            )}
            
            {/* 渲染AI消息内容（支持引用） */}
            {message.citations ? (
              <CitationText 
                text={message.content} 
                citations={message.citations}
              />
            ) : (
              <TypewriterEffect
                text={message.content}
                isComplete={!isLoading || !isLast}
                showWaitingEffect={
                  isLast && 
                  isLoading && 
                  !message.content && 
                  !isReasoningModel
                }
              />
            )}
            
            {/* 显示生成的文件（从Code Interpreter）*/}
            {message.files && message.files.some(f => f.processing_result?.generated_files?.length > 0) && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  📎 生成的文件
                </h4>
                <div className="space-y-2">
                  {message.files
                    .filter(f => f.processing_result?.generated_files?.length > 0)
                    .map(file => file.processing_result!.generated_files!.map((genFile: any, index: number) => (
                      <div 
                        key={`${file.id}-${index}`}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFileIcon(genFile.filename || 'file')}</span>
                          <div>
                            <div className="text-sm font-medium">{genFile.filename || '未命名文件'}</div>
                            {genFile.size && (
                              <div className="text-xs text-gray-500">
                                {formatFileSize(genFile.size)}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              if (genFile.file_id || genFile.container_file_id) {
                                await downloadFile(
                                  genFile.file_id || genFile.container_file_id,
                                  genFile.filename || 'download',
                                  genFile.container_id
                                )
                                toast.success('文件下载成功')
                              } else {
                                toast.error('缺少文件ID，无法下载')
                              }
                            } catch (error: any) {
                              toast.error('下载文件失败: ' + error.message)
                            }
                          }}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          下载
                        </button>
                      </div>
                    )))}
                </div>
              </div>
            )}

            {/* 显示搜索来源 */}
            {message.sources && message.sources.length > 0 && (
              <SearchSources sources={message.sources} />
            )}
            
            {/* 处理旧的thinking标签格式兼容性 */}
            {hasThinking && contentParts.map((part, index) => {
              if (part.type === 'thinking') {
                return (
                  <details key={index} className="my-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border-l-4 border-yellow-400">
                    <summary className="cursor-pointer font-medium text-yellow-600 dark:text-yellow-400 mb-2">
                      💭 思考过程
                    </summary>
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {part.text}
                      </ReactMarkdown>
                    </div>
                  </details>
                )
              }
              return null
            })}

            {/* 操作按钮 - 只在AI消息上显示，hover时出现 */}
            <motion.div
              className="flex items-center gap-2 mt-2"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <motion.button
                onClick={() => copyToClipboard(message.content)}
                className="p-1 rounded"
                title="复制"
                whileHover={{
                  backgroundColor: "rgba(0, 0, 0, 0.05)",
                  scale: 1.1,
                  transition: { duration: 0.15 }
                }}
                whileTap={{ scale: 0.95 }}
              >
                {copied ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <CheckIcon className="w-4 h-4 text-green-600" />
                  </motion.div>
                ) : (
                  <ClipboardIcon className="w-4 h-4 text-gray-500" />
                )}
              </motion.button>
              <motion.button
                onClick={() => speakText(message.content)}
                className={`p-1 rounded ${
                  isSpeaking ? 'text-blue-600' : 'text-gray-500'
                }`}
                title="朗读"
                whileHover={{
                  backgroundColor: "rgba(0, 0, 0, 0.05)",
                  scale: 1.1,
                  transition: { duration: 0.15 }
                }}
                whileTap={{ scale: 0.95 }}
                animate={isSpeaking ? {
                  scale: [1, 1.1, 1],
                  transition: { duration: 0.5, repeat: Infinity }
                } : {}}
              >
                <SpeakerWaveIcon className="w-4 h-4" />
              </motion.button>
              {/* 重新生成按钮 - 只在最后一条AI消息上显示 */}
              {isLast && (
                <motion.button
                  onClick={handleRegenerate}
                  disabled={isLoading || isRegenerating}
                  className={`p-1 rounded ${
                    isRegenerating ? 'text-blue-600' : 'text-gray-500'
                  } ${(isLoading || isRegenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="重新生成"
                  whileHover={!isLoading && !isRegenerating ? {
                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                    scale: 1.1,
                    transition: { duration: 0.15 }
                  } : {}}
                  whileTap={!isLoading && !isRegenerating ? { scale: 0.95 } : {}}
                  animate={isRegenerating ? {
                    rotate: 360,
                    transition: { duration: 1, repeat: Infinity, ease: "linear" }
                  } : {}}
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
