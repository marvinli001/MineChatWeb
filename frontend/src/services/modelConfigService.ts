export interface ModelConfig {
  name: string
  description: string
  api_type: string
  context_length: number
  supports_vision: boolean
  supports_function_calling: boolean
  supports_thinking?: boolean
  supports_streaming?: boolean
  pricing: {
    input: number
    output: number
  }
}

export interface ProviderConfig {
  name: string
  description: string
  supports_thinking: boolean
  models: Record<string, ModelConfig>
}

export interface ModelsConfig {
  version: string
  last_updated: string
  providers: Record<string, ProviderConfig>
}

class ModelConfigService {
  private config: ModelsConfig | null = null
  private configCacheTime: number = 0
  private readonly configCacheTTL = 600000 // 10分钟缓存 (600秒 = 600000毫秒)
  private readonly configUrl = 'https://raw.githubusercontent.com/marvinli001/MineChatWeb/main/models-config.json'
  private readonly localStorageKey = 'models_config_cache'
  private readonly localStorageTimeKey = 'models_config_cache_time'
  private refreshTimer: NodeJS.Timeout | null = null

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  }

  constructor() {
    if (this.isBrowser()) {
      // 启动时从 localStorage 加载缓存
      this.loadFromLocalStorage()
      // 启动定时刷新
      this.startAutoRefresh()
    }
  }

  private loadFromLocalStorage(): void {
    if (!this.isBrowser()) {
      return
    }
    try {
      const cachedConfig = localStorage.getItem(this.localStorageKey)
      const cachedTime = localStorage.getItem(this.localStorageTimeKey)

      if (cachedConfig && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime)
        if (cacheAge < this.configCacheTTL) {
          this.config = JSON.parse(cachedConfig)
          this.configCacheTime = parseInt(cachedTime)
          console.log('[ModelConfig] 从 localStorage 加载配置缓存')
        } else {
          console.log('[ModelConfig] localStorage 缓存已过期')
          // 清除过期缓存
          localStorage.removeItem(this.localStorageKey)
          localStorage.removeItem(this.localStorageTimeKey)
        }
      }
    } catch (error) {
      console.warn('[ModelConfig] 从 localStorage 加载缓存失败:', error)
    }
  }

  private saveToLocalStorage(config: ModelsConfig): void {
    if (!this.isBrowser()) {
      return
    }
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(config))
      localStorage.setItem(this.localStorageTimeKey, Date.now().toString())
    } catch (error) {
      console.warn('[ModelConfig] 保存到 localStorage 失败:', error)
    }
  }

  private startAutoRefresh(): void {
    if (!this.isBrowser()) {
      return
    }
    // 每10分钟自动刷新一次
    this.refreshTimer = setInterval(() => {
      console.log('[ModelConfig] 自动刷新配置...')
      this.refreshConfig().catch(err => {
        console.warn('[ModelConfig] 自动刷新失败:', err)
      })
    }, this.configCacheTTL)
  }

  async loadConfig(forceRefresh: boolean = false): Promise<ModelsConfig> {
    const now = Date.now()

    // 检查缓存是否有效
    if (!forceRefresh && this.config && (now - this.configCacheTime < this.configCacheTTL)) {
      console.log('[ModelConfig] 使用内存缓存')
      return this.config
    }

    try {
      console.log('[ModelConfig] 从远程加载配置...')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

      const response = await fetch(this.configUrl, {
        signal: controller.signal,
        cache: 'no-cache'
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`)
      }

      this.config = await response.json()
      this.configCacheTime = now

      // 保存到 localStorage
      this.saveToLocalStorage(this.config)

      console.log('[ModelConfig] 远程配置加载成功并缓存')
      return this.config!
    } catch (error) {
      console.error('[ModelConfig] 远程加载失败:', error)

      // 如果有旧缓存,继续使用
      if (this.config) {
        console.log('[ModelConfig] 使用过期的缓存配置')
        return this.config
      }

      // 否则返回默认配置
      console.log('[ModelConfig] 使用默认配置')
      return this.getDefaultConfig()
    }
  }

  private getDefaultConfig(): ModelsConfig {
    return {
      version: "1.0.1",
      last_updated: new Date().toISOString(),
      providers: {
        openai: {
          name: "OpenAI",
          description: "OpenAI ????",
          supports_thinking: true,
          models: {
            "gpt-5.1": {
              name: "GPT-5.1",
              description: "??? GPT-5 ??????????????",
              api_type: "responses",
              context_length: 400000,
              supports_vision: true,
              supports_function_calling: true,
              supports_streaming: true,
              pricing: { input: 1.25, output: 10.0 }
            },
            "gpt-5": {
              name: "GPT-5",
              description: "??? GPT-5 ????????????",
              api_type: "responses",
              context_length: 400000,
              supports_vision: true,
              supports_function_calling: true,
              supports_streaming: true,
              pricing: { input: 1.25, output: 10.0 }
            },
            "gpt-4o": {
              name: "GPT-4o",
              description: "??? GPT-4 ??",
              api_type: "chat_completions",
              context_length: 128000,
              supports_vision: true,
              supports_function_calling: true,
              supports_streaming: true,
              pricing: { input: 5.0, output: 15.0 }
            }
          }
        },
        anthropic: {
          name: "Anthropic",
          description: "Anthropic Claude ??",
          supports_thinking: true,
          models: {
            "claude-opus-4-5": {
              name: "Claude Opus 4.5",
              description: "Premium model combining maximum intelligence with practical performance",
              api_type: "messages",
              context_length: 1000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 5.0, output: 25.0 }
            },
            "claude-opus-4-1-20250805": {
              name: "Claude Opus 4.1",
              description: "Claude ???????????????",
              api_type: "messages",
              context_length: 200000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 15.0, output: 75.0 }
            }
          }
        },
        google: {
          name: "Google",
          description: "Google Gemini ??",
          supports_thinking: true,
          models: {
            "gemini-3-pro-preview": {
              name: "Gemini 3 Pro (Preview)",
              description: "?? Gemini 3 ?????????????",
              api_type: "generate_content",
              context_length: 1000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 2.0, output: 12.0 }
            },
            "gemini-3-pro-image-preview": {
              name: "Gemini 3 Pro Image (Preview)",
              description: "Gemini 3 Pro tuned for image-heavy prompts and outputs",
              api_type: "generate_content",
              context_length: 65000,
              supports_vision: true,
              supports_function_calling: false,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 2.0, output: 0.134 }
            },
            "gemini-2.5-pro": {
              name: "Gemini 2.5 Pro",
              description: "Google?????????????",
              api_type: "generate_content",
              context_length: 2000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 3.0, output: 12.0 }
            },
            "gemini-2.5-flash": {
              name: "Gemini 2.5 Flash",
              description: "??????????????????????",
              api_type: "generate_content",
              context_length: 1000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 0.075, output: 0.3 }
            },
            "gemini-2.5-flash-lite": {
              name: "Gemini 2.5 Flash Lite",
              description: "??????????????????????",
              api_type: "generate_content",
              context_length: 1000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 0.0375, output: 0.15 }
            }
          }
        }
      }
    }
  }

  async getProviders(): Promise<Record<string, ProviderConfig>> {
    const config = await this.loadConfig()
    return config.providers
  }

  async getProviderModels(providerId: string): Promise<Record<string, ModelConfig>> {
    const config = await this.loadConfig()
    return config.providers[providerId]?.models || {}
  }

  async getModelConfig(providerId: string, modelId: string): Promise<ModelConfig | null> {
    const models = await this.getProviderModels(providerId)
    return models[modelId] || null
  }

  // OpenAI 模型 API 类型判断
  async isOpenAIResponsesAPI(modelId: string): Promise<boolean> {
    try {
      const config = await this.loadConfig()
      const openaiModels = config.providers.openai?.models || {}
      const modelConfig = openaiModels[modelId]
      return modelConfig?.api_type === 'responses'
    } catch (error) {
      console.warn('无法检查模型API类型，使用回退逻辑:', error)
      const responsesAPIModels = [
        'chatgpt-4o-latest',
        'gpt-4o-realtime-preview',
        'gpt-4o-realtime-preview-2024-10-01',
        'gpt-5', 'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest',
        'gpt-4o', 'gpt-4o-mini',
        'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
        'o1', 'o1-preview', 'o1-mini', 'o3', 'o3-mini', 'o4-mini'
      ]
      return responsesAPIModels.includes(modelId)
    }
  }

  async isOpenAIChatCompletionsAPI(modelId: string): Promise<boolean> {
    return !(await this.isOpenAIResponsesAPI(modelId))
  }

  // Google 模型类型判断
  async isGoogleImageModel(modelId: string): Promise<boolean> {
    try {
      const config = await this.loadConfig()
      const googleModels = config.providers.google?.models || {}
      const modelConfig = googleModels[modelId]
      return modelId.includes('image') || modelConfig?.name?.toLowerCase().includes('image') || false
    } catch (error) {
      console.warn('无法检查Google图像模型类型，使用回退逻辑:', error)
      const imageModels = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image', 'gemini-image', 'imagen-4', 'imagen-4.0', 'imagen-3.0']
      return imageModels.some(model => modelId.includes(model))
    }
  }

  // 检查模型是否支持流式输出
  async supportsStreaming(providerId: string, modelId: string): Promise<boolean> {
    try {
      const modelConfig = await this.getModelConfig(providerId, modelId)

      // Google 提供商的所有模型默认都支持流式(除非明确标记为不支持)
      if (providerId === 'google') {
        // 图片生成模型不支持流式
        if (modelId.includes('image')) {
          return false
        }
        // 其他所有 Google 模型都支持流式
        return true
      }

      return modelConfig?.supports_streaming || false
    } catch (error) {
      console.warn('无法检查模型流式支持，使用回退逻辑:', error)
      // 根据API文档，OpenAI、Anthropic 和 Google 的所有模型都支持流式输出
      if (providerId === 'openai' || providerId === 'anthropic') {
        return true
      }
      // Google 提供商默认支持流式(除了图片模型)
      if (providerId === 'google' && !modelId.includes('image')) {
        return true
      }
      return false
    }
  }

  // 检查模型是否为思考模型
  async isThinkingModel(providerId: string, modelId: string): Promise<boolean> {
    try {
      const modelConfig = await this.getModelConfig(providerId, modelId)
      return modelConfig?.supports_thinking || false
    } catch (error) {
      console.warn('无法检查模型思考支持:', error)
      return false
    }
  }

  // 获取提供商的最小（最便宜）模型
  async getCheapestModel(providerId: string): Promise<string | null> {
    try {
      const config = await this.loadConfig()
      const provider = config.providers[providerId]

      if (!provider || !provider.models) {
        return null
      }

      // 定义每个提供商的最小模型映射
      const cheapestModels: Record<string, string> = {
        'openai': 'gpt-5-nano',
        'anthropic': 'claude-haiku-4-5-20251001',
        'google': 'gemini-2.5-flash-lite',
        'deepseek': 'deepseek-chat',
        'openai_compatible': '' // 自定义提供商没有预定义的最小模型
      }

      const cheapestModelId = cheapestModels[providerId]

      // 验证模型是否存在于配置中
      if (cheapestModelId && provider.models[cheapestModelId]) {
        return cheapestModelId
      }

      // 如果预定义的模型不存在，查找价格最低的模型
      const models = Object.entries(provider.models)
      if (models.length === 0) {
        return null
      }

      // 按输入价格排序，选择最便宜的
      const sortedByPrice = models.sort((a, b) => {
        const priceA = a[1].pricing?.input || Infinity
        const priceB = b[1].pricing?.input || Infinity
        return priceA - priceB
      })

      return sortedByPrice[0][0]
    } catch (error) {
      console.warn('无法获取最小模型:', error)

      // 返回默认模型
      const defaultModels: Record<string, string> = {
        'openai': 'gpt-5-nano',
        'anthropic': 'claude-haiku-4-5-20251001',
        'google': 'gemini-2.5-flash-lite',
        'deepseek': 'deepseek-chat'
      }

      return defaultModels[providerId] || null
    }
  }

  // 刷新配置
  async refreshConfig(): Promise<ModelsConfig> {
    console.log('[ModelConfig] 手动刷新配置')
    return this.loadConfig(true) // 强制刷新
  }

  // 清理资源
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }
}

export const modelConfigService = new ModelConfigService()
