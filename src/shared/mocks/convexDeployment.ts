// The Convex deployment stories run against: tables in atoms, and the app's
// functions as handlers of @reatomized/convex/testing's fake client. Atom
// state is per Reatom frame, so every story starts from its own seed. The
// functions mirror convex/notes.ts and convex/viewer.ts, whose server logic
// convex-test covers.
import type { Doc, Id } from '#convex/_generated/dataModel'
import type { AuthProviderId, Backend, Credentials } from '#shared/api'
import type { ConvexStoryFake, ConvexStoryParameters } from '@reatomized/convex-storybook'
import type { UserIdentity } from 'convex/server'

import { action, atom, computed, context, type AtomLike, type RootFrame } from '@reatom/core'
import { fakeIdentity, paginate } from '@reatomized/convex/testing'
import { ConvexError } from 'convex/values'

import { api } from '#convex/_generated/api.js'
import { viewerFromIdentity } from '#convex/identity'

/** The account stories start signed in with. */
export const ALEX = { email: 'alex@example.com', password: 'correct-horse' }

/**
 * The identity each library's token carries (convex/auth.ts, convex/betterAuth.ts):
 * Convex Auth's subject is `userId|sessionId`, better-auth's the user id.
 */
export const storyIdentity = (provider: AuthProviderId, email: string): UserIdentity =>
	fakeIdentity(provider === 'convex-auth' ? `${email}|session` : email, { provider, email })

const accountKey = (provider: AuthProviderId, email: string) => `${provider}:${email}`

/** Passwords by provider and email. */
const accounts = atom<ReadonlyMap<string, string>>(new Map<string, string>(), 'deployment.accounts')
const notes = atom<readonly Doc<'notes'>[]>([], 'deployment.notes')
let nextNote = 0

const insertNote = (owner: string, text: string): Doc<'notes'> => {
	nextNote += 1
	return { _id: `notes:${nextNote}` as Id<'notes'>, _creationTime: nextNote, owner, text }
}

const runs = new WeakMap<RootFrame, Map<string, number>>()

const countRun = (name: string) => {
	const frame = context()
	const counts = runs.get(frame) ?? new Map<string, number>()
	runs.set(frame, counts.set(name, (counts.get(name) ?? 0) + 1))
}

/** How often the story's deployment ran `name`, such as `notes:list`. */
export const runsOf = (name: string) => runs.get(context())?.get(name) ?? 0

const requireViewer = (identity: UserIdentity | null) => {
	if (!identity) throw new ConvexError('Not authenticated')
	return viewerFromIdentity(identity)
}

export type DeploymentSeed = {
	/** Notes of the story's signed-in identity, oldest first. */
	notes?: readonly string[]
}

/**
 * A `parameters.convex.setup` that seeds the deployment and answers the
 * viewer and notes functions. ALEX has a Convex Auth account.
 */
export const deployment =
	(seed: DeploymentSeed = {}): NonNullable<ConvexStoryParameters['setup']> =>
	({ convex }, { parameters }) => {
		accounts.set(new Map<string, string>([[accountKey('convex-auth', ALEX.email), ALEX.password]]))
		const identity = parameters.convex?.identity
		const seedOwner = identity ? viewerFromIdentity(identity).owner : null
		notes.set(seedOwner ? (seed.notes ?? []).map((text) => insertNote(seedOwner, text)) : [])

		convex.handleQuery(api.viewer.current, (_args, ctx) =>
			ctx.identity ? viewerFromIdentity(ctx.identity) : null,
		)
		convex.handleQuery(api.notes.list, ({ paginationOpts }, ctx) => {
			countRun('notes:list')
			const viewer = requireViewer(ctx.identity)
			const mine = notes().filter((note) => note.owner === viewer.owner)
			return paginate(mine.toReversed(), paginationOpts)
		})
		convex.handleMutation(api.notes.add, ({ text }, ctx) => {
			const { owner } = requireViewer(ctx.identity)
			const trimmed = text.trim()
			if (!trimmed) throw new ConvexError('Note text is required')
			const note = insertNote(owner, trimmed)
			notes.set((all) => [...all, note])
			return note._id
		})
	}

/**
 * The app's backend over the story's fakes. Accounts live in the deployment's
 * table: signing in sets the auth library's identity to the one the selected
 * library's token would carry.
 */
export const fakeBackend = (
	{ convex, auth, provider }: ConvexStoryFake,
	selected: AtomLike<AuthProviderId, []>,
): Backend => {
	const signInAs = (email: string) => provider.identity.set(storyIdentity(selected(), email))
	return {
		convex,
		auth,
		accounts: {
			user: computed(() => {
				const email = provider.identity()?.email
				return typeof email === 'string' ? { email } : null
			}, 'fakeBackend.user'),
			signIn: action(async ({ email, password }: Credentials) => {
				if (accounts().get(accountKey(selected(), email)) !== password) {
					throw new Error('Invalid email or password')
				}
				signInAs(email)
			}, 'fakeBackend.signIn'),
			signUp: action(async ({ email, password }: Credentials) => {
				const key = accountKey(selected(), email)
				if (accounts().has(key)) throw new Error('Account already exists')
				accounts.set((all) => new Map(all).set(key, password))
				signInAs(email)
			}, 'fakeBackend.signUp'),
			signOut: action(async () => {
				provider.identity.set(null)
			}, 'fakeBackend.signOut'),
		},
	}
}
