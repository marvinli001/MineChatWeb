export interface ImageAttachment {
  id: string
  filename: string
  mime_type: string
  data: string  // base64 data
  size: number
}

export type FileProcessMode = 'direct' | 'code_interpreter' | 'file_search'

export type FileUploadStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'error'

export interface FileAttachment {
  id: string
  filename: string
  type: string  // MIME type
  size: number
  processMode: FileProcessMode
  status: FileUploadStatus
  progress?: number
  openai_file_id?: string
  vector_store_id?: string
  error?: string
  processing_result?: {
    annotations?: any[]
    generated_files?: any[]
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: ImageAttachment[]
  files?: FileAttachment[]
  tools?: Tool[]  // 添加工具支持
  reasoning?: string
  timestamp?: string
  created_at?: string
  thinking_start_time?: number  // 思考开始时间戳
  citations?: Citation[]  // 添加引用支持
  sources?: SearchSource[]  // 添加来源支持
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

// 工具相关类型
export interface Tool {
  id: string
  name: string
  type: string
  config?: any
}

// 搜索引用类型
export interface Citation {
  start_index: number
  end_index: number
  url: string
  title: string
}

// 搜索来源类型
export interface SearchSource {
  url: string
  title: string
  domain: string
  snippet: string
}

// 用户位置类型
export interface UserLocation {
  type: 'approximate'
  country?: string
  city?: string
  region?: string
  timezone?: string
}

// React Syntax Highlighter 类型定义
export interface SyntaxHighlighterProps {
  children: string
  style?: any
  language?: string
  PreTag?: string
  [key: string]: any
}