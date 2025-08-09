import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  console.log('🚀 前端API路由被调用了！')
  console.log('🚀 时间:', new Date().toISOString())
  console.log('🚀 BACKEND_URL:', BACKEND_URL)
  
  try {
    const body = await request.json()
    console.log('🚀 收到请求体:', JSON.stringify(body, null, 2))
    
    // 转发请求到后端
    const response = await fetch(`${BACKEND_URL}/api/v1/chat/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    console.log('🚀 后端响应状态:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Backend API error', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('🚀 Proxy error:', error)
    return NextResponse.json(
      { error: 'Proxy error', message: error.message },
      { status: 500 }
    )
  }
}