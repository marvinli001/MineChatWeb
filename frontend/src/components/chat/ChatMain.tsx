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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            您今天想聊什么？
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            选择一个AI模型开始对话，或者创建新的对话
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
            {[
              { title: "写作助手", desc: "帮助您写作和编辑文档", icon: "✍️" },
              { title: "编程助手", desc: "协助编程和调试代码", icon: "💻" },
              { title: "学习伙伴", desc: "解答问题和解释概念", icon: "📚" },
              { title: "创意灵感", desc: "激发创意和头脑风暴", icon: "💡" },
              { title: "数据分析", desc: "分析和解释数据", icon: "📊" },
              { title: "语言翻译", desc: "翻译和语言学习", icon: "🌍" }
            ].map((item, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
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
      <InputArea />
    </div>
  )
}