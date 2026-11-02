import type { Accounts, Backend, SessionUser } from './backend'
import type { ReatomConvexAuth } from '@reatomized/convex/convex-auth'

import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'
import { action, assert, computed, wrap, type AtomLike } from '@reatom/core'
import { reatomAuthState, reatomConvexClient } from '@reatomized/convex'
import { reatomBetterAuthProvider } from '@reatomized/convex/better-auth'
import { reatomConvexAuthProvider } from '@reatomized/convex/convex-auth'
import { createAuthClient } from 'better-auth/client'

import { BETTER_AUTH_BASE_PATH } from '#convex/authPaths'

import { readJwtClaims } from './auth/jwt'
import { type AuthProviderId, type Credentials } from './auth/types'

const env = (key: 'VITE_CONVEX_URL' | 'VITE_CONVEX_SITE_URL') => {
	const value: unknown = import.meta.env[key]
	assert(typeof value === 'string' && value, `${key} is not set; run \`mise run convex:dev\``)
	return value
}

const userOf = (email: unknown): SessionUser | null =>
	typeof email === 'string' ? { email } : null

// The Convex site is another origin: crossDomainClient keeps the session
// cookie in localStorage and sends it as the `Better-Auth-Cookie` header.
const createBetterAuthClient = (siteUrl: string) =>
	createAuthClient({
		baseURL: `${siteUrl}${BETTER_AUTH_BASE_PATH}`,
		plugins: [convexClient(), crossDomainClient()],
	})

type BetterAuthClient = ReturnType<typeof createBetterAuthClient>

const convexAuthAccounts = (convexAuth: ReatomConvexAuth): Accounts => {
	const passwordFlow = (flow: 'signIn' | 'signUp') =>
		action(async ({ email, password }: Credentials) => {
			const { signingIn } = await wrap(convexAuth.signIn('password', { email, password, flow }))
			if (!signingIn) throw new Error('Convex Auth returned no session')
		}, `convexAuth.${flow}`)
	return {
		user: computed(() => {
			const token = convexAuth.token()
			return token ? userOf(readJwtClaims(token)?.['email']) : null
		}, 'convexAuth.user'),
		signIn: passwordFlow('signIn'),
		signUp: passwordFlow('signUp'),
		signOut: () => convexAuth.signOut(),
	}
}

const betterAuthAccounts = (
	client: BetterAuthClient,
	session: AtomLike<{ user: { email: string } } | null, []>,
): Accounts => {
	const settled = async (request: Promise<{ error: { message?: string | undefined } | null }>) => {
		const { error } = await wrap(request)
		if (error) throw new Error(error.message ?? 'Better Auth refused the request')
	}
	return {
		user: computed(() => userOf(session()?.user.email), 'betterAuth.user'),
		signIn: action(
			({ email, password }: Credentials) => settled(client.signIn.email({ email, password })),
			'betterAuth.signIn',
		),
		signUp: action(
			({ email, password }: Credentials) =>
				settled(client.signUp.email({ email, password, name: email.split('@')[0] ?? email })),
			'betterAuth.signUp',
		),
		signOut: action(async () => {
			await wrap(client.signOut())
		}, 'betterAuth.signOut'),
	}
}

/**
 * The deployment's backend with both auth libraries; `provider` selects the
 * one the session and the accounts follow.
 */
export const createBackend = (provider: AtomLike<AuthProviderId, []>): Backend => {
	const convex = reatomConvexClient(env('VITE_CONVEX_URL'))
	const client = createBetterAuthClient(env('VITE_CONVEX_SITE_URL'))
	const convexAuth = reatomConvexAuthProvider(
		convex,
		{ storageNamespace: 'convexAuth' },
		'convexAuth',
	)
	const betterAuth = reatomBetterAuthProvider(client, {}, 'betterAuth')
	// crossDomainClient caches the session in localStorage. Without a cached
	// one there is no session to wait for, so the sign-in page shows at once.
	const cached = client.getSessionData() !== null
	const libraries = {
		'convex-auth': { provider: convexAuth, accounts: convexAuthAccounts(convexAuth) },
		'better-auth': {
			provider: {
				...betterAuth,
				isLoading: computed(
					() => (cached ? betterAuth.isLoading() : !betterAuth.completeSignIn.ready()),
					'betterAuth.isLoadingCached',
				),
			},
			accounts: betterAuthAccounts(client, betterAuth.data),
		},
	}
	const selected = () => libraries[provider()]
	return {
		convex,
		auth: reatomAuthState(
			convex,
			computed(() => selected().provider, 'backend.authProvider'),
			'backend.auth',
		),
		accounts: {
			user: computed(() => selected().accounts.user(), 'backend.sessionUser'),
			signIn: (credentials) => selected().accounts.signIn(credentials),
			signUp: (credentials) => selected().accounts.signUp(credentials),
			signOut: () => selected().accounts.signOut(),
		},
	}
}
