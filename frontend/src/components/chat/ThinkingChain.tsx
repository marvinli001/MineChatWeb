'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'

interface ThinkingChainProps {
  reasoning: string
  className?: string
  startTime?: number  // 思考开始时间
}

export default function ThinkingChain({ reasoning, className = '', startTime }: ThinkingChainProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [previousReasoning, setPreviousReasoning] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingTime, setThinkingTime] = useState(0)
  const { isLoading } = useChatStore()
  const reasoningRef = useRef<string>('')
  const timeRef = useRef<NodeJS.Timeout | null>(null)

  // Track reasoning changes to detect streaming
  useEffect(() => {
    if (reasoning !== reasoningRef.current) {
      if (reasoning.length > reasoningRef.current.length) {
        setIsStreaming(true)
      }
      reasoningRef.current = reasoning
      setPreviousReasoning(reasoning)
    }
  }, [reasoning])

  // Update thinking time during streaming
  useEffect(() => {
    if (isLoading && startTime) {
      timeRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        setThinkingTime(elapsed)
      }, 100)
    } else {
      if (timeRef.current) {
        clearInterval(timeRef.current)
        timeRef.current = null
      }
    }

    return () => {
      if (timeRef.current) {
        clearInterval(timeRef.current)
      }
    }
  }, [isLoading, startTime])

  // Stop streaming animation when loading ends
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setIsStreaming(false)
      }, 500) // Small delay to show final state
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (!reasoning || reasoning.trim() === '') {
    return null
  }

  // Format thinking time display
  const formatTime = (seconds: number) => {
    return seconds.toFixed(1)
  }

  return (
    <div className={`thinking-chain mb-4 ${className}`}>
      <div 
        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            思考中 (用时 {formatTime(thinkingTime)} 秒)
          </span>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className={`thinking-content-container ${isStreaming ? 'streaming-content' : ''}`}>
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
          </div>
        </div>
      )}
      
      {/* Thinking chain styles */}
      <style jsx>{`
        .thinking-content-container {
          max-height: 4em; /* 约2行高度 */
          overflow-y: auto;
          position: relative;
          line-height: 1.5;
        }
        
        .thinking-content-container::-webkit-scrollbar {
          width: 4px;
        }
        
        .thinking-content-container::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .thinking-content-container::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 2px;
        }
        
        .thinking-content-container::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }
        
        .streaming-content {
          position: relative;
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
          border-radius: 8px;
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
      `}</style>
    </div>
  )
}