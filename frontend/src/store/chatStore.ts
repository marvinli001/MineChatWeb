'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage, Conversation } from '@/lib/types'

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  abortController: AbortController | null
  
  // Actions
  createNewConversation: () => void
  setCurrentConversation: (id: string) => void
  sendMessage: (content: string) => Promise<void>
  _sendMessageWithStreaming: (content: string, targetConversationId: string, settings: any, apiKey: string) => Promise<void>
  _sendMessageNormal: (content: string, targetConversationId: string, settings: any, apiKey: string) => Promise<void>
  stopGeneration: () => void
  deleteConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void
  clearAllConversations: () => void
  syncToCloud: () => Promise<void>
  syncFromCloud: () => Promise<void>
  regenerateLastMessage: () => Promise<void>
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      isLoading: false,
      abortController: null,

      createNewConversation: () => {
        const newConversation: Conversation = {
          id: Date.now().toString(),
          title: '新对话',
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        set(state => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: newConversation.id
        }))
      },

      setCurrentConversation: (id: string) => {
        set({ currentConversationId: id })
      },

      deleteConversation: (id: string) => {
        set(state => {
          const newConversations = state.conversations.filter(conv => conv.id !== id)
          const newCurrentId = state.currentConversationId === id 
            ? (newConversations[0]?.id || null)
            : state.currentConversationId
          
          return {
            conversations: newConversations,
            currentConversationId: newCurrentId
          }
        })
      },

      stopGeneration: () => {
        const { abortController } = get()
        if (abortController) {
          abortController.abort()
          set({ isLoading: false, abortController: null })
        }
      },

      updateConversationTitle: (id: string, title: string) => {
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === id ? { ...conv, title } : conv
          )
        }))
      },

      clearAllConversations: () => {
        set({ conversations: [], currentConversationId: null })
      },

      sendMessage: async (content: string) => {
        // 动态导入 settingsStore 和 modelConfigService 以避免循环依赖
        const { useSettingsStore } = await import('./settingsStore')
        const { modelConfigService } = await import('../services/modelConfigService')
        const settings = useSettingsStore.getState().settings
        
        const { conversations, currentConversationId } = get()
        
        // 如果没有当前对话，创建新对话
        let targetConversationId = currentConversationId
        if (!currentConversationId || !conversations.find(conv => conv.id === currentConversationId)) {
          const newConversation: Conversation = {
            id: Date.now().toString(),
            title: '新对话',
            messages: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          set(state => ({
            conversations: [newConversation, ...state.conversations],
            currentConversationId: newConversation.id
          }))
          
          targetConversationId = newConversation.id
        }

        // 验证API密钥
        const apiKey = settings.apiKeys?.[settings.chatProvider]
        if (!apiKey) {
          throw new Error(`请先配置 ${settings.chatProvider} 的 API 密钥`)
        }

        // 检查模型是否支持流式输出
        const supportsStreaming = await modelConfigService.supportsStreaming(settings.chatProvider, settings.chatModel)
        
        if (supportsStreaming && !settings.thinkingMode) {
          // 使用流式输出
          await get()._sendMessageWithStreaming(content, targetConversationId, settings, apiKey)
        } else {
          // 使用普通输出
          await get()._sendMessageNormal(content, targetConversationId, settings, apiKey)
        }
      },

      _sendMessageWithStreaming: async (content: string, targetConversationId: string, settings: any, apiKey: string) => {
        // 添加用户消息
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content,
          created_at: new Date().toISOString()
        }

        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === targetConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, userMessage],
                  updated_at: new Date().toISOString()
                }
              : conv
          ),
          isLoading: true
        }))

        const abortController = new AbortController()
        set({ abortController })

        try {
          const { conversations: updatedConversations } = get()
          const updatedConversation = updatedConversations.find(conv => conv.id === targetConversationId)
          
          if (!updatedConversation) {
            throw new Error('找不到目标对话')
          }

          const messages = updatedConversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))

          // 创建流式AI消息
          const assistantMessage: ChatMessage = {
            id: Date.now().toString() + '-assistant',
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString()
          }

          // 添加空的助手消息
          set(state => ({
            conversations: state.conversations.map(conv =>
              conv.id === targetConversationId
                ? {
                    ...conv,
                    messages: [...conv.messages, assistantMessage],
                    title: conv.messages.length === 1 ? content.slice(0, 20) + '...' : conv.title,
                    updated_at: new Date().toISOString()
                  }
                : conv
            )
          }))

          // 建立WebSocket连接
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const host = process.env.NODE_ENV === 'production' ? window.location.host : 'localhost:8000'
          const getWebSocketUrl = () => {
            if (process.env.NODE_ENV === 'development') {
              return 'ws://localhost:8000/api/v1/chat/stream'
            } else {
              // 生产环境：优先使用环境变量，否则使用当前域名
              const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
                                process.env.NEXT_PUBLIC_API_BASE_URL ||
                                `${window.location.protocol}//${window.location.host}`
              
              return backendUrl
                .replace('https:', 'wss:')
                .replace('http:', 'ws:') + '/api/v1/chat/stream'
            }
          }

          const wsUrl = getWebSocketUrl()
          const ws = new WebSocket(wsUrl)

          ws.onopen = () => {
            const request = {
              provider: settings.chatProvider,
              model: settings.chatModel,
              messages,
              api_key: apiKey,
              thinking_mode: settings.thinkingMode || false,
              reasoning_summaries: 'auto'  // Default to auto mode as recommended by OpenAI
            }
            ws.send(JSON.stringify(request))
          }

          ws.onmessage = (event) => {
            try {
              const chunk = JSON.parse(event.data)
              
              if (chunk.error) {
                throw new Error(chunk.error)
              }

              if (chunk.choices && chunk.choices[0]?.delta?.content) {
                const deltaContent = chunk.choices[0].delta.content
                
                // 更新流式内容
                set(state => ({
                  conversations: state.conversations.map(conv =>
                    conv.id === targetConversationId
                      ? {
                          ...conv,
                          messages: conv.messages.map(msg =>
                            msg.id === assistantMessage.id
                              ? { ...msg, content: msg.content + deltaContent }
                              : msg
                          ),
                          updated_at: new Date().toISOString()
                        }
                      : conv
                  )
                }))
              }

              // Handle reasoning data in streaming response
              if (chunk.choices && chunk.choices[0]?.delta?.reasoning) {
                const deltaReasoning = chunk.choices[0].delta.reasoning
                
                // 更新reasoning内容
                set(state => ({
                  conversations: state.conversations.map(conv =>
                    conv.id === targetConversationId
                      ? {
                          ...conv,
                          messages: conv.messages.map(msg =>
                            msg.id === assistantMessage.id
                              ? { ...msg, reasoning: (msg.reasoning || '') + deltaReasoning }
                              : msg
                          ),
                          updated_at: new Date().toISOString()
                        }
                      : conv
                  )
                }))
              }

              // 如果流式传输完成
              if (chunk.choices && chunk.choices[0]?.finish_reason) {
                ws.close()
                set({ isLoading: false, abortController: null })
              }
            } catch (error) {
              console.error('解析流式响应失败:', error)
            }
          }

          ws.onerror = (error) => {
            console.error('WebSocket错误:', error)
            set({ isLoading: false, abortController: null })
            throw new Error('流式连接失败')
          }

          ws.onclose = () => {
            set({ isLoading: false, abortController: null })
          }

          // 设置abort信号处理
          abortController.signal.addEventListener('abort', () => {
            ws.close()
            set({ isLoading: false, abortController: null })
          })

        } catch (error: any) {
          console.error('流式发送消息失败:', error)
          set({ isLoading: false, abortController: null })
          throw error
        }
      },

      _sendMessageNormal: async (content: string, targetConversationId: string, settings: any, apiKey: string) => {

        // 添加用户消息
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content,
          created_at: new Date().toISOString()
        }

        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === targetConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, userMessage],
                  updated_at: new Date().toISOString()
                }
              : conv
          ),
          isLoading: true
        }))

        const abortController = new AbortController()
        set({ abortController })

        try {
          const { conversations: updatedConversations } = get()
          const updatedConversation = updatedConversations.find(conv => conv.id === targetConversationId)
          
          if (!updatedConversation) {
            throw new Error('找不到目标对话')
          }

          const messages = updatedConversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))

          const response = await fetch('/api/v1/chat/completion', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              provider: settings.chatProvider,
              model: settings.chatModel,
              messages,
              api_key: apiKey,
              thinking_mode: settings.thinkingMode || false,
              reasoning_summaries: 'auto',  // Default to auto mode as recommended by OpenAI
              stream: false
            }),
            signal: abortController.signal
          })

          if (!response.ok) {
            const errorText = await response.text()
            let errorMessage = '请求失败'
            try {
              const error = JSON.parse(errorText)
              errorMessage = error.detail || error.message || errorMessage
            } catch {
              errorMessage = errorText || errorMessage
            }
            throw new Error(errorMessage)
          }

          const data = await response.json()
          
          if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            throw new Error('API响应格式错误：缺少choices数据')
          }

          const assistantContent = data.choices[0]?.message?.content
          if (!assistantContent) {
            throw new Error('AI响应内容为空')
          }

          // Extract reasoning data if available
          const reasoningContent = data.choices[0]?.message?.reasoning

          const assistantMessage: ChatMessage = {
            id: Date.now().toString() + '-assistant',
            role: 'assistant',
            content: assistantContent,
            created_at: new Date().toISOString(),
            ...(reasoningContent && { reasoning: reasoningContent })
          }

          set(state => {
            const newConversations = state.conversations.map(conv =>
              conv.id === targetConversationId
                ? {
                    ...conv,
                    messages: [...conv.messages, assistantMessage],
                    title: conv.messages.length === 1 ? content.slice(0, 20) + '...' : conv.title,
                    updated_at: new Date().toISOString()
                  }
                : conv
            )
            
            return {
              conversations: newConversations,
              isLoading: false,
              abortController: null
            }
          })

          if (settings.enableCloudSync && 
              settings.autoSync && 
              settings.cloudflareConfig?.accountId && 
              settings.cloudflareConfig?.databaseId && 
              settings.cloudflareConfig?.apiToken) {
            try {
              // 调用云同步服务
              const syncResponse = await fetch('/api/v1/sync/upload', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  cloudflare_config: {
                    accountId: settings.cloudflareConfig.accountId,
                    databaseId: settings.cloudflareConfig.databaseId,
                    apiToken: settings.cloudflareConfig.apiToken
                  },
                  conversations: get().conversations
                })
              })

              if (syncResponse.ok) {
                console.log('云同步成功')
              } else {
                console.warn('云同步失败:', await syncResponse.text())
              }
            } catch (error) {
              console.warn('云端同步失败:', error)
            }
          }

        } catch (error: any) {
          console.error('发送消息失败:', error)
          set({ isLoading: false, abortController: null })
          throw error
        }
      },

      syncToCloud: async () => {
        const { useSettingsStore } = await import('./settingsStore')
        const settings = useSettingsStore.getState().settings
        
        if (!settings.cloudflareConfig?.accountId || !settings.cloudflareConfig?.databaseId || !settings.cloudflareConfig?.apiToken) {
          throw new Error('请先配置Cloudflare信息')
        }

        try {
          const response = await fetch('/api/v1/sync/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              cloudflare_config: {
                accountId: settings.cloudflareConfig.accountId,
                databaseId: settings.cloudflareConfig.databaseId,
                apiToken: settings.cloudflareConfig.apiToken
              },
              conversations: get().conversations
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || '同步到云端失败')
          }
        } catch (error: any) {
          console.error('云端同步失败:', error)
          throw error
        }
      },

      syncFromCloud: async () => {
        const { useSettingsStore } = await import('./settingsStore')
        const settings = useSettingsStore.getState().settings
        
        if (!settings.cloudflareConfig?.accountId || !settings.cloudflareConfig?.databaseId || !settings.cloudflareConfig?.apiToken) {
          throw new Error('请先配置Cloudflare信息')
        }

        try {
          const response = await fetch('/api/v1/sync/download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              cloudflare_config: {
                accountId: settings.cloudflareConfig.accountId,
                databaseId: settings.cloudflareConfig.databaseId,
                apiToken: settings.cloudflareConfig.apiToken
              }
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || '从云端同步失败')
          }

          const data = await response.json()
          if (data.conversations) {
            set({ conversations: data.conversations })
          }
        } catch (error: any) {
          console.error('从云端同步失败:', error)
          throw error
        }
      },

      regenerateLastMessage: async () => {
        const { conversations, currentConversationId } = get()
        const currentConversation = conversations.find(conv => conv.id === currentConversationId)
        
        if (!currentConversation || currentConversation.messages.length === 0) {
          throw new Error('没有可重新生成的消息')
        }

        // 找到最后一条助手消息
        const lastAssistantIndex = currentConversation.messages.map((msg, idx) => ({ msg, idx }))
          .reverse()
          .find(({ msg }) => msg.role === 'assistant')?.idx

        if (lastAssistantIndex === undefined) {
          throw new Error('没有找到助手消息')
        }

        // 移除最后一条助手消息
        const messagesWithoutLast = currentConversation.messages.slice(0, lastAssistantIndex)
        
        // 更新对话状态
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === currentConversationId
              ? { ...conv, messages: messagesWithoutLast }
              : conv
          )
        }))

        // 重新发送最后一条用户消息
        const lastUserMessage = messagesWithoutLast
          .slice()
          .reverse()
          .find(msg => msg.role === 'user')

        if (lastUserMessage) {
          await get().sendMessage(lastUserMessage.content)
        }
      }
    }),
    {
      name: 'chat-store',
      version: 1
    }
  )
)

// 添加选择器函数来获取当前对话
export const useCurrentConversation = () => {
  return useChatStore((state) => 
    state.conversations.find(conv => conv.id === state.currentConversationId) || null
  )
}