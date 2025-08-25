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
  reasoning: 'low' | 'medium' | 'high'
  
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
  reasoning: 'medium',
  theme: 'auto',
  language: 'zh-CN',
  enableCloudSync: false,
  autoSync: false,
  cloudflareConfig: {
    accountId: '',
    apiToken: '',
    databaseId: ''
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
      }
    }),
    {
      name: 'settings-store'
    }
  )
)