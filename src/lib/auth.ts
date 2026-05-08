export function getLoginPath(callbackPath?: string): string {
  if (callbackPath) {
    return `/login?from=${encodeURIComponent(callbackPath)}`
  }
  return '/login'
}

export function isSafeRedirectPath(path: string | null | undefined): boolean {
  if (!path) return false
  if (typeof path !== 'string') return false
  if (path.length === 0 || path.length > 1024) return false
  // Must start with single slash, not double-slash (protocol-relative) or backslash.
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.startsWith('/\\')) return false
  return true
}
