'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage, Conversation } from '@/lib/types'

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  abortController: AbortController | null
  
  // WebSocket connection state
  wsConnection: WebSocket | null
  wsReconnectAttempts: number
  wsMaxReconnectAttempts: number
  wsReconnectDelay: number
  wsHeartbeatInterval: NodeJS.Timeout | null
  wsLastHeartbeat: number
  
  // Actions
  createNewConversation: () => void
  setCurrentConversation: (id: string) => void
  sendMessage: (content: string) => Promise<void>
  _sendMessageWithStreaming: (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string) => Promise<void>
  _sendMessageNormal: (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string) => Promise<void>
  stopGeneration: () => void
  deleteConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void
  clearAllConversations: () => void
  syncToCloud: () => Promise<void>
  syncFromCloud: () => Promise<void>
  regenerateLastMessage: () => Promise<void>
  
  // WebSocket management
  _createWebSocketConnection: (url: string) => Promise<WebSocket>
  _setupHeartbeat: (ws: WebSocket) => void
  _cleanupWebSocket: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      isLoading: false,
      abortController: null,
      
      // WebSocket connection state
      wsConnection: null,
      wsReconnectAttempts: 0,
      wsMaxReconnectAttempts: 3,
      wsReconnectDelay: 1000,
      wsHeartbeatInterval: null,
      wsLastHeartbeat: 0,

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
        // Also cleanup WebSocket if active
        get()._cleanupWebSocket()
      },

      _createWebSocketConnection: async (url: string): Promise<WebSocket> => {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(url)
          
          const timeout = setTimeout(() => {
            ws.close()
            reject(new Error('WebSocket connection timeout'))
          }, 10000) // 10 second timeout
          
          ws.onopen = () => {
            clearTimeout(timeout)
            console.log('WebSocket connected successfully')
            set({ wsReconnectAttempts: 0 })
            resolve(ws)
          }
          
          ws.onerror = (error) => {
            clearTimeout(timeout)
            console.error('WebSocket connection error:', error)
            reject(new Error('WebSocket connection failed'))
          }
        })
      },

      _setupHeartbeat: (ws: WebSocket) => {
        // Clear existing heartbeat
        const { wsHeartbeatInterval } = get()
        if (wsHeartbeatInterval) {
          clearInterval(wsHeartbeatInterval)
        }
        
        // Send heartbeat every 30 seconds
        const interval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }))
            set({ wsLastHeartbeat: Date.now() })
          }
        }, 30000)
        
        set({ wsHeartbeatInterval: interval })
      },

      _cleanupWebSocket: () => {
        const { wsConnection, wsHeartbeatInterval } = get()
        
        // Clear heartbeat interval
        if (wsHeartbeatInterval) {
          clearInterval(wsHeartbeatInterval)
          set({ wsHeartbeatInterval: null })
        }
        
        // Close WebSocket connection
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.close()
        }
        
        set({ wsConnection: null, wsReconnectAttempts: 0 })
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

        // 检查是否为GPT-5系列模型，如果是则默认开启推理模式
        const isGPT5Model = settings.chatModel?.includes('gpt-5') || false
        const effectiveThinkingMode = isGPT5Model ? true : (settings.thinkingMode || false)

        // 立即添加用户消息和空的AI消息
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content,
          created_at: new Date().toISOString()
        }

        const assistantMessage: ChatMessage = {
          id: Date.now().toString() + '-assistant',
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          thinking_start_time: Date.now()  // 记录思考开始时间
        }

        // 立即更新UI显示消息
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === targetConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, userMessage, assistantMessage],
                  title: conv.messages.length === 0 ? content.slice(0, 20) + '...' : conv.title,
                  updated_at: new Date().toISOString()
                }
              : conv
          ),
          isLoading: true
        }))

        // 检查模型是否支持流式输出
        const supportsStreaming = await modelConfigService.supportsStreaming(settings.chatProvider, settings.chatModel)
        
        if (supportsStreaming && !effectiveThinkingMode) {
          // 使用流式输出
          await get()._sendMessageWithStreaming(content, targetConversationId, settings, apiKey, assistantMessage.id)
        } else {
          // 使用普通输出（推理模型或不支持流式的模型）
          await get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessage.id)
        }
      },

      _sendMessageWithStreaming: async (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string) => {
        const abortController = new AbortController()
        set({ abortController })

        try {
          const { conversations: updatedConversations } = get()
          const updatedConversation = updatedConversations.find(conv => conv.id === targetConversationId)
          
          if (!updatedConversation) {
            throw new Error('找不到目标对话')
          }

          // 过滤掉空的AI消息，只发送有内容的消息到API
          const messages = updatedConversation.messages
            .filter(msg => !(msg.role === 'assistant' && msg.content === ''))
            .map(msg => ({
              role: msg.role,
              content: msg.content
            }))

          // WebSocket URL configuration
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
          
          // Try WebSocket with reconnection logic
          const attemptWebSocketConnection = async (attempt: number = 0): Promise<void> => {
            try {
              const ws = await get()._createWebSocketConnection(wsUrl)
              set({ wsConnection: ws })
              
              // Setup heartbeat
              get()._setupHeartbeat(ws)

              const request = {
                provider: settings.chatProvider,
                model: settings.chatModel,
                messages,
                api_key: apiKey,
                thinking_mode: settings.thinkingMode || settings.chatModel?.includes('gpt-5') || false,
                reasoning_summaries: 'auto',
                reasoning: settings.reasoning || 'medium'
              }

              ws.onmessage = (event) => {
                try {
                  const chunk = JSON.parse(event.data)
                  
                  // Handle heartbeat response
                  if (chunk.type === 'heartbeat') {
                    return
                  }
                  
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
                                msg.id === assistantMessageId
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
                                msg.id === assistantMessageId
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
                    get()._cleanupWebSocket()
                    set({ isLoading: false, abortController: null })
                  }
                } catch (error) {
                  console.error('解析流式响应失败:', error)
                }
              }

              ws.onerror = (error) => {
                console.error('WebSocket错误:', error)
                get()._cleanupWebSocket()
                // Try to reconnect if we haven't exceeded max attempts
                if (attempt < get().wsMaxReconnectAttempts) {
                  console.log(`WebSocket连接失败，尝试重连 (${attempt + 1}/${get().wsMaxReconnectAttempts})`)
                  setTimeout(() => {
                    attemptWebSocketConnection(attempt + 1)
                  }, get().wsReconnectDelay * Math.pow(2, attempt)) // Exponential backoff
                } else {
                  // Fallback to HTTP after max attempts
                  console.log('WebSocket重连失败，切换到HTTP模式')
                  get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId)
                }
              }

              ws.onclose = (event) => {
                get()._cleanupWebSocket()
                if (!event.wasClean && attempt < get().wsMaxReconnectAttempts) {
                  console.log(`WebSocket连接断开，尝试重连 (${attempt + 1}/${get().wsMaxReconnectAttempts})`)
                  setTimeout(() => {
                    attemptWebSocketConnection(attempt + 1)
                  }, get().wsReconnectDelay * Math.pow(2, attempt))
                } else if (!event.wasClean && attempt >= get().wsMaxReconnectAttempts) {
                  console.log('WebSocket连接断开且重连失败，切换到HTTP模式')
                  get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId)
                } else {
                  set({ isLoading: false, abortController: null })
                }
              }

              // Send initial request
              ws.send(JSON.stringify(request))

            } catch (error: any) {
              console.error(`WebSocket连接失败 (attempt ${attempt + 1}):`, error)
              if (attempt < get().wsMaxReconnectAttempts) {
                setTimeout(() => {
                  attemptWebSocketConnection(attempt + 1)
                }, get().wsReconnectDelay * Math.pow(2, attempt))
              } else {
                console.log('WebSocket连接彻底失败，切换到HTTP模式')
                get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId)
              }
            }
          }

          // Start WebSocket connection attempt
          await attemptWebSocketConnection()

          // 设置abort信号处理
          abortController.signal.addEventListener('abort', () => {
            get()._cleanupWebSocket()
            set({ isLoading: false, abortController: null })
          })

        } catch (error: any) {
          console.error('流式发送消息失败:', error)
          get()._cleanupWebSocket()
          set({ isLoading: false, abortController: null })
          
          // Final fallback to HTTP
          try {
            console.log('尝试HTTP fallback')
            await get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId)
          } catch (httpError: any) {
            console.error('HTTP fallback也失败了:', httpError)
            throw httpError
          }
        }
      },

      _sendMessageNormal: async (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string) => {
        const abortController = new AbortController()
        set({ abortController })

        try {
          const { conversations: updatedConversations } = get()
          const updatedConversation = updatedConversations.find(conv => conv.id === targetConversationId)
          
          if (!updatedConversation) {
            throw new Error('找不到目标对话')
          }

          // 过滤掉空的AI消息，只发送有内容的消息到API
          const messages = updatedConversation.messages
            .filter(msg => !(msg.role === 'assistant' && msg.content === ''))
            .map(msg => ({
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
              thinking_mode: settings.thinkingMode || settings.chatModel?.includes('gpt-5') || false,
              reasoning_summaries: 'auto',  // Default to auto mode as recommended by OpenAI
              reasoning: settings.reasoning || 'medium',
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

          // 更新已存在的AI消息
          set(state => {
            const newConversations = state.conversations.map(conv =>
              conv.id === targetConversationId
                ? {
                    ...conv,
                    messages: conv.messages.map(msg =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: assistantContent,
                            ...(reasoningContent && { reasoning: reasoningContent })
                          }
                        : msg
                    ),
                    title: conv.messages.length <= 2 ? content.slice(0, 20) + '...' : conv.title,
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