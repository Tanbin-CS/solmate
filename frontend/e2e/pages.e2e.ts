import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Every route a judge can reach from the navigation or the README. */
const PAGES = [
  { path: '/', name: 'Home' },
  { path: '/explorer', name: 'Explorer' },
  { path: '/findings', name: 'Findings' },
  { path: '/method', name: 'Method' },
  { path: '/provenance', name: 'Data' },
  { path: '/learn', name: 'Learn' },
  { path: '/no-such-page', name: 'Not found' },
] as const

/**
 * Errors that are not bugs in the app: requests to the terrain API and the web tiles, which a local
 * preview does not have (CI builds without the 60 MB tile set and has no API behind /api/v1).
 */
const EXPECTED = [/\/api\/v1\//, /\/data\/v2\/tiles\//, /Failed to load resource/]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !EXPECTED.some((re) => re.test(m.text()) || re.test(m.location().url))) errors.push(`console: ${m.text()}`)
  })
  return errors
}

/** Wait for data to arrive and entry motion to finish, but never on the network forever (the home page streams video). */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(1_500)
}

/** Scroll to the bottom one screen at a time, so every scroll-triggered reveal runs, then back to the top. */
async function revealAll(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const step = page.viewportSize()?.height ?? 800
  for (let y = 0; y < height; y += step * 0.8) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(800)
}

for (const { path, name } of PAGES) {
  test(`${name} page loads with a heading and no errors`, async ({ page }) => {
    const errors = collectErrors(page)
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(res?.status(), 'HTTP status').toBeLessThan(400)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('navigation').first()).toBeVisible()
    await settle(page)
    expect(errors).toEqual([])
  })

  test(`${name} page has no serious accessibility violations`, async ({ page }) => {
    // Content fades in as it scrolls into view. Check the colours readers end up seeing: short (reduced)
    // motion, and every section scrolled through once so it has finished revealing.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 })
    await settle(page)
    await revealAll(page)
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('canvas').analyze()
    const serious = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target.join(' ')}`)
    expect(serious).toEqual([])
  })
}

test('Explorer opens a ranked place with its NASA links', async ({ page, isMobile }) => {
  test.skip(isMobile, 'On phones the ranked list sits in a sheet; the desktop run covers the link')
  await page.goto('/explorer', { waitUntil: 'domcontentloaded' })
  const first = page.getByRole('button', { name: /°N|°S/ }).first()
  await expect(first).toBeVisible({ timeout: 20_000 })
  await first.click()
  await expect(page).toHaveURL(/[?&]p=/)
  await expect(page.getByRole('link', { name: /NASA Worldview/ })).toHaveAttribute('href', /^https:\/\/worldview\.earthdata\.nasa\.gov\/\?v=/, { timeout: 20_000 })
})

test('Data page links NASA products to Earthdata Search', async ({ page }) => {
  await page.goto('/provenance', { waitUntil: 'domcontentloaded' })
  const links = page.getByRole('link', { name: /Earthdata Search for/ })
  await expect(links.first()).toBeVisible({ timeout: 20_000 })
  expect(await links.count()).toBeGreaterThanOrEqual(5)
})

test('A place prints as a report', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Printing is a desktop task; the phone run covers the pages')
  await page.goto('/explorer?p=34.95%2C83.35', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    window.print = () => {}
  })
  await page.getByRole('button', { name: /Print or save this place/ }).click({ timeout: 30_000 })
  const report = page.locator('[data-print-report]')
  await expect(report).toHaveCount(1)
  await expect(report).toContainText('SolMate Analog Index')
  await expect(report).toContainText(/Model version [0-9a-f]{12}/)
})
