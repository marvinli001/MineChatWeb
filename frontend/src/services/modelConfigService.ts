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
              supports_streaming: true,
              pricing: { input: 5.0, output: 15.0 }
            }
          }
        },
        anthropic: {
          name: "Anthropic",
          description: "Anthropic Claude 模型",
          supports_thinking: true,
          models: {
            "claude-opus-4-1-20250805": {
              name: "Claude Opus 4.1",
              description: "Claude 最强模型",
              api_type: "messages",
              context_length: 200000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 15.0, output: 75.0 }
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
        'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest',
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

  // 检查模型是否支持流式输出
  async supportsStreaming(providerId: string, modelId: string): Promise<boolean> {
    try {
      const modelConfig = await this.getModelConfig(providerId, modelId)
      return modelConfig?.supports_streaming || false
    } catch (error) {
      console.warn('无法检查模型流式支持，使用回退逻辑:', error)
      // 根据API文档，OpenAI和Anthropic的所有模型都支持流式输出
      if (providerId === 'openai' || providerId === 'anthropic') {
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

  // 刷新配置
  async refreshConfig(): Promise<ModelsConfig> {
    this.config = null
    return this.loadConfig()
  }
}

export const modelConfigService = new ModelConfigService()