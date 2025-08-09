'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ClipboardIcon, CheckIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline'
import { ChatMessage } from '@/lib/types'
import toast from 'react-hot-toast'

interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
}

export default function MessageItem({ message, isLast }: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

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
        // 用户消息 - 右侧对齐，暗灰色气泡
        <div className="flex justify-end">
          <div className="max-w-[70%]">
            <div className="bg-gray-700 text-white rounded-2xl px-4 py-3">
              <div className="text-sm">
                {message.content}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // AI消息 - 左侧对齐，OpenAI风格
        <div className="flex gap-3 group">
          {/* AI头像 */}
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
            🤖
          </div>

          {/* 消息内容 */}
          <div className="flex-1 min-w-0">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              {contentParts.map((part, index) => {
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
                } else {
                  return (
                    <div key={index}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          pre: ({ node, children, ...props }) => (
                            <div className="relative">
                              <pre
                                className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto border border-gray-200 dark:border-gray-600"
                                {...props}
                              />
                              <button
                                onClick={() => copyToClipboard(typeof children === 'string' ? children : (children as any)?.props?.children || '')}
                                className="absolute top-2 right-2 p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                title="复制代码"
                              >
                                {copied ? (
                                  <CheckIcon className="w-4 h-4 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                )}
                              </button>
                            </div>
                          ),
                          code: ({ node, className, ...props }) => (
                            className ? (
                              <code {...props} />
                            ) : (
                              <code
                                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm border border-gray-200 dark:border-gray-600"
                                {...props}
                              />
                            )
                          ),
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4">
                              <table
                                className="min-w-full border border-gray-200 dark:border-gray-600 rounded-lg"
                                {...props}
                              />
                            </div>
                          ),
                          th: ({ node, ...props }) => (
                            <th
                              className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-4 py-2 text-left font-medium"
                              {...props}
                            />
                          ),
                          td: ({ node, ...props }) => (
                            <td
                              className="border-b border-gray-200 dark:border-gray-600 px-4 py-2"
                              {...props}
                            />
                          ),
                        }}
                      >
                        {part.text}
                      </ReactMarkdown>
                    </div>
                  )
                }
              })}
            </div>

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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}