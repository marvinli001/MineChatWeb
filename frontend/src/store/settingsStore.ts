import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomModel {
  id: string
  name: string
  description: string
  supports_reasoning: boolean
  created_at: string
}

export interface Settings {
  // API设置
  apiKeys: Record<string, string>
  
  // 模型设置
  chatProvider: string
  chatModel: string
  voiceProvider: string
  voiceModel: string
  imageProvider: string
  imageModel: string
  
  // 功能设置
  thinkingMode: boolean
  streamMode: boolean
  reasoning: 'instant' | 'low' | 'medium' | 'high'
  
  // 界面设置
  theme: 'light' | 'dark' | 'auto'
  language: string
  
  // 云同步设置
  enableCloudSync: boolean
  autoSync: boolean
  cloudflareConfig: {
    accountId: string
    apiToken: string
    databaseId: string
  }
  
  // OpenAI兼容提供商设置
  openaiCompatibleConfig: {
    baseUrl: string
    customModels: CustomModel[]
  }
}

interface SettingsState {
  settings: Settings
  initialized: boolean
  
  updateSettings: (newSettings: Partial<Settings>) => void
  resetSettings: () => void
  saveSettings: () => void
  initializeSettings: () => void
  
  // OpenAI兼容提供商自定义模型管理
  addCustomModel: (model: Omit<CustomModel, 'id' | 'created_at'>) => void
  removeCustomModel: (modelId: string) => void
  updateCustomModel: (modelId: string, updates: Partial<CustomModel>) => void
  getCustomModel: (modelId: string) => CustomModel | undefined
}

const defaultSettings: Settings = {
  apiKeys: {},
  chatProvider: '',
  chatModel: '',
  voiceProvider: '',
  voiceModel: '',
  imageProvider: '',
  imageModel: '',
  thinkingMode: false,
  streamMode: true,
  reasoning: 'medium',
  theme: 'auto',
  language: 'zh-CN',
  enableCloudSync: false,
  autoSync: false,
  cloudflareConfig: {
    accountId: '',
    apiToken: '',
    databaseId: ''
  },
  openaiCompatibleConfig: {
    baseUrl: 'https://api.openai.com/v1',
    customModels: []
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      initialized: false,

      updateSettings: (newSettings) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings }
        }))
      },

      resetSettings: () => {
        set({ settings: defaultSettings })
      },

      saveSettings: () => {
        console.log('设置已保存到本地存储')
      },

      initializeSettings: () => {
        const { theme } = get().settings
        if (theme === 'auto') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          document.documentElement.classList.toggle('dark', prefersDark)
        } else {
          document.documentElement.classList.toggle('dark', theme === 'dark')
        }
        
        set({ initialized: true })
      },

      // OpenAI兼容提供商自定义模型管理
      addCustomModel: (model) => {
        const newModel: CustomModel = {
          ...model,
          id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_at: new Date().toISOString()
        }
        
        set(state => ({
          settings: {
            ...state.settings,
            openaiCompatibleConfig: {
              ...state.settings.openaiCompatibleConfig,
              customModels: [...state.settings.openaiCompatibleConfig.customModels, newModel]
            }
          }
        }))
      },

      removeCustomModel: (modelId) => {
        set(state => ({
          settings: {
            ...state.settings,
            openaiCompatibleConfig: {
              ...state.settings.openaiCompatibleConfig,
              customModels: state.settings.openaiCompatibleConfig.customModels.filter(m => m.id !== modelId)
            }
          }
        }))
      },

      updateCustomModel: (modelId, updates) => {
        set(state => ({
          settings: {
            ...state.settings,
            openaiCompatibleConfig: {
              ...state.settings.openaiCompatibleConfig,
              customModels: state.settings.openaiCompatibleConfig.customModels.map(m =>
                m.id === modelId ? { ...m, ...updates } : m
              )
            }
          }
        }))
      },

      getCustomModel: (modelId) => {
        return get().settings.openaiCompatibleConfig.customModels.find(m => m.id === modelId)
      }
    }),
    {
      name: 'settings-store'
    }
  )
)