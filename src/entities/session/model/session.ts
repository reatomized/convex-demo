import { action, computed, reatomEnum, withLocalStorage, wrap } from '@reatom/core'

import { AUTH_PROVIDERS, backend, type Credentials } from '#shared/api'

/** The auth library the sign-in page uses; the backend's session follows it. */
export const authProvider = reatomEnum(AUTH_PROVIDERS, 'authProvider').extend(
	withLocalStorage('authProvider'),
)

/** The signed-in user per the auth library, before the backend accepts its token. */
export const sessionUser = computed(() => backend().accounts.user(), 'sessionUser')

type SessionStatus = 'signedOut' | 'authenticating' | 'authenticated' | 'rejected'

const STATUSES = {
	loading: 'authenticating',
	unauthenticated: 'signedOut',
	authenticated: 'authenticated',
	rejected: 'rejected',
} as const

/**
 * Two-phase session: the auth library holds a session (`sessionUser`), then
 * the Convex backend accepts or rejects its token. Only `authenticated` may
 * render private data. Reading it keeps the client's auth in step with the
 * library.
 */
export const sessionStatus = computed(
	(): SessionStatus => STATUSES[backend().auth.status()],
	'sessionStatus',
)

export const signIn = action(async (credentials: Credentials) => {
	await wrap(backend().accounts.signIn(credentials))
}, 'session.signIn')

export const signUp = action(async (credentials: Credentials) => {
	await wrap(backend().accounts.signUp(credentials))
}, 'session.signUp')

export const signOut = action(async () => {
	await wrap(backend().accounts.signOut())
}, 'session.signOut')
