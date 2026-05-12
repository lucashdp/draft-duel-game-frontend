export const FROM_STORAGE_KEY = 'dd_auth_from'

export function getLoginPath(callbackPath?: string): string {
  if (callbackPath) {
    return `/login?from=${encodeURIComponent(callbackPath)}`
  }
  return '/login'
}

export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false
  if (path.length > 1024) return false
  // Must start with single slash, not double-slash (protocol-relative) or backslash.
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.startsWith('/\\')) return false
  return true
}
