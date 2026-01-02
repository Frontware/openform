const TOKEN_KEY = 'weladee_token'

export interface WeladeeUser {
  userId: number
  email: string
  displayName: string
  role: string
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
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
    }
  } catch {
    return null
  }
}
