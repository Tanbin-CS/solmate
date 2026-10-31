/**
 * Firebase App Check (reCAPTCHA Enterprise): proves requests to /api/v1/terrain come from
 * this web app, so the public endpoint cannot be scripted cheaply. Loaded lazily, only
 * when the user first asks for fine terrain.
 *
 * The Firebase web config and the reCAPTCHA site key are public identifiers, not secrets.
 * The API key comes from the build environment (VITE_FIREBASE_API_KEY) and is restricted
 * by HTTP referrer and API in Google Cloud.
 */
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'solmate-13571'
const APP_ID = import.meta.env.VITE_FIREBASE_APP_ID ?? '1:314008475333:web:9632adc7dd53d64d1b42ac'
const SITE_KEY = import.meta.env.VITE_APPCHECK_SITE_KEY || '6LdXgAkuAAAAAGJsEodJcvi9PwB2xJMqV3bjFbcL'
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY ?? ''

/** App Check works only with an API key, outside offline mode. */
export const appCheckConfigured = (): boolean => API_KEY !== '' && import.meta.env.VITE_OFFLINE !== '1'

type GetToken = () => Promise<string>
let tokenFn: Promise<GetToken> | null = null

async function init(): Promise<GetToken> {
  const [{ initializeApp }, { initializeAppCheck, getToken, ReCaptchaEnterpriseProvider }] = await Promise.all([
    import('@firebase/app'),
    import('@firebase/app-check'),
  ])
  const app = initializeApp({ apiKey: API_KEY, projectId: PROJECT_ID, appId: APP_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` })
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
  return async () => (await getToken(appCheck, false)).token
}

/** A current App Check token; throws when App Check is not configured or attestation fails. */
export function appCheckToken(): Promise<string> {
  if (!appCheckConfigured()) return Promise.reject(new Error('app attestation not configured'))
  tokenFn ??= init().catch((err: unknown) => {
    tokenFn = null
    throw err
  })
  return tokenFn.then((get) => get())
}
