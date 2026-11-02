import type { Id } from '#convex/_generated/dataModel'
import type { ConvexStoryParameters } from '@reatomized/convex-storybook'

import { atom, wrap } from '@reatom/core'
import { ConvexError } from 'convex/values'

import preview from '#.storybook/preview'
import { inStoryFrame } from '#.storybook/storyFrame'
import { App } from '#app/App'
import { api } from '#convex/_generated/api.js'
import { teamLoc as loc } from '#pages/team/testing'
import { deployment, storyIdentity } from '#shared/mocks/convexDeployment'
import { button, createActor, text } from '#shared/test'

const I = createActor()

type Member = {
	_id: Id<'members'>
	_creationTime: number
	email: string
	role: 'admin' | 'member'
	approved: boolean
}

const member = (email: string, role: Member['role'], approved: boolean, order: number) => ({
	_id: email as Id<'members'>,
	_creationTime: order,
	email,
	role,
	approved,
})
const olga = member('olga@example.com', 'admin', true, 1)
const alex = member('alex@example.com', 'member', false, 2)
const sam = member('sam@example.com', 'member', true, 3)
const asOlga = storyIdentity('better-auth', olga.email)
const asAlex = storyIdentity('convex-auth', alex.email)

const accessOf = ({ role, approved }: Member) =>
	role === 'admin' ? 'admin' : approved ? 'approved' : 'pending'

// The members table. Atom state is per story frame, so each story starts from
// its own seed.
const members = atom<Member[]>([], 'story.members')

const setApproved = (memberId: Id<'members'>, approved: boolean) => {
	members.set((all) => all.map((m) => (m._id === memberId ? { ...m, approved } : m)))
	return null
}

/** The rest of the app's functions, plus convex/access.ts over `members`. */
const withMembers =
	(seed: Member[]): NonNullable<ConvexStoryParameters['setup']> =>
	(fake, context) => {
		deployment()(fake, context)
		members.set(seed)
		const { convex } = fake
		const me = (email: unknown) => members().find((m) => m.email === email)
		const requireAdmin = (email: unknown) => {
			if (me(email)?.role !== 'admin') throw new ConvexError('Only the admin manages accounts')
		}
		convex.handleQuery(api.access.viewer, (_args, { identity }) => {
			const record = me(identity?.email)
			return record ? accessOf(record) : null
		})
		convex.handleQuery(api.access.members, (_args, { identity }) => {
			requireAdmin(identity?.email)
			const others = members().filter((m) => m.role === 'member')
			return {
				pending: others.filter((m) => !m.approved),
				approved: others.filter((m) => m.approved),
			}
		})
		convex.handleMutation(api.access.requestAccess, (_args, { identity }) => {
			const email = String(identity?.email)
			members.set((all) => [...all, member(email, 'member', false, all.length + 1)])
			return null
		})
		convex.handleMutation(api.access.approve, ({ memberId }, { identity }) => {
			requireAdmin(identity?.email)
			return setApproved(memberId, true)
		})
		convex.handleMutation(api.access.revoke, ({ memberId }, { identity }) => {
			requireAdmin(identity?.email)
			return setApproved(memberId, false)
		})
	}

const meta = preview.meta({
	title: 'Integration/Access',
	component: App,
	parameters: {
		layout: 'fullscreen',
		initialPath: 'team',
		convex: { identity: asAlex, setup: withMembers([olga, alex, sam]) },
	},
	loaders: [(ctx) => I.init(ctx)],
})

export default meta

export const WaitsForApproval = meta.story({ name: 'Waits For Approval' })

WaitsForApproval.test(
	'opens the team space once the admin approves',
	inStoryFrame(async ({ provider }) => {
		await wrap(I.see(loc.waitingHeading.wait()))
		await wrap(I.see(text('The admin will approve alex@example.com.')))

		// The admin signs in on the same device and approves the account.
		provider.identity.set(asOlga)
		await wrap(I.click(loc.approve(alex.email).wait()))
		await wrap(I.see(text(alex.email).within(loc.approved).wait()))

		provider.identity.set(asAlex)
		await wrap(I.see(loc.spaceHeading.wait()))
		await wrap(I.dontSee(loc.accounts))
	}),
)

export const RequestsAccess = meta.story({
	name: 'Requests Access',
	parameters: { convex: { setup: withMembers([olga]) } },
})

RequestsAccess.test('puts the account on the approval list', async () => {
	await I.see(loc.requestHeading.wait())
	await I.click(button('Request access'))
	await I.see(loc.waitingHeading.wait())
})

export const AdminManagesAccounts = meta.story({
	name: 'Admin Manages Accounts',
	parameters: { convex: { identity: asOlga } },
})

AdminManagesAccounts.test('approves a waiting account and revokes an approved one', async () => {
	await I.see(loc.spaceHeading.wait())
	await I.see(text(alex.email).within(loc.pending).wait())
	await I.see(text(sam.email).within(loc.approved))

	await I.click(loc.approve(alex.email))
	await I.see(text(alex.email).within(loc.approved).wait())
	await I.see(text('Nobody is waiting for approval.').within(loc.pending))

	await I.click(loc.revoke(sam.email))
	await I.see(text(sam.email).within(loc.pending).wait())
})

export const ApprovedMember = meta.story({
	name: 'Approved Member',
	parameters: { convex: { identity: storyIdentity('convex-auth', sam.email) } },
})

ApprovedMember.test('opens the team space without the accounts', async () => {
	await I.see(loc.spaceHeading.wait())
	await I.see(text('You have access to the team space.'))
	await I.dontSee(loc.accounts)
})

export const AccessCheckFails = meta.story({
	name: 'Access Check Fails',
	parameters: {
		convex: {
			setup: (fake, context) => {
				withMembers([olga, alex])(fake, context)
				fake.convex.handleQuery(api.access.viewer, () => {
					throw new ConvexError('Access is unavailable')
				})
			},
		},
	},
})

AccessCheckFails.test('says the check failed instead of guessing', async () => {
	await I.see(text('Could not check your access').wait())
	await I.dontSee(loc.waitingHeading)
})
