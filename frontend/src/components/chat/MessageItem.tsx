'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ClipboardIcon, CheckIcon, SpeakerWaveIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { ChatMessage } from '@/lib/types'
import { useSettingsStore } from '@/store/settingsStore'
import { useChatStore } from '@/store/chatStore'
import { modelConfigService } from '@/services/modelConfigService'
import ThinkingChain from './ThinkingChain'
import TypewriterEffect from './TypewriterEffect'
import toast from 'react-hot-toast'

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
  const { regenerateLastMessage, isLoading } = useChatStore()

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
    <div className="mb-6 px-4">
      {isUser ? (
        // 用户消息 - 右侧对齐，暗灰色气泡，默认markdown渲染
        <div className="flex justify-end">
          <div className="max-w-[70%]">
            <div className="bg-gray-700 text-white rounded-2xl px-4 py-3">
              <div className="prose prose-sm prose-invert max-w-none text-sm">
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
        </div>
      ) : (
        // AI消息 - 左侧对齐，OpenAI风格
        <div className="flex gap-3 group">
          {/* AI头像 - 使用模型的icon */}
          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {currentModelIcon ? (
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
            ) : (
              <span className="text-sm">🤖</span>
            )}
            <span className="text-sm hidden">🤖</span>
          </div>

          {/* 消息内容 */}
          <div className="flex-1 min-w-0">
            {/* 显示推理链（当有reasoning内容或者是正在加载的推理模型时） */}
            {(message.reasoning || (isReasoningModel && isLoading && isLast)) && (
              <ThinkingChain 
                reasoning={message.reasoning || ''} 
                startTime={message.thinking_start_time}
                isComplete={!isLoading || !isLast}
                className="mb-4" 
              />
            )}
            
            {/* 使用打字机效果渲染AI消息内容 */}
            <TypewriterEffect
              text={message.content}
              isComplete={!isLoading || !isLast}
            />
            
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
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => copyToClipboard(message.content)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="复制"
              >
                {copied ? (
                  <CheckIcon className="w-4 h-4 text-green-600" />
                ) : (
                  <ClipboardIcon className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <button
                onClick={() => speakText(message.content)}
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  isSpeaking ? 'text-blue-600' : 'text-gray-500'
                }`}
                title="朗读"
              >
                <SpeakerWaveIcon className="w-4 h-4" />
              </button>
              {/* 重新生成按钮 - 只在最后一条AI消息上显示 */}
              {isLast && (
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading || isRegenerating}
                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    isRegenerating ? 'text-blue-600 animate-spin' : 'text-gray-500'
                  } ${(isLoading || isRegenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="重新生成"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}