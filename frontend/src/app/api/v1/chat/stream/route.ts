import { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // 构建后端 WebSocket URL
  const backendWsUrl = BACKEND_URL.replace('http', 'ws') + '/api/v1/chat/stream'
  
  // 这里需要使用 WebSocket 代理逻辑
  // 由于 Next.js API 路由不直接支持 WebSocket，需要特殊处理
  
  return new Response('WebSocket endpoint - use direct connection in development', {
    status: 200
  })
}