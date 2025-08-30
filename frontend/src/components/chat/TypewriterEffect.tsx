'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TypewriterEffectProps {
  text: string
  isComplete: boolean
  className?: string
  showWaitingEffect?: boolean
}

export default function TypewriterEffect({ text, isComplete, className = '', showWaitingEffect = false }: TypewriterEffectProps) {
  const [displayText, setDisplayText] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const [waitingDots, setWaitingDots] = useState('')
  const indexRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const waitingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 等待效果 - 显示动画点
  useEffect(() => {
    if (showWaitingEffect && text.length === 0 && !isComplete) {
      let dotCount = 0
      waitingIntervalRef.current = setInterval(() => {
        dotCount = (dotCount + 1) % 4
        setWaitingDots('.'.repeat(dotCount))
        setShowCursor(true)
      }, 500)
      
      return () => {
        if (waitingIntervalRef.current) {
          clearInterval(waitingIntervalRef.current)
        }
      }
    } else {
      if (waitingIntervalRef.current) {
        clearInterval(waitingIntervalRef.current)
        waitingIntervalRef.current = null
      }
      setWaitingDots('')
    }
  }, [showWaitingEffect, text.length, isComplete])

  // 打字机效果
  useEffect(() => {
    const currentInterval = intervalRef.current

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
      if (currentInterval) {
        clearInterval(currentInterval)
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

  // 如果正在等待且没有内容，显示等待文本
  const renderContent = () => {
    if (showWaitingEffect && text.length === 0 && !isComplete) {
      return (
        <div className="text-gray-500 dark:text-gray-400">
          <span>正在思考{waitingDots}</span>
        </div>
      )
    }
    
    if (displayText) {
      return (
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
                className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto border border-gray-600"
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
      )
    }
    
    return null
  }

  return (
    <div className={`typewriter-container ${className}`}>
      <div className="prose prose-gray dark:prose-invert max-w-none">
        {renderContent()}
        {!isComplete && showCursor && (showWaitingEffect ? waitingDots : displayText) && (
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