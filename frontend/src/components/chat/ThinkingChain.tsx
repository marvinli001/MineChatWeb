'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface ThinkingChainProps {
  reasoning: string
  className?: string
  startTime?: number  // 思考开始时间戳
  isComplete?: boolean  // 消息是否完成
  messageId?: string   // 用于本地持久化思考结束时间的键
}

export default function ThinkingChain({ reasoning, className = '', startTime, isComplete = false, messageId }: ThinkingChainProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [finalThinkingTime, setFinalThinkingTime] = useState(0)
  const [currentThinkingTime, setCurrentThinkingTime] = useState(0)
  const reasoningRef = useRef<string>('')
  const storageKeyRef = useRef<string | null>(null)

  // 构建本地存储键（优先使用 messageId，兼容未来云端：服务端可直接提供结束时间或时长）
  useEffect(() => {
    if (messageId) {
      storageKeyRef.current = `mcw:thinking_end:${messageId}`
    } else if (startTime) {
      storageKeyRef.current = `mcw:thinking_end:ts:${startTime}`
    } else {
      storageKeyRef.current = null
    }
  }, [messageId, startTime])

  // Track reasoning changes to detect streaming
  useEffect(() => {
    if (reasoning !== reasoningRef.current) {
      if (reasoning.length > reasoningRef.current.length) {
        setIsStreaming(true)
      }
      reasoningRef.current = reasoning
    }
  }, [reasoning])
  
  // 如果还没有完成且有开始时间，说明正在思考中
  useEffect(() => {
    if (!isComplete && startTime && !isStreaming) {
      setIsStreaming(true)
    }
  }, [isComplete, startTime, isStreaming])

  // Calculate final thinking time when message is complete
  useEffect(() => {
    if (isComplete && startTime && finalThinkingTime === 0) {
      // 优先读取本地已保存的结束时间，避免刷新后使用“当前时间”导致时长变大
      let endTime = Date.now()
      try {
        const key = storageKeyRef.current
        if (typeof window !== 'undefined' && key) {
          const saved = window.localStorage.getItem(key)
          if (saved) {
            const parsed = Number(saved)
            if (!Number.isNaN(parsed) && parsed > 0) {
              endTime = parsed
            }
          } else {
            // 首次完成，保存结束时间，兼容未来云端可用该时间回填
            window.localStorage.setItem(key, String(endTime))
          }
        }
      } catch (e) {
        // 本地存储失败时，退回到当前时间，不影响显示
      }

      const totalTime = Math.max(0, (endTime - startTime) / 1000)
      setFinalThinkingTime(totalTime)
      setIsStreaming(false)
    }
  }, [isComplete, startTime, finalThinkingTime])
  
  // 确保在完成状态时停止流式动画
  useEffect(() => {
    if (isComplete) {
      setIsStreaming(false)
    }
  }, [isComplete])

  // 挂载时如果是完成态，尝试从本地读取结束时间并恢复最终时长
  useEffect(() => {
    if (isComplete && startTime && finalThinkingTime === 0) {
      try {
        const key = storageKeyRef.current
        if (typeof window !== 'undefined' && key) {
          const saved = window.localStorage.getItem(key)
          if (saved) {
            const endTime = Number(saved)
            if (!Number.isNaN(endTime) && endTime > 0) {
              const totalTime = Math.max(0, (endTime - startTime) / 1000)
              setFinalThinkingTime(totalTime)
              setIsStreaming(false)
            }
          }
        }
      } catch (e) {
        // 读取失败忽略，后续 effect 会用当前时间兜底
      }
    }
  }, [isComplete, startTime, finalThinkingTime])

  // 动态计时器 - 在思考期间实时更新时间
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (!isComplete && startTime) {
      interval = setInterval(() => {
        const currentTime = (Date.now() - startTime) / 1000
        setCurrentThinkingTime(currentTime)
      }, 100) // 每100ms更新一次
    } else {
      setCurrentThinkingTime(0)
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isComplete, startTime])

  // 只有在没有reasoning内容且已经完成时才不显示
  // 这允许在流式加载时显示"思考中..."，即使还没有reasoning内容
  if (!reasoning && isComplete) {
    return null
  }

  // Format thinking time display
  const formatTime = (seconds: number) => {
    return seconds.toFixed(1)
  }

  return (
    <div className={`thinking-chain mb-3 ${className}`}>
      <div 
        className={`thinking-header ${isExpanded ? 'expanded' : 'collapsed'} ${(isStreaming && !isComplete) ? 'streaming' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="thinking-content">
          <span className={`thinking-text ${(isStreaming && !isComplete) ? 'streaming-text' : ''}`}>
            {isComplete ? '已深度思考' : (
              <span className="streaming-cursor" aria-label="思考中">▊</span>
            )}
          </span>
          {isComplete && finalThinkingTime > 0 ? (
            <span className="thinking-time">
              (用时 {formatTime(finalThinkingTime)} 秒)
            </span>
          ) : !isComplete && currentThinkingTime > 0 && (
            <span className="thinking-time">
              ({formatTime(currentThinkingTime)} 秒)
            </span>
          )}
        </div>
        
        <div className="expand-arrow">
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
        </div>
      </div>

      <div className={`thinking-details ${isExpanded ? 'expanded' : 'collapsed'} ${(isStreaming && !isComplete) ? 'streaming-content' : ''}`}>
        {reasoning && reasoning.trim() !== '' ? (
          <div className="prose prose-sm prose-gray dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => (
                  <p className="mb-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="mb-2 ml-4 text-sm text-gray-600 dark:text-gray-400" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="mb-2 ml-4 text-sm text-gray-600 dark:text-gray-400" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="mb-1 text-sm text-gray-600 dark:text-gray-400" {...props} />
                ),
                code: ({ node, ...props }) => {
                  const { inline, ...restProps } = props as any
                  return inline ? (
                    <code
                      className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs border border-gray-200 dark:border-gray-600"
                      {...restProps}
                    />
                  ) : (
                    <code {...restProps} />
                  )
                },
                pre: ({ node, ...props }) => (
                  <pre
                    className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-200 dark:border-gray-600 text-xs"
                    {...props}
                  />
                ),
              }}
            >
              {reasoning}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            {isComplete ? '思考已完成，但没有详细思考过程记录' : '正在深度思考中...'}
          </div>
        )}
      </div>
      
      {/* Thinking chain styles */}
      <style jsx>{`
        .thinking-chain {
          width: 100%;
          transition: all 0.3s ease;
        }
        
        .thinking-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .thinking-header:hover {
          background: #f3f4f6;
        }
        
        .thinking-header.expanded {
          border-bottom: none;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        
        .thinking-header.collapsed {
          border-radius: 8px;
        }
        
        .thinking-content {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }
        
        .thinking-text {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          position: relative;
        }
        
        .thinking-time {
          font-size: 12px;
          color: #6b7280;
        }
        
        .expand-arrow {
          color: #6b7280;
          transition: transform 0.2s ease;
        }
        
        .thinking-details {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-top: none;
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
          position: relative;
        }
        
        .thinking-details.collapsed {
          max-height: 0;
          padding: 0 16px;
          opacity: 0;
        }
        
        .thinking-details.expanded {
          max-height: 400px;
          padding: 16px;
          opacity: 1;
          overflow-y: auto;
        }
        
        .thinking-details::-webkit-scrollbar {
          width: 4px;
        }
        
        .thinking-details::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .thinking-details::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 2px;
        }
        
        .thinking-details::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }
        
        /* 光标闪烁效果 */
        .streaming-cursor {
          display: inline-block;
          animation: blink 1s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 49% {
            opacity: 1;
          }
          50%, 100% {
            opacity: 0;
          }
        }
        
        .streaming-content::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(59, 130, 246, 0.08) 30%,
            rgba(59, 130, 246, 0.15) 50%,
            rgba(59, 130, 246, 0.08) 70%,
            transparent 100%
          );
          animation: thinkingFlow 3s ease-in-out infinite;
          pointer-events: none;
          border-radius: 0 0 8px 8px;
        }
        
        /* shimmer 已移除，使用 wave 动效 */
        
        @keyframes thinkingFlow {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .thinking-header {
            background: #374151;
            border-color: #4b5563;
          }
          
          .thinking-header:hover {
            background: #4b5563;
          }
          
          .thinking-text {
            color: #d1d5db;
          }
          
          .thinking-time {
            color: #9ca3af;
          }
          
          .expand-arrow {
            color: #9ca3af;
          }
          
          .thinking-details {
            background: #1f2937;
            border-color: #4b5563;
          }
        }
      `}</style>
    </div>
  )
}
