import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
    })

    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', message: 'Backend not available' },
        { status: 503 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 503 }
    )
  }
}