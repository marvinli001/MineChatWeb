import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage, Conversation } from '@/lib/types'
import { useSettingsStore } from './settingsStore'
import { generateId } from '@/lib/utils'

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  abortController: AbortController | null
  
  // Actions
  createNewConversation: () => void
  setCurrentConversation: (id: string) => void
  sendMessage: (content: string) => Promise<void>
  stopGeneration: () => void
  deleteConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void
  clearAllConversations: () => void
  
  // Cloud sync actions
  syncToCloud: () => Promise<void>
  syncFromCloud: () => Promise<void>
  
  // Getters
  currentConversation: Conversation | null
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      isLoading: false,
      abortController: null,

      get currentConversation() {
        const { conversations, currentConversationId } = get()
        return conversations.find(c => c.id === currentConversationId) || null
      },

      createNewConversation: () => {
        const newConversation: Conversation = {
          id: generateId(),
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

      sendMessage: async (content: string) => {
        const { currentConversation } = get()
        const settings = useSettingsStore.getState().settings

        if (!currentConversation) {
          get().createNewConversation()
        }

        // 添加用户消息
        const userMessage: ChatMessage = {
          role: 'user',
          content,
          timestamp: new Date().toISOString()
        }

        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === state.currentConversationId
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
          const { currentConversation: updatedConversation } = get()
          if (!updatedConversation) return

          if (!settings.chatProvider || !settings.chatModel) {
            throw new Error('请先在设置中配置AI模型')
          }

          const apiKey = settings.apiKeys[settings.chatProvider]
          if (!apiKey) {
            throw new Error(`请先在设置中配置${settings.chatProvider}的API密钥`)
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
            const error = await response.json()
            throw new Error(error.detail || '请求失败')
          }

          const data = await response.json()
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: data.choices[0]?.message?.content || '抱歉，我无法生成回复。',
            timestamp: new Date().toISOString()
          }

          set(state => ({
            conversations: state.conversations.map(conv =>
              conv.id === state.currentConversationId
                ? {
                    ...conv,
                    messages: [...conv.messages, assistantMessage],
                    title: conv.messages.length === 1 ? content.slice(0, 20) + '...' : conv.title,
                    updated_at: new Date().toISOString()
                  }
                : conv
            ),
            isLoading: false,
            abortController: null
          }))

          // 自动同步到云端
          if (settings.enableCloudSync && settings.autoSync) {
            try {
              await get().syncToCloud()
            } catch (error) {
              console.warn('自动云同步失败:', error)
            }
          }

        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log('请求被取消')
          } else {
            console.error('发送消息失败:', error)
            
            const errorMessage: ChatMessage = {
              role: 'assistant',
              content: `错误: ${error.message}`,
              timestamp: new Date().toISOString()
            }

            set(state => ({
              conversations: state.conversations.map(conv =>
                conv.id === state.currentConversationId
                  ? {
                      ...conv,
                      messages: [...conv.messages, errorMessage],
                      updated_at: new Date().toISOString()
                    }
                  : conv
              )
            }))
          }

          set({ isLoading: false, abortController: null })
        }
      },

      stopGeneration: () => {
        const { abortController } = get()
        if (abortController) {
          abortController.abort()
          set({ isLoading: false, abortController: null })
        }
      },

      deleteConversation: (id: string) => {
        set(state => ({
          conversations: state.conversations.filter(conv => conv.id !== id),
          currentConversationId: state.currentConversationId === id ? null : state.currentConversationId
        }))
      },

      updateConversationTitle: (id: string, title: string) => {
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === id
              ? { ...conv, title, updated_at: new Date().toISOString() }
              : conv
          )
        }))
      },

      clearAllConversations: () => {
        set({
          conversations: [],
          currentConversationId: null
        })
      },

      syncToCloud: async () => {
        const settings = useSettingsStore.getState().settings
        if (!settings.enableCloudSync) {
          throw new Error('云同步未启用')
        }

        const { conversations } = get()
        
        const response = await fetch('/api/v1/sync/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversations,
            cloudflare_config: settings.cloudflareConfig
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || '同步到云端失败')
        }
      },

      syncFromCloud: async () => {
        const settings = useSettingsStore.getState().settings
        if (!settings.enableCloudSync) {
          throw new Error('云同步未启用')
        }

        const response = await fetch('/api/v1/sync/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cloudflare_config: settings.cloudflareConfig
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || '从云端同步失败')
        }

        const data = await response.json()
        set({
          conversations: data.conversations || []
        })
      }
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId
      })
    }
  )
)