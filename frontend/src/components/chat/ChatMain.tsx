'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import MessageItem from './MessageItem'
import InputArea from './InputArea'

export default function ChatMain() {
  const { currentConversation, isLoading } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentConversation?.messages])

  if (!currentConversation) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* 主内容区域 - 居中显示欢迎信息 */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-2xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              您今天想聊什么？
            </h1>
          </div>
        </div>
        
        {/* 输入区域固定在底部 */}
        <div className="flex-shrink-0">
          <InputArea />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {currentConversation.messages.map((message, index) => (
            <MessageItem
              key={index}
              message={message}
              isLast={index === currentConversation.messages.length - 1}
            />
          ))}
          {isLoading && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                AI正在思考...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className="flex-shrink-0">
        <InputArea />
      </div>
    </div>
  )
}