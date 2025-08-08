export interface ModelConfig {
  name: string
  description: string
  api_type: string
  context_length: number
  supports_vision: boolean
  supports_function_calling: boolean
  supports_thinking?: boolean
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
  private readonly configUrl = 'https://raw.githubusercontent.com/marvinli001/MineChatWeb/main/models-config.json'

  async loadConfig(): Promise<ModelsConfig> {
    if (this.config) {
      return this.config
    }

    try {
      const response = await fetch(this.configUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`)
      }
      
      this.config = await response.json()
      return this.config!
    } catch (error) {
      console.error('Failed to load model config:', error)
      // 返回默认配置
      return this.getDefaultConfig()
    }
  }

  private getDefaultConfig(): ModelsConfig {
    return {
      version: "1.0.0",
      last_updated: new Date().toISOString(),
      providers: {
        openai: {
          name: "OpenAI",
          description: "OpenAI 官方模型",
          supports_thinking: true,
          models: {
            "gpt-4o": {
              name: "GPT-4o",
              description: "最新的 GPT-4 模型",
              api_type: "chat_completions",
              context_length: 128000,
              supports_vision: true,
              supports_function_calling: true,
              pricing: { input: 5.0, output: 15.0 }
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
  isOpenAIResponsesAPI(modelId: string): boolean {
    const responsesAPIModels = [
      'chatgpt-4o-latest',
      'gpt-4o-realtime-preview',
      'gpt-4o-realtime-preview-2024-10-01'
    ]
    return responsesAPIModels.includes(modelId)
  }

  isOpenAIChatCompletionsAPI(modelId: string): boolean {
    return !this.isOpenAIResponsesAPI(modelId)
  }

  // 刷新配置
  async refreshConfig(): Promise<ModelsConfig> {
    this.config = null
    return this.loadConfig()
  }
}

export const modelConfigService = new ModelConfigService()