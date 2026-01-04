const TOKEN_KEY = 'weladee_token'

export interface WeladeeUser {
  userId: number
  email: string
  displayName: string
  role: string
  customerType: 'sme' | 'standard' | 'enterprise'
  logoUrl?: string
  language?: string
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  // First check localStorage
  const localToken = localStorage.getItem(TOKEN_KEY)
  if (localToken) return localToken

  // If not in localStorage, check cookies
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === TOKEN_KEY && value) {
      return value
    }
  }

  return null
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  // Also set cookie for middleware (server-side auth check)
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${2 * 60 * 60}` // 2 hours
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  // Also clear cookie
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function signOut(): void {
  clearToken()
  if (typeof window !== 'undefined') {
    window.location.href = '/'
  }
}

// For testing purposes - check if using TEST token
export function isTestToken(): boolean {
  const token = getToken()
  return token === 'TEST_TOKEN' || token === 'test-token'
}

// Parse JWT to extract user claims
// JWT format: header.payload.signature
// payload contains: user_id, email, display_name, role, exp, etc.
export function parseJWT(token: string): WeladeeUser | null {
  if (isTestToken()) {
    // Return test user for TEST_TOKEN
    return {
      userId: 1,
      email: 'test@weladee.com',
      displayName: 'Test User',
      role: 'admin',
      customerType: 'enterprise',
      logoUrl: 'https://weladee.com/logo.png',
      language: 'en',
    }
  }

  try {
    // Split JWT into parts
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Decode payload (base64url)
    const payload = parts[1]
    // Add padding if needed
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)

    // Parse JSON
    const decoded = atob(padded)
    const claims = JSON.parse(decoded)

    return {
      userId: claims.user_id || claims.sub,
      email: claims.email || '',
      displayName: claims.display_name || claims.name || '',
      role: claims.role || 'user',
      customerType: claims.customer_type || 'sme',
      logoUrl: claims.logo_url,
      language: claims.language || 'en',
    }
  } catch {
    return null
  }
}
