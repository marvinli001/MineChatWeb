'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage, Conversation, ImageAttachment, FileAttachment, ImageGeneration } from '@/lib/types'
import { formatWebSearchError } from '@/lib/webSearchUtils'

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
  wsPrewarmed: boolean

  // Actions
  createNewConversation: () => void
  setCurrentConversation: (id: string) => void
  sendMessage: (content: string, images?: ImageAttachment[], files?: FileAttachment[], tools?: any[]) => Promise<void>
  _sendMessageWithStreaming: (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string, tools?: any[]) => Promise<void>
  _sendMessageNormal: (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string, tools?: any[]) => Promise<void>
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
  _prewarmWebSocket: () => void
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
      wsMaxReconnectAttempts: 1,  // 减少重连次数从3到1
      wsReconnectDelay: 500,  // 减少重连延迟从1000ms到500ms
      wsHeartbeatInterval: null,
      wsLastHeartbeat: 0,
      wsPrewarmed: false,

      createNewConversation: () => {
        // 真正的对话会在用户发送第一条消息时创建
        set({ currentConversationId: null })
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
        const { abortController, currentConversationId, conversations } = get()
        if (abortController && typeof abortController.abort === 'function') {
          try {
            abortController.abort()
          } catch (error) {
            console.warn('Failed to abort controller:', error)
          }
        }
        // Cleanup WebSocket if active
        get()._cleanupWebSocket()
        // Always reset loading state (both global and conversation-level)
        set({
          isLoading: false,
          abortController: null,
          conversations: conversations.map(conv =>
            conv.id === currentConversationId
              ? { ...conv, isLoading: false }
              : conv
          )
        })
      },

      _createWebSocketConnection: async (url: string): Promise<WebSocket> => {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(url)

          const timeout = setTimeout(() => {
            ws.close()
            reject(new Error('WebSocket connection timeout'))
          }, 3000) // 缩短超时从10秒到3秒
          
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

      sendMessage: async (content: string, images?: ImageAttachment[], files?: FileAttachment[], tools?: any[]) => {
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
            updated_at: new Date().toISOString(),
            model_provider: settings.chatProvider,
            model_name: settings.chatModel
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
          images,
          files,
          tools,
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
                  updated_at: new Date().toISOString(),
                  isLoading: true,  // 设置当前对话为加载中
                  // 如果会话还没有模型信息，保存当前使用的模型
                  model_provider: conv.model_provider || settings.chatProvider,
                  model_name: conv.model_name || settings.chatModel
                }
              : conv
          ),
          isLoading: true  // 保持全局isLoading用于兼容
        }))

        // 检查模型是否支持流式输出
        const supportsStreaming = await modelConfigService.supportsStreaming(settings.chatProvider, settings.chatModel)
        
        if (supportsStreaming) {
          // 使用流式输出（包括thinking模式）
          await get()._sendMessageWithStreaming(content, targetConversationId, settings, apiKey, assistantMessage.id, tools)
        } else {
          // 使用普通输出（不支持流式的模型）
          await get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessage.id, tools)
        }
      },

      _sendMessageWithStreaming: async (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string, tools?: any[]) => {
        const abortController = new AbortController()
        set({ abortController })

        try {
          const imageGenerationMap: Record<string, ImageGeneration> = {}

          const normalizeImageGeneration = (raw: any): ImageGeneration | null => {
            if (!raw) return null

            const extractBase64 = (): string | undefined => {
              if (typeof raw.result === 'string' && raw.result.trim()) {
                return raw.result
              }
              if (typeof raw.image_base64 === 'string' && raw.image_base64.trim()) {
                return raw.image_base64
              }
              if (typeof raw.image_base64_png === 'string' && raw.image_base64_png.trim()) {
                return raw.image_base64_png
              }
              if (typeof raw.b64_json === 'string' && raw.b64_json.trim()) {
                return raw.b64_json
              }
              if (Array.isArray(raw.output) && raw.output.length > 0) {
                const first = raw.output[0]
                if (typeof first === 'string' && first.trim()) {
                  return first
                }
                if (first && typeof first.b64_json === 'string' && first.b64_json.trim()) {
                  return first.b64_json
                }
                if (first && typeof first.image_base64 === 'string' && first.image_base64.trim()) {
                  return first.image_base64
                }
              }
              if (Array.isArray(raw.data) && raw.data.length > 0) {
                const first = raw.data[0]
                if (typeof first === 'string' && first.trim()) {
                  return first
                }
                if (first && typeof first.b64_json === 'string' && first.b64_json.trim()) {
                  return first.b64_json
                }
                if (first && typeof first.image_base64 === 'string' && first.image_base64.trim()) {
                  return first.image_base64
                }
              }
              return undefined
            }

            const base64 = extractBase64()
            if (!base64) {
              return null
            }

            const sanitizedBase64 = base64.includes(',')
              ? base64.split(',').pop()!.trim()
              : base64.trim()

            const imageId =
              typeof raw.id === 'string' && raw.id.trim()
                ? raw.id
                : `image-${Date.now()}-${Object.keys(imageGenerationMap).length}`

            return {
              id: imageId,
              type: raw.type || 'image_generation_call',
              status: raw.status || 'completed',
              result: sanitizedBase64,
              revised_prompt: raw.revised_prompt
            }
          }

          const updateAssistantImages = (imageGenerations: ImageGeneration[]) => {
            set(state => ({
              conversations: state.conversations.map(conv =>
                conv.id === targetConversationId
                  ? {
                      ...conv,
                      messages: conv.messages.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, image_generations: imageGenerations }
                          : msg
                      ),
                      updated_at: new Date().toISOString()
                    }
                  : conv
              )
            }))
          }

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
              content: msg.content,
              ...(msg.images && msg.images.length > 0 ? { images: msg.images.map(img => ({
                type: img.mime_type.includes('image') ? 'image' : 'file',
                data: img.data,
                mime_type: img.mime_type
              })) } : {}),
              ...(msg.files && msg.files.length > 0 ? { files: msg.files.map(file => ({
                filename: file.filename,
                type: file.type,
                size: file.size,
                process_mode: file.processMode,
                openai_file_id: file.openai_file_id,
                vector_store_id: file.vector_store_id,
                status: file.status
              })) } : {})
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

              // 动态导入工具配置函数
              const { supportsNativeWebSearch, buildWebSearchToolConfig } = await import('../lib/webSearchUtils')
              
              // 构建基础请求
              const request: any = {
                provider: settings.chatProvider,
                model: settings.chatModel,
                messages,
                api_key: apiKey,
                thinking_mode: settings.thinkingMode || settings.chatModel?.includes('gpt-5') || false,
                reasoning_summaries: 'auto',
                reasoning: settings.reasoning || 'medium'
              }

              // 为OpenAI兼容提供商添加base_url
              if (settings.chatProvider === 'openai_compatible' && settings.openaiCompatibleConfig?.baseUrl) {
                request.base_url = settings.openaiCompatibleConfig.baseUrl
              }

              // 处理所有工具(搜索、MCP服务器、函数调用)
              if (tools && tools.length > 0) {
                const requestTools: any[] = []

                // 检查是否有搜索工具
                if (tools.some(tool => tool.id === 'search')) {
                  const useNativeSearch = supportsNativeWebSearch(settings.chatProvider, settings.chatModel)
                  const webSearchTool = buildWebSearchToolConfig(useNativeSearch, settings.chatProvider)
                  requestTools.push(webSearchTool)
                  request.use_native_search = useNativeSearch
                }

                // 添加MCP服务器和函数调用工具
                const mcpAndFunctionTools = tools.filter(tool =>
                  tool.id !== 'search' && tool.id !== 'image-generation'
                )
                requestTools.push(...mcpAndFunctionTools)

                if (requestTools.length > 0) {
                  request.tools = requestTools
                }
              }

              ws.onmessage = (event) => {
                try {
                  const chunk = JSON.parse(event.data)

                  // Handle heartbeat response
                  if (chunk.type === 'heartbeat') {
                    return
                  }

                  if (chunk.error) {
                    // 格式化WebSocket错误
                    const formattedError = formatWebSearchError(chunk.error)
                    throw new Error(formattedError.message)
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

                  // Handle image generation data in streaming response
                  if (chunk.choices && chunk.choices[0]?.delta?.image_generation) {
                    const imageGeneration = chunk.choices[0].delta.image_generation
                    console.log('收到图片生成数据:', imageGeneration)

                    const normalized = normalizeImageGeneration(imageGeneration)
                    if (normalized) {
                      imageGenerationMap[normalized.id] = normalized
                      updateAssistantImages(Object.values(imageGenerationMap))

                      // 图片生成完成，立即重置 isLoading 状态
                      console.log('图片生成完成，重置 isLoading')
                      get()._cleanupWebSocket()
                      set(state => ({
                        conversations: state.conversations.map(conv =>
                          conv.id === targetConversationId
                            ? { ...conv, isLoading: false }
                            : conv
                        ),
                        isLoading: false,
                        abortController: null
                      }))
                    } else {
                      console.warn('图片生成结果缺少可用的 base64 数据，已忽略:', imageGeneration)
                    }
                  }

                  // 如果流式传输完成
                  if (chunk.choices && chunk.choices[0]?.finish_reason) {
                    console.log('收到 finish_reason:', chunk.choices[0].finish_reason)
                    if (Object.keys(imageGenerationMap).length > 0) {
                      updateAssistantImages(Object.values(imageGenerationMap))
                    }
                    get()._cleanupWebSocket()
                    set(state => ({
                      conversations: state.conversations.map(conv =>
                        conv.id === targetConversationId
                          ? { ...conv, isLoading: false }
                          : conv
                      ),
                      isLoading: false,
                      abortController: null
                    }))
                    console.log('已设置 isLoading: false')
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
                  get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId, tools)
                }
              }

              ws.onclose = (event) => {
                get()._cleanupWebSocket()
                if (!event.wasClean && attempt < get().wsMaxReconnectAttempts) {
                  console.log(`WebSocket连接断开，开始重连 (${attempt + 1}/${get().wsMaxReconnectAttempts})`)
                  setTimeout(() => {
                    attemptWebSocketConnection(attempt + 1)
                  }, get().wsReconnectDelay * Math.pow(2, attempt))
                } else if (!event.wasClean && attempt >= get().wsMaxReconnectAttempts) {
                  console.log('WebSocket连接断开且重试失败，切换到HTTP模式')
                  get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId, tools)
                } else {
                  if (Object.keys(imageGenerationMap).length > 0) {
                    updateAssistantImages(Object.values(imageGenerationMap))
                  }
                  set(state => ({
                    conversations: state.conversations.map(conv =>
                      conv.id === targetConversationId
                        ? { ...conv, isLoading: false }
                        : conv
                    ),
                    isLoading: false,
                    abortController: null
                  }))
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
                get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId, tools)
              }
            }
          }

          // Start WebSocket connection attempt
          await attemptWebSocketConnection()

          abortController.signal.addEventListener('abort', () => {
            get()._cleanupWebSocket()
            if (Object.keys(imageGenerationMap).length > 0) {
              updateAssistantImages(Object.values(imageGenerationMap))
            }
            set(state => ({
              conversations: state.conversations.map(conv =>
                conv.id === targetConversationId
                  ? { ...conv, isLoading: false }
                  : conv
              ),
              isLoading: false,
              abortController: null
            }))
          })

        } catch (error: any) {
          console.error('流式发送消息失败:', error)
          get()._cleanupWebSocket()
          set(state => ({
            conversations: state.conversations.map(conv =>
              conv.id === targetConversationId
                ? { ...conv, isLoading: false }
                : conv
            ),
            isLoading: false,
            abortController: null
          }))

          // Final fallback to HTTP
          try {
            console.log('尝试HTTP fallback')
            await get()._sendMessageNormal(content, targetConversationId, settings, apiKey, assistantMessageId, tools)
          } catch (httpError: any) {
            console.error('HTTP fallback也失败了:', httpError)
            throw httpError
          }
        }
      },

      _sendMessageNormal: async (content: string, targetConversationId: string, settings: any, apiKey: string, assistantMessageId: string, tools?: any[]) => {
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
              content: msg.content,
              ...(msg.images && msg.images.length > 0 ? { images: msg.images.map(img => ({
                type: img.mime_type.includes('image') ? 'image' : 'file',
                data: img.data,
                mime_type: img.mime_type
              })) } : {}),
              ...(msg.files && msg.files.length > 0 ? { files: msg.files.map(file => ({
                filename: file.filename,
                type: file.type,
                size: file.size,
                process_mode: file.processMode,
                openai_file_id: file.openai_file_id,
                vector_store_id: file.vector_store_id,
                status: file.status
              })) } : {})
            }))

          // 动态导入工具配置函数
          const { supportsNativeWebSearch, buildWebSearchToolConfig } = await import('../lib/webSearchUtils')
          
          // 构建基础请求体
          const requestBody: any = {
            provider: settings.chatProvider,
            model: settings.chatModel,
            messages,
            api_key: apiKey,
            thinking_mode: settings.thinkingMode || settings.chatModel?.includes('gpt-5') || false,
            reasoning_summaries: 'auto',
            reasoning: settings.reasoning || 'medium',
            stream: false
          }

          // 为OpenAI兼容提供商添加base_url
          if (settings.chatProvider === 'openai_compatible' && settings.openaiCompatibleConfig?.baseUrl) {
            requestBody.base_url = settings.openaiCompatibleConfig.baseUrl
          }

          // 处理所有工具(搜索、MCP服务器、函数调用)
          if (tools && tools.length > 0) {
            const requestTools: any[] = []

            // 检查是否有搜索工具
            if (tools.some(tool => tool.id === 'search')) {
              const useNativeSearch = supportsNativeWebSearch(settings.chatProvider, settings.chatModel)
              const webSearchTool = buildWebSearchToolConfig(useNativeSearch, settings.chatProvider)
              requestTools.push(webSearchTool)
              requestBody.use_native_search = useNativeSearch
            }

            // 添加MCP服务器和函数调用工具
            const mcpAndFunctionTools = tools.filter(tool =>
              tool.id !== 'search' && tool.id !== 'image-generation'
            )
            requestTools.push(...mcpAndFunctionTools)

            if (requestTools.length > 0) {
              requestBody.tools = requestTools
            }
          }

          const response = await fetch('/api/v1/chat/completion', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
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
          
          // 提取图片生成结果
          const imageGenerations = data.choices[0]?.message?.image_generations || []

          // 提取引用和来源信息
          const { extractCitations, extractSearchSources } = await import('../lib/webSearchUtils')
          const citations = extractCitations(data.choices[0]?.message)
          const sources = extractSearchSources(data)

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
                            ...(reasoningContent && { reasoning: reasoningContent }),
                            ...(citations.length > 0 && { citations }),
                            ...(sources.length > 0 && { sources }),
                            ...(imageGenerations.length > 0 && { image_generations: imageGenerations })
                          }
                        : msg
                    ),
                    title: conv.messages.length <= 2 ? content.slice(0, 20) + '...' : conv.title,
                    updated_at: new Date().toISOString(),
                    isLoading: false  // HTTP响应完成，重置对话的加载状态
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
          set(state => ({
            conversations: state.conversations.map(conv =>
              conv.id === targetConversationId
                ? { ...conv, isLoading: false }
                : conv
            ),
            isLoading: false,
            abortController: null
          }))

          // 使用工具函数格式化错误
          const formattedError = formatWebSearchError(error)

          throw new Error(formattedError.message)
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
      },

      _prewarmWebSocket: () => {
        // 预热WebSocket连接(不发送实际请求)
        const { wsPrewarmed, wsConnection } = get()

        // 如果已经预热过或已有连接,跳过
        if (wsPrewarmed || (wsConnection && wsConnection.readyState === WebSocket.OPEN)) {
          return
        }

        console.log('[WebSocket] 开始预热连接...')

        const getWebSocketUrl = () => {
          if (process.env.NODE_ENV === 'development') {
            return 'ws://localhost:8000/api/v1/chat/stream'
          } else {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ||
              process.env.NEXT_PUBLIC_API_BASE_URL ||
              `${window.location.protocol}//${window.location.host}`

            return backendUrl
              .replace('https:', 'wss:')
              .replace('http:', 'ws:') + '/api/v1/chat/stream'
          }
        }

        const wsUrl = getWebSocketUrl()

        // 异步预热,不阻塞主线程
        get()._createWebSocketConnection(wsUrl)
          .then(ws => {
            console.log('[WebSocket] 预热成功')
            set({ wsConnection: ws, wsPrewarmed: true })
            get()._setupHeartbeat(ws)
          })
          .catch(err => {
            console.warn('[WebSocket] 预热失败(将在发送消息时重试):', err)
            set({ wsPrewarmed: true }) // 标记已尝试预热,避免重复
          })
      }
    }),
    {
      name: 'chat-store',
      version: 1,
      // 自定义存储配置，避免存储过大的数据
      partialize: (state) => ({
        conversations: state.conversations.map(conv => ({
          ...conv,
          messages: conv.messages.map(msg => ({
            ...msg,
            // 移除图片生成结果中的 base64 数据（只保留元数据）
            image_generations: msg.image_generations?.map(img => ({
              id: img.id,
              type: img.type,
              status: img.status,
              revised_prompt: img.revised_prompt
              // 不保存 result (base64 数据)
            })),
            // 移除用户上传的图片数据
            images: msg.images?.map(img => ({
              id: img.id,
              filename: img.filename,
              mime_type: img.mime_type,
              size: img.size
              // 不保存 data (base64 数据)
            }))
          }))
        })),
        currentConversationId: state.currentConversationId
        // 不存储 isLoading, abortController, WebSocket 相关状态
      }),
      // 添加错误处理
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate store:', error)
          // 清空可能损坏的数据
          try {
            localStorage.removeItem('chat-store')
          } catch (e) {
            console.error('Failed to clear corrupted store:', e)
          }
        }
      }
    }
  )
)

// 添加选择器函数来获取当前对话
export const useCurrentConversation = () => {
  return useChatStore((state) => 
    state.conversations.find(conv => conv.id === state.currentConversationId) || null
  )
}
