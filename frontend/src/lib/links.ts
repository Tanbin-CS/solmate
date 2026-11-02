export const SITE = 'https://solmate-analog.web.app'

/**
 * In-app path for a link to this site, or null for any other URL. The origin must match
 * exactly, so a look-alike host (solmate-analog.web.app.example.com) stays external.
 */
export function ownSitePath(href: string): string | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  return url.origin === SITE ? `${url.pathname}${url.search}` || '/' : null
}
