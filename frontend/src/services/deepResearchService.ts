interface DeepResearchFile {
  name: string
  type: string
  size: number
  openai_file_id?: string
  vector_store_id?: string
}

interface DeepResearchTask {
  id: string
  title: string
  query: string
  model: string
  status: 'running' | 'completed' | 'failed' | 'warning'
  created_at: string
  result?: string
  files?: DeepResearchFile[]
  openai_response_id?: string
  warning_message?: string
}

interface CreateTaskRequest {
  query: string
  model: string
  api_key: string
  files?: DeepResearchFile[]
  base_url?: string
  enable_web_search?: boolean
  enable_code_interpreter?: boolean
  vector_store_ids?: string[]
  max_tool_calls?: number
}

interface CreateTaskResponse {
  task: DeepResearchTask
  message: string
}

interface TaskListResponse {
  tasks: DeepResearchTask[]
  total: number
}

interface FileUploadResponse {
  name: string
  type: string
  size: number
  openai_file_id: string
  vector_store_id: string
  message: string
}

interface ClarificationRequest {
  query: string
  api_key: string
  base_url?: string
}

interface ClarificationResponse {
  clarification_questions: string[]
  message: string
}

interface EnhanceRequest {
  query: string
  clarifications: Record<string, string>
  api_key: string
  base_url?: string
}

interface EnhanceResponse {
  enhanced_query: string
  message: string
}

class DeepResearchService {
  private baseUrl: string
  private ws: WebSocket | null = null
  private wsCallbacks: Map<string, Function> = new Map()

  constructor() {
    this.baseUrl = '/api/v1/deep-research'
  }

  private getWebSocketUrl(): string {
    if (typeof window === 'undefined') {
      return '/api/v1/deep-research/ws'
    }
    return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/v1/deep-research/ws`
  }

  // WebSocket连接管理
  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.getWebSocketUrl())
        
        this.ws.onopen = () => {
          console.log('深度研究WebSocket连接已建立')
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            const callback = this.wsCallbacks.get(data.type)
            if (callback) {
              callback(data)
            }
          } catch (error) {
            console.error('解析WebSocket消息时出错:', error)
          }
        }
        
        this.ws.onerror = (error) => {
          console.error('深度研究WebSocket错误:', error?.message || error)
          reject(new Error(`WebSocket连接失败: ${error?.message || '未知错误'}`))
        }
        
        this.ws.onclose = () => {
          console.log('深度研究WebSocket连接已关闭')
          this.ws = null
          // 自动重连
          setTimeout(() => {
            this.connectWebSocket()
          }, 5000)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  // 订阅任务状态更新
  subscribeToTask(taskId: string, callback: (data: any) => void) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe_task',
        task_id: taskId
      }))

      this.wsCallbacks.set('task_update', callback)
    } else {
      // 如果WebSocket未连接，尝试重新连接后再订阅
      this.connectWebSocket().then(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'subscribe_task',
            task_id: taskId
          }))

          this.wsCallbacks.set('task_update', callback)
        }
      }).catch(error => {
        console.error('重新连接WebSocket失败:', error)
      })
    }
  }

  // 取消订阅
  unsubscribe(type: string) {
    this.wsCallbacks.delete(type)
  }

  // 上传文件
  async uploadFile(file: File, apiKey: string, baseUrl?: string): Promise<DeepResearchFile> {
    const formData = new FormData()
    formData.append('file', file)

    const params = new URLSearchParams()
    params.append('api_key', apiKey)
    if (baseUrl) {
      params.append('base_url', baseUrl)
    }

    const response = await fetch(`${this.baseUrl}/upload?${params.toString()}`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '文件上传失败')
    }

    const result: FileUploadResponse = await response.json()
    return {
      name: result.name,
      type: result.type,
      size: result.size,
      openai_file_id: result.openai_file_id,
      vector_store_id: result.vector_store_id
    }
  }

  // 创建深度研究任务
  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '创建任务失败')
    }

    return response.json()
  }

  // 获取任务列表
  async getTasks(limit = 50, offset = 0): Promise<TaskListResponse> {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())

    const response = await fetch(`${this.baseUrl}/tasks?${params.toString()}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '获取任务列表失败')
    }

    return response.json()
  }

  // 获取单个任务
  async getTask(taskId: string): Promise<DeepResearchTask> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '获取任务详情失败')
    }

    return response.json()
  }

  // 停止任务
  async stopTask(taskId: string): Promise<{ message: string; task_id: string }> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/stop`, {
      method: 'POST'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '停止任务失败')
    }

    return response.json()
  }

  // 删除任务
  async deleteTask(taskId: string): Promise<{ message: string; task_id: string }> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '删除任务失败')
    }

    return response.json()
  }

  // 获取澄清问题
  async getClarificationQuestions(request: ClarificationRequest): Promise<ClarificationResponse> {
    const response = await fetch(`${this.baseUrl}/clarification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '获取澄清问题失败')
    }

    return response.json()
  }

  // 增强查询
  async enhanceQuery(request: EnhanceRequest): Promise<EnhanceResponse> {
    const response = await fetch(`${this.baseUrl}/enhance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '增强查询失败')
    }

    return response.json()
  }

  // 断开WebSocket连接
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.wsCallbacks.clear()
  }
}

export const deepResearchService = new DeepResearchService()
export type { DeepResearchTask, DeepResearchFile, CreateTaskRequest, TaskListResponse }