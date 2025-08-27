import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('file_id')
    const containerId = searchParams.get('container_id')
    const filename = searchParams.get('filename') || 'download'
    
    if (!fileId && !containerId) {
      return Response.json(
        { error: 'Missing file_id or container_id parameter' },
        { status: 400 }
      )
    }

    // Get backend URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
                      process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'http://localhost:8000'
    
    // Forward the request to the backend
    const response = await fetch(`${backendUrl}/api/v1/file/download?${searchParams.toString()}`, {
      method: 'GET',
    })

    if (!response.ok) {
      try {
        const errorData = await response.json()
        return Response.json(errorData, { status: response.status })
      } catch {
        return Response.json(
          { 
            code: response.status,
            message: `文件下载失败 (${response.status})`,
            details: { status: response.status }
          }, 
          { status: response.status }
        )
      }
    }

    // Get the file data
    const fileBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    
    // Return file with proper headers
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    })
    
  } catch (error: any) {
    console.error('File download proxy error:', error)
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

export async function POST(request: NextRequest) {
  try {
    // Get backend URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
                      process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'http://localhost:8000'
    
    const body = await request.json()
    
    // Forward the request to the backend
    const response = await fetch(`${backendUrl}/api/v1/file/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      try {
        const errorData = await response.json()
        return Response.json(errorData, { status: response.status })
      } catch {
        return Response.json(
          { 
            code: response.status,
            message: `文件下载失败 (${response.status})`,
            details: { status: response.status }
          }, 
          { status: response.status }
        )
      }
    }

    const data = await response.json()
    return Response.json(data)
    
  } catch (error: any) {
    console.error('File download proxy error:', error)
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