export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  timestamp?: string
  created_at?: string
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
  user_id?: string
}

export interface ApiProvider {
  id: string
  name: string
  models: string[]
  supports_thinking?: boolean
}

export interface VoiceConfig {
  provider: string
  voice: string
  language: string
}

export interface ImageConfig {
  provider: string
  model: string
  size: string
  quality: string
}

export interface User {
  id: string
  username: string
  email?: string
  avatar?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// 思考预算类型定义
export type ThinkingBudget = 'low' | 'medium' | 'high'

// React Syntax Highlighter 类型定义
export interface SyntaxHighlighterProps {
  children: string
  style?: any
  language?: string
  PreTag?: string
  [key: string]: any
}