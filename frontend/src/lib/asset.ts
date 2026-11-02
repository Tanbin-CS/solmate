// Resolve a file in /public against the deployment base path (/solmate/ on GitHub Pages).
// Absolute URLs (e.g. NASA GIBS imagery) pass through unchanged.
export function asset(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
