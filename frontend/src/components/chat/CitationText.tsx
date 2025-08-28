'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Citation } from '@/lib/types'

interface CitationTextProps {
  text: string
  citations?: Citation[]
}

export default function CitationText({ text, citations }: CitationTextProps) {
  const [hoveredCitation, setHoveredCitation] = useState<Citation | null>(null)

  if (!citations || citations.length === 0) {
    // 如果没有引用，使用普通的Markdown渲染
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => (
              <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="mb-2 ml-4 space-y-1" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="mb-2 ml-4 space-y-1" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="mb-0" {...props} />
            ),
            code: ({ node, ...props }) => {
              const { inline, ...restProps } = props as any
              return inline ? (
                <code
                  className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...restProps}
                />
              ) : (
                <code {...restProps} />
              )
            },
            pre: ({ node, ...props }) => (
              <pre
                className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto text-sm mt-2 border"
                {...props}
              />
            ),
            a: ({ node, ...props }) => (
              <a
                {...props}
                className="text-blue-600 hover:text-blue-700 underline"
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    )
  }

  // 处理带引用的文本
  const renderTextWithCitations = () => {
    if (citations.length === 0) {
      return text
    }

    // 按 start_index 排序引用
    const sortedCitations = [...citations].sort((a, b) => a.start_index - b.start_index)
    
    const parts = []
    let lastIndex = 0

    sortedCitations.forEach((citation, index) => {
      // 添加引用前的文本
      if (citation.start_index > lastIndex) {
        parts.push(text.slice(lastIndex, citation.start_index))
      }
      
      // 添加被引用的文本片段
      const citedText = text.slice(citation.start_index, citation.end_index)
      parts.push(
        <span
          key={index}
          className="relative inline-block"
        >
          <span
            className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 px-1 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors underline decoration-blue-500 decoration-dotted"
            onMouseEnter={() => setHoveredCitation(citation)}
            onMouseLeave={() => setHoveredCitation(null)}
            onClick={() => window.open(citation.url, '_blank', 'noopener,noreferrer')}
            title={`来源: ${citation.title}`}
          >
            {citedText}
          </span>
          
          {/* 悬浮时显示引用信息 */}
          {hoveredCitation === citation && (
            <div className="absolute top-full left-0 z-10 mt-1 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border max-w-xs">
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {citation.title}
                </div>
                <div className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
                     onClick={() => window.open(citation.url, '_blank', 'noopener,noreferrer')}>
                  {citation.url}
                </div>
              </div>
            </div>
          )}
        </span>
      )
      
      lastIndex = citation.end_index
    })

    // 添加最后剩余的文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts
  }

  return (
    <div className="prose prose-sm max-w-none">
      <div className="leading-relaxed">
        {renderTextWithCitations()}
      </div>
    </div>
  )
}