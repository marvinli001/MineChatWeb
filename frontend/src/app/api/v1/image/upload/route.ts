import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get backend URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
                      process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'http://localhost:8000'
    
    // 获取原始FormData
    const formData = await request.formData()
    
    // Forward the request to the backend
    const response = await fetch(`${backendUrl}/api/v1/image/upload`, {
      method: 'POST',
      body: formData, // 直接使用FormData
      // 不设置Content-Type，让fetch自动处理multipart/form-data
    })

    if (!response.ok) {
      try {
        const errorData = await response.json()
        return Response.json(errorData, { status: response.status })
      } catch {
        // 如果无法解析JSON错误响应，返回通用错误
        return Response.json(
          { 
            code: response.status,
            message: `图片上传失败 (${response.status})`,
            details: { status: response.status }
          }, 
          { status: response.status }
        )
      }
    }

    const data = await response.json()
    return Response.json(data)
    
  } catch (error: any) {
    console.error('Image upload proxy error:', error)
    return Response.json(
      { 
        code: 500,
        message: '服务器代理错误',
        details: { error: error.message }
      }, 
      { status: 500 }
    )
  }
}