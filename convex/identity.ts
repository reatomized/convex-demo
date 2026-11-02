import type { UserIdentity } from 'convex/server'
import type { Infer } from 'convex/values'

import { ConvexError, v } from 'convex/values'

export const viewer = v.object({
	owner: v.string(),
	provider: v.union(v.literal('convex-auth'), v.literal('better-auth')),
	email: v.string(),
})

export type Viewer = Infer<typeof viewer>

const isProvider = (value: unknown): value is Viewer['provider'] =>
	value === 'convex-auth' || value === 'better-auth'

// Both auth libraries share an issuer, so the `provider` claim (set in auth.ts
// and betterAuth.ts) tells them apart. `tokenIdentifier` is no stable owner
// here: Convex Auth's subject is `userId|sessionId`, so only its user part is.
export function viewerFromIdentity(identity: UserIdentity): Viewer {
	const { provider, email } = identity
	if (!isProvider(provider) || typeof email !== 'string') {
		throw new ConvexError('Token is missing provider/email claims')
	}
	const userId = provider === 'convex-auth' ? identity.subject.split('|')[0] : identity.subject
	return { owner: `${provider}:${userId}`, provider, email }
}
