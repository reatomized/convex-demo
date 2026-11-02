import type { Credentials } from './auth/types'
import type { ReatomAuthState, ReatomConvexClient } from '@reatomized/convex'

import { assert, atom, type AtomLike } from '@reatom/core'

/** The user an auth library holds a session for. */
export type SessionUser = { email: string }

/** Email and password accounts of the selected auth library. */
export type Accounts = {
	/** The library's signed-in user, before the backend accepts its token. */
	readonly user: AtomLike<SessionUser | null, []>
	readonly signIn: (credentials: Credentials) => Promise<void>
	readonly signUp: (credentials: Credentials) => Promise<void>
	readonly signOut: () => Promise<void>
}

/** The Convex client, the session the backend accepted, and the accounts behind it. */
export type Backend = {
	readonly convex: ReatomConvexClient
	readonly auth: ReatomAuthState
	readonly accounts: Accounts
}

/** `main.tsx` installs the deployment's backend at startup; stories install a fake. */
export const backendAtom = atom<Backend | null>(null, 'backend')

export const backend = (): Backend => {
	const current = backendAtom()
	assert(current, 'No backend: main.tsx installs one at startup, a story through convexStory')
	return current
}
