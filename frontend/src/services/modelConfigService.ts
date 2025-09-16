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
        },
        google: {
          name: "Google",
          description: "Google Gemini 模型",
          supports_thinking: true,
          models: {
            "gemini-2.5-pro": {
              name: "Gemini 2.5 Pro",
              description: "Google最强推理模型，支持复杂任务",
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
              description: "最新多模态模型，速度快、功能全",
              api_type: "generate_content",
              context_length: 1000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: false,
              supports_streaming: true,
              pricing: { input: 0.075, output: 0.3 }
            },
            "gemini-2.5-flash-lite": {
              name: "Gemini 2.5 Flash Lite",
              description: "速度最快、成本最低的多模态模型",
              api_type: "generate_content",
              context_length: 1000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: false,
              supports_streaming: true,
              pricing: { input: 0.0375, output: 0.15 }
            },
            "gemini-2.5-flash-image": {
              name: "Gemini 2.5 Flash Image",
              description: "专门的图像生成模型",
              api_type: "generate_content",
              context_length: 32000,
              supports_vision: false,
              supports_function_calling: false,
              supports_thinking: false,
              supports_streaming: false,
              pricing: { input: 30.0, output: 30.0 }
            },
            "gemini-2.0-flash-exp": {
              name: "Gemini 2.0 Flash (Experimental)",
              description: "实验性最新模型，支持思考模式",
              api_type: "generate_content",
              context_length: 1000000,
              supports_vision: true,
              supports_function_calling: true,
              supports_thinking: true,
              supports_streaming: true,
              pricing: { input: 0.075, output: 0.3 }
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

  // Google 模型类型判断
  async isGoogleImageModel(modelId: string): Promise<boolean> {
    try {
      const config = await this.loadConfig()
      const googleModels = config.providers.google?.models || {}
      const modelConfig = googleModels[modelId]
      return modelId.includes('image') || modelConfig?.name?.toLowerCase().includes('image') || false
    } catch (error) {
      console.warn('无法检查Google图像模型类型，使用回退逻辑:', error)
      const imageModels = ['gemini-2.5-flash-image', 'gemini-image', 'imagen-4']
      return imageModels.some(model => modelId.includes(model))
    }
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