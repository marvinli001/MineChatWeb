import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage, Conversation } from '@/lib/types'

interface ChatStore {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  abortController: AbortController | null
  
  // 添加 currentConversation 计算属性，保持与现有代码兼容
  currentConversation: Conversation | null
  
  createNewConversation: () => void
  setCurrentConversation: (id: string) => void
  deleteConversation: (id: string) => void
  sendMessage: (content: string) => Promise<void>
  stopGeneration: () => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      isLoading: false,
      abortController: null,
      
      // 计算属性：当前对话
      get currentConversation() {
        const state = get()
        return state.conversations.find(conv => conv.id === state.currentConversationId) || null
      },

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

      sendMessage: async (content: string) => {
        // 动态导入 settingsStore 以避免循环依赖
        const { useSettingsStore } = await import('./settingsStore')
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

        // 添加用户消息
        const userMessage: ChatMessage = {
          role: 'user',
          content,
          timestamp: new Date().toISOString()
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

          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString()
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

          // 自动同步到云端（如果启用）
          // TODO: Implement cloud sync service
          if (settings.enableCloudSync && settings.autoSync) {
            console.log('Cloud sync is enabled but not implemented yet')
          }

        } catch (error: any) {
          console.error('发送消息失败:', error)
          set({ isLoading: false, abortController: null })
          throw error
        }
      }
    }),
    {
      name: 'chat-store',
      version: 1
    }
  )
)