'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
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
                      <div className="thinking-mode mb-4">
                        <div className="thinking-label">🤔 AI的思考过程：</div>
                        <div className="thinking-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                )
                              }
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
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            )
                          }
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
                title="复制"
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