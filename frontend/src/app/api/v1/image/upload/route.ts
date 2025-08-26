import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get backend URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
                      process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'http://localhost:8000'
    
    // Forward the request to the backend
    const response = await fetch(`${backendUrl}/api/v1/image/upload`, {
      method: 'POST',
      body: request.body,
      headers: {
        // Don't include Content-Type - let fetch set it for FormData
        ...(request.headers.get('authorization') && {
          'authorization': request.headers.get('authorization')!
        })
      },
      // @ts-ignore
      duplex: 'half'
    })

    if (!response.ok) {
      const errorData = await response.json()
      return Response.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
    
  } catch (error: any) {
    console.error('Image upload proxy error:', error)
    return Response.json(
      { detail: '图片上传失败' }, 
      { status: 500 }
    )
  }
}