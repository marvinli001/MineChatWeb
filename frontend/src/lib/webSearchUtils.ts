/**
 * Web Search Utility Functions
 * 根据 OpenAI 文档实现的 Web Search 支持判定和配置逻辑
 */

import { UserLocation } from '@/lib/types'

/**
 * 判断指定模型是否支持新版 web_search 工具
 * 基于 OpenAI 和 Anthropic 文档中的兼容型号说明
 */
export function supportsNativeWebSearch(provider: string, model: string): boolean {
  if (provider === 'openai') {
    // 根据 OpenAI 文档，支持新版 web_search 工具的模型
    const supportedModels = [
      'gpt-4o-mini',
      'gpt-4o', 
      'gpt-4.1-mini',
      'gpt-4.1',
      'o4-mini',
      'o3',
      'gpt-5'  // with reasoning levels low, medium and high
    ]

    return supportedModels.some(supportedModel => 
      model.includes(supportedModel) || model.startsWith(supportedModel)
    )
  }
  
  if (provider === 'anthropic') {
    // 根据 Anthropic 文档，支持 web_search_20250305 工具的模型
    const supportedAnthropicModels = [
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-sonnet-4-5',  // Claude Sonnet 4.5 (短版本)
      'claude-sonnet-4-5-20250929',  // Claude Sonnet 4.5 (完整版本)
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',  // 配置文件中的实际模型ID
      'claude-3-5-haiku-latest',
      'claude-3-5-haiku-20241022'    // 配置文件中的实际模型ID
    ]

    return supportedAnthropicModels.includes(model)
  }

  return false
}

/**
 * 获取用户位置配置
 * 默认使用 Pacific/Auckland 时区
 */
export function getUserLocation(): UserLocation {
  // 根据需求，用户地区为 Pacific/Auckland
  return {
    type: 'approximate',
    country: 'NZ',  // 新西兰
    city: 'Auckland',
    region: 'Auckland',
    timezone: 'Pacific/Auckland'
  }
}

/**
 * 构建 web search 工具配置
 * 支持 OpenAI web_search、Anthropic web_search_20250305 和回退版本
 */
export function buildWebSearchToolConfig(useNativeSearch: boolean, provider?: string): any {
  const userLocation = getUserLocation()

  if (useNativeSearch) {
    if (provider === 'anthropic') {
      // 使用 Anthropic web_search_20250305 工具格式
      return {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
        user_location: userLocation
      }
    } else {
      // 使用 OpenAI web_search 工具格式
      return {
        type: 'web_search',
        user_location: userLocation,
        search_context_size: 'medium'
      }
    }
  } else {
    // 回退到旧版 web_search_preview 实现
    return {
      type: 'web_search_preview',
      user_location: userLocation,
      search_context_size: 'medium'
    }
  }
}

/**
 * 提取响应中的引用信息
 */
export function extractCitations(content: any): any[] {
  if (!content || !content.annotations) {
    return []
  }

  return content.annotations
    .filter((annotation: any) => annotation.type === 'url_citation')
    .map((citation: any) => ({
      start_index: citation.start_index,
      end_index: citation.end_index,
      url: citation.url,
      title: citation.title
    }))
}

/**
 * 提取搜索来源信息
 * 支持新版和旧版响应格式
 */
export function extractSearchSources(response: any): any[] {
  const sources: any[] = []
  
  try {
    // 新版 Responses API 格式：检查 output 数组
    if (response.output && Array.isArray(response.output)) {
      response.output.forEach((item: any) => {
        if (item.type === 'web_search_call') {
          // 从搜索调用的action中提取来源
          if (item.action && item.action.sources) {
            item.action.sources.forEach((source: any) => {
              sources.push({
                url: source.url,
                title: source.title || extractDomain(source.url),
                domain: extractDomain(source.url),
                snippet: source.snippet || source.description || ''
              })
            })
          }
        }
      })
    }

    // 旧版格式：检查直接的 sources 字段
    if (response.sources && Array.isArray(response.sources)) {
      response.sources.forEach((source: any) => {
        sources.push({
          url: source.url,
          title: source.title || extractDomain(source.url),
          domain: extractDomain(source.url),
          snippet: source.snippet || source.description || ''
        })
      })
    }

    // 如果还没有找到来源，尝试从消息的annotations中提取
    if (sources.length === 0 && response.choices && response.choices[0]?.message?.content) {
      const message = response.choices[0].message
      if (message.annotations) {
        message.annotations
          .filter((ann: any) => ann.type === 'url_citation')
          .forEach((citation: any) => {
            sources.push({
              url: citation.url,
              title: citation.title || extractDomain(citation.url),
              domain: extractDomain(citation.url),
              snippet: ''
            })
          })
      }
    }
  } catch (error) {
    console.warn('提取搜索来源时出错:', error)
  }

  // 去重
  const uniqueSources = sources.filter((source, index, self) => 
    index === self.findIndex(s => s.url === source.url)
  )

  return uniqueSources
}

/**
 * 从URL中提取域名
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return ''
  }
}

/**
 * 格式化错误信息为用户友好的格式
 */
export function formatWebSearchError(error: any): { code: string; message: string; details?: any } {
  if (typeof error === 'string') {
    return {
      code: 'SEARCH_ERROR',
      message: error
    }
  }

  if (error?.response?.data) {
    const data = error.response.data
    return {
      code: data.code || 'API_ERROR', 
      message: data.message || '网络搜索失败',
      details: data.details
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error?.message || '网络搜索出现未知错误'
  }
}