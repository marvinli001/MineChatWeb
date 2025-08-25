'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TypewriterEffectProps {
  text: string
  isComplete: boolean
  className?: string
}

export default function TypewriterEffect({ text, isComplete, className = '' }: TypewriterEffectProps) {
  const [displayText, setDisplayText] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const indexRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 打字机效果
  useEffect(() => {
    if (text.length === 0) {
      setDisplayText('')
      return
    }

    // 如果是完成状态或者文本没有变化，直接显示全部文本
    if (isComplete) {
      setDisplayText(text)
      setShowCursor(false)
      return
    }

    // 如果文本增加了，更新显示
    if (text.length > indexRef.current) {
      // 清除之前的定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // 立即显示到当前位置
      setDisplayText(text)
      indexRef.current = text.length
      setShowCursor(true)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [text, isComplete])

  // 光标闪烁效果
  useEffect(() => {
    if (!isComplete && showCursor) {
      const cursorInterval = setInterval(() => {
        setShowCursor(prev => !prev)
      }, 500)

      return () => clearInterval(cursorInterval)
    }
  }, [isComplete, showCursor])

  return (
    <div className={`typewriter-container ${className}`}>
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => (
              <p className="mb-2 last:mb-0" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="mb-2 ml-4" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="mb-2 ml-4" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="mb-1" {...props} />
            ),
            code: ({ node, ...props }) => {
              const { inline, ...restProps } = props as any
              return inline ? (
                <code
                  className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm border border-gray-200 dark:border-gray-600"
                  {...restProps}
                />
              ) : (
                <code {...restProps} />
              )
            },
            pre: ({ node, ...props }) => (
              <pre
                className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-200 dark:border-gray-600"
                {...props}
              />
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
          {displayText}
        </ReactMarkdown>
        {!isComplete && showCursor && (
          <span className="typewriter-cursor">|</span>
        )}
      </div>
      
      <style jsx>{`
        .typewriter-cursor {
          display: inline-block;
          color: #3b82f6;
          font-weight: bold;
          animation: blink 1s infinite;
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}