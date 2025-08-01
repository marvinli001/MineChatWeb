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
    <div className={`mb-6 ${isUser ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-full'}`}>
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* 头像 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : 'bg-green-600 text-white'
        }`}>
          {isUser ? '👤' : '🤖'}
        </div>

        {/* 消息内容 */}
        <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
          <div className={`inline-block max-w-full rounded-lg px-4 py-3 ${
            isUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          }`}>
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {contentParts.map((part, index) => (
                  <div key={index}>
                    {part.type === 'thinking' ? (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded-r-lg">
                        <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300 font-medium">
                          <span>🤔</span>
                          <span>AI的思考过程：</span>
                        </div>
                        <div className="text-blue-800 dark:text-blue-200 text-sm">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: ({ className, children, ...props }) => {
                                const isInline = !className?.includes('language-')
                                const language = className?.replace('language-', '') || ''
                                
                                return isInline ? (
                                  <code className="bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                    {children}
                                  </code>
                                ) : (
                                  <div className="relative my-4">
                                    <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 text-xs font-medium rounded-t-lg">
                                      <span>{language || 'code'}</span>
                                      <button
                                        onClick={() => copyToClipboard(String(children))}
                                        className="text-gray-400 hover:text-white transition-colors"
                                        title="复制代码"
                                      >
                                        <ClipboardIcon className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto rounded-b-lg border-t-0">
                                      <code className="text-sm font-mono">{children}</code>
                                    </pre>
                                  </div>
                                )
                              },
                              pre: ({ children }) => <>{children}</>,
                            }}
                          >
                            {part.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : part.text.trim() ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: ({ className, children, ...props }) => {
                            const isInline = !className?.includes('language-')
                            const language = className?.replace('language-', '') || ''
                            
                            return isInline ? (
                              <code className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                {children}
                              </code>
                            ) : (
                              <div className="relative my-4">
                                <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 text-xs font-medium rounded-t-lg">
                                  <span>{language || 'code'}</span>
                                  <button
                                    onClick={() => copyToClipboard(String(children))}
                                    className="text-gray-400 hover:text-white transition-colors"
                                    title="复制代码"
                                  >
                                    <ClipboardIcon className="w-4 h-4" />
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto rounded-b-lg border-t-0">
                                  <code className="text-sm font-mono leading-relaxed">{children}</code>
                                </pre>
                              </div>
                            )
                          },
                          pre: ({ children }) => <>{children}</>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-4">
                              {children}
                            </blockquote>
                          ),
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full border border-gray-300 dark:border-gray-600 rounded-lg">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-left">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {part.text}
                      </ReactMarkdown>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          {!isUser && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => copyToClipboard(message.content)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="复制全部内容"
              >
                {copied ? (
                  <CheckIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <ClipboardIcon className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => speakText(message.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim())}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="朗读"
                disabled={isSpeaking}
              >
                <SpeakerWaveIcon className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-blue-500' : ''}`} />
              </button>
            </div>
          )}

          {/* 时间戳 */}
          {message.timestamp && (
            <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
              {new Date(message.timestamp).toLocaleTimeString('zh-CN')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}