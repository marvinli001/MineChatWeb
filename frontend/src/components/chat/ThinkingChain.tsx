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
          {/* Loading animation circle for thinking state */}
          {!isComplete && (
            <div className="loading-circle" aria-label="思考中">
              <svg className="loading-svg" viewBox="0 0 24 24">
                <circle className="loading-track" cx="12" cy="12" r="10" />
                <circle className="loading-progress" cx="12" cy="12" r="10" />
              </svg>
            </div>
          )}

          <div className="thinking-text-wrapper">
            <span className={`thinking-text ${(isStreaming && !isComplete) ? 'streaming-text' : ''}`}>
              {isComplete ? '思考完成' : (
                <>
                  思考中
                  {currentThinkingTime > 0 && (
                    <span className="thinking-time-inline"> {formatTime(currentThinkingTime)} 秒</span>
                  )}
                </>
              )}
            </span>
            <span className="thinking-subtitle">
              {isComplete ? (
                finalThinkingTime > 0 && `用时 ${formatTime(finalThinkingTime)} 秒`
              ) : (
                '点击展开思考过程'
              )}
            </span>
          </div>
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
          padding: 14px 18px;
          background: rgba(0, 0, 0, 0.05);
          border: 0.7px solid rgba(0, 0, 0, 0.2);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .thinking-header.streaming {
          background: linear-gradient(to right, rgba(103, 232, 249, 0.15), rgba(186, 230, 253, 0.15));
          border: 2px solid rgba(147, 197, 253, 0.25);
          box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.1);
        }

        .thinking-header:hover {
          background: rgba(0, 0, 0, 0.08);
        }

        .thinking-header.streaming:hover {
          background: linear-gradient(to right, rgba(103, 232, 249, 0.2), rgba(186, 230, 253, 0.2));
        }

        .thinking-header.expanded {
          border-bottom: none;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .thinking-header.collapsed {
          border-radius: 16px;
        }

        .thinking-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        /* Loading circle animation */
        .loading-circle {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .loading-svg {
          width: 100%;
          height: 100%;
          animation: rotate 2s linear infinite;
        }

        .loading-track {
          fill: none;
          stroke: rgba(59, 130, 246, 0.2);
          stroke-width: 2;
        }

        .loading-progress {
          fill: none;
          stroke: rgba(59, 130, 246, 0.8);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-dasharray: 62.83;
          stroke-dashoffset: 47.12;
          animation: progress 1.5s ease-in-out infinite;
        }

        @keyframes rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes progress {
          0% {
            stroke-dashoffset: 62.83;
          }
          50% {
            stroke-dashoffset: 15.71;
          }
          100% {
            stroke-dashoffset: 62.83;
          }
        }

        .thinking-text-wrapper {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .thinking-text {
          font-size: 18px;
          font-weight: 700;
          color: #000000;
          line-height: 1.3;
        }

        .thinking-header.streaming .thinking-text {
          color: #0c4a6e;
        }

        .thinking-time-inline {
          font-weight: 600;
        }

        .thinking-subtitle {
          font-size: 14px;
          color: rgba(0, 0, 0, 0.5);
          font-weight: 400;
          line-height: 1.3;
        }

        .thinking-header.streaming .thinking-subtitle {
          color: rgba(12, 74, 110, 0.5);
        }

        .expand-arrow {
          color: #000000;
          transition: transform 0.2s ease;
          opacity: 0.7;
        }

        .thinking-header.streaming .expand-arrow {
          color: #0c4a6e;
        }
        
        .thinking-details {
          background: rgba(0, 0, 0, 0.03);
          border: 0.7px solid rgba(0, 0, 0, 0.2);
          border-top: none;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
          position: relative;
        }

        .thinking-details.streaming-content {
          background: linear-gradient(to right, rgba(103, 232, 249, 0.08), rgba(186, 230, 253, 0.08));
          border: 2px solid rgba(147, 197, 253, 0.25);
          border-top: none;
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
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
          }

          .thinking-header.streaming {
            background: linear-gradient(to right, rgba(3, 105, 161, 0.12), rgba(8, 145, 178, 0.08) 61%, rgba(12, 74, 110, 0.12));
            border-color: rgba(14, 165, 233, 0.3);
            box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.1);
          }

          .thinking-header:hover {
            background: rgba(255, 255, 255, 0.15);
          }

          .thinking-header.streaming:hover {
            background: linear-gradient(to right, rgba(3, 105, 161, 0.18), rgba(8, 145, 178, 0.12) 61%, rgba(12, 74, 110, 0.18));
          }

          .thinking-text {
            color: #ffffff;
          }

          .thinking-header.streaming .thinking-text {
            color: #bfdbfe;
          }

          .thinking-subtitle {
            color: rgba(255, 255, 255, 0.5);
          }

          .thinking-header.streaming .thinking-subtitle {
            color: rgba(191, 219, 254, 0.5);
          }

          .expand-arrow {
            color: #ffffff;
          }

          .thinking-header.streaming .expand-arrow {
            color: #bfdbfe;
          }

          .loading-track {
            stroke: rgba(147, 197, 253, 0.2);
          }

          .loading-progress {
            stroke: rgba(147, 197, 253, 0.8);
          }

          .thinking-details {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.2);
          }

          .thinking-details.streaming-content {
            background: linear-gradient(to right, rgba(3, 105, 161, 0.08), rgba(8, 145, 178, 0.06) 61%, rgba(12, 74, 110, 0.08));
            border-color: rgba(14, 165, 233, 0.2);
          }
        }
      `}</style>
    </div>
  )
}
