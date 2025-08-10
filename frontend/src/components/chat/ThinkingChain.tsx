'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface ThinkingChainProps {
  reasoning: string
  className?: string
}

export default function ThinkingChain({ reasoning, className = '' }: ThinkingChainProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!reasoning || reasoning.trim() === '') {
    return null
  }

  return (
    <div className={`thinking-chain mb-4 ${className}`}>
      <div 
        className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1">
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
          )}
          <div className="flex items-center gap-2">
            <span className="text-lg">💭</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              AI思考过程
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isExpanded ? '收起' : '展开'}
        </span>
      </div>

      {isExpanded && (
        <div className="mt-2 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="prose prose-sm prose-gray dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => (
                  <p className="mb-2 text-sm text-gray-600 dark:text-gray-400" {...props} />
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
      )}
    </div>
  )
}