
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb21wYW55X2lkIjoxOTIsImN1c3RvbWVyX3R5cGUiOiJlbnRlcnByaXNlIiwiZGlzcGxheV9uYW1lIjoi4Lia4Lij4Li04Lip4Lix4LiXIOC4n-C4o-C5ieC4reC4meC4l-C5jOC5geC4p-C4o-C5jCDguK3guLTguJnguYDguJXguK3guKPguYzguYDguJnguIrguLHguYjguJnguYHguJnguKUg4LiI4Liz4LiB4Lix4LiUIiwiZW1haWwiOiJhcmVlcmF0QGZyb250d2FyZS5jb20iLCJleHAiOjE3Njc4NTIxNDksImlhdCI6MTc2Nzg0NDk0OSwiaXNzIjoid2VsYWRlZS1mb3JtIiwibGFuZ3VhZ2UiOiJ0aCIsImxvZ29fdXJsIjoiaHR0cHM6Ly9pbWFnZXMud2VsYWRlZS5jb20vY29tcGFueS8xOTIud2VicD90cz0xNDk2ODkyODU3IiwicmVkaXJlY3RfdXJsIjoiaHR0cHM6Ly9kZXYtZm9ybS53ZWxhZGVlLmNvbS8iLCJyb2xlIjoiYWRtaW4iLCJ1c2VyX2lkIjoxOTJ9.4mOodmgz2fBD_T-Q2CWlXsXVO3K2cP_o0gTC6ehjOrU";

function parseJWTOld(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const decoded = atob(padded)
    const claims = JSON.parse(decoded)
    return claims.display_name
  } catch (e) {
    return e.message
  }
}

function parseJWTNew(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    
    // New logic
    const binaryString = atob(padded)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const decoded = new TextDecoder().decode(bytes)
    
    const claims = JSON.parse(decoded)
    return claims.display_name
  } catch (e) {
    return e.message
  }
}

console.log("Old way:", parseJWTOld(token));
console.log("New way:", parseJWTNew(token));
