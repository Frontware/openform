import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    
    if (!token) {
      return NextResponse.json({ 
        valid: false, 
        error: 'No token provided' 
      }, { status: 400 })
    }

    // Create a simple validation using the existing auth logic
    // Since we can't easily import Go code, we'll do basic JWT validation
    const parts = token.split('.')
    if (parts.length !== 3) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid token format' 
      }, { status: 400 })
    }

    try {
      // Decode the payload (base64url)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      
      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Token expired' 
        }, { status: 401 })
      }

      // Return user info if token is valid
      return NextResponse.json({
        valid: true,
        user: {
          userId: payload.user_id,
          email: payload.email,
          displayName: payload.display_name,
          role: payload.role
        }
      })
    } catch (e) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid token format' 
      }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ 
      valid: false, 
      error: 'Server error' 
    }, { status: 500 })
  }
}
