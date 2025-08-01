import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  
  // 界面设置
  theme: 'light' | 'dark' | 'auto'
  language: string
  
  // 同步设置
  enableCloudSync: boolean
  milvusConfig: {
    endpoint: string
    token: string
    collection: string
  }
}

interface SettingsState {
  settings: Settings
  initialized: boolean
  
  updateSettings: (newSettings: Partial<Settings>) => void
  resetSettings: () => void
  saveSettings: () => void
  initializeSettings: () => void
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
  theme: 'auto',
  language: 'zh-CN',
  enableCloudSync: false,
  milvusConfig: {
    endpoint: '',
    token: '',
    collection: 'chat_history'
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
        // 设置已经通过persist中间件自动保存到localStorage
        console.log('设置已保存')
      },

      initializeSettings: () => {
        // 应用主题设置
        const { theme } = get().settings
        if (theme === 'auto') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          document.documentElement.classList.toggle('dark', prefersDark)
        } else {
          document.documentElement.classList.toggle('dark', theme === 'dark')
        }
        
        set({ initialized: true })
      }
    }),
    {
      name: 'settings-store'
    }
  )
)