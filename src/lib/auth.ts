export function getLoginPath(callbackPath?: string): string {
  if (callbackPath) {
    return `/login?from=${encodeURIComponent(callbackPath)}`
  }
  return '/login'
}
