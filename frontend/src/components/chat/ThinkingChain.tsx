'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'

interface ThinkingChainProps {
  reasoning: string
  className?: string
  startTime?: number  // 思考开始时间戳
  isComplete?: boolean  // 消息是否完成
}

export default function ThinkingChain({ reasoning, className = '', startTime, isComplete = false }: ThinkingChainProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [finalThinkingTime, setFinalThinkingTime] = useState(0)
  const { isLoading } = useChatStore()
  const reasoningRef = useRef<string>('')

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
      // 计算最终思考时间
      const endTime = Date.now()
      const totalTime = (endTime - startTime) / 1000
      setFinalThinkingTime(totalTime)
      
      // 立即停止流式动画
      setIsStreaming(false)
    }
  }, [isComplete, startTime, finalThinkingTime])
  
  // 确保在完成状态时停止流式动画
  useEffect(() => {
    if (isComplete) {
      setIsStreaming(false)
    }
  }, [isComplete])

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
            {isComplete ? '已深度思考' : '思考中...'}
          </span>
          {isComplete && finalThinkingTime > 0 && (
            <span className="thinking-time">
              (用时 {formatTime(finalThinkingTime)} 秒)
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
        
        /* 流光效果 */
        .streaming-text::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(59, 130, 246, 0.4),
            transparent
          );
          animation: shimmer 2s infinite;
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
        
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
        
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