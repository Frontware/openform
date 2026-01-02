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
