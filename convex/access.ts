import type { Doc, Id } from './_generated/dataModel'

import { ConvexError, v, type Infer } from 'convex/values'

import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { getViewer, requireViewer } from './viewer'

const access = v.union(v.literal('admin'), v.literal('approved'), v.literal('pending'))
const member = v.object({ _id: v.id('members'), _creationTime: v.number(), email: v.string() })

export type Access = Infer<typeof access>

const memberOf = (ctx: QueryCtx, owner: string) =>
	ctx.db
		.query('members')
		.withIndex('by_owner', (q) => q.eq('owner', owner))
		.unique()

const accessOf = (current: Doc<'members'>): Access =>
	current.role === 'admin' ? 'admin' : current.approved ? 'approved' : 'pending'

const requireAdmin = async (ctx: QueryCtx) => {
	const { owner } = await requireViewer(ctx)
	const current = await memberOf(ctx, owner)
	if (current?.role !== 'admin') throw new ConvexError('Only the admin manages accounts')
}

/** The caller's access to the team space, `null` before they ask for it or when signed out. */
export const viewer = query({
	args: {},
	returns: v.union(access, v.null()),
	handler: async (ctx) => {
		const current = await getViewer(ctx)
		if (!current) return null
		const record = await memberOf(ctx, current.owner)
		return record ? accessOf(record) : null
	},
})

/** Puts the caller on the approval list. The first account becomes the admin. */
export const requestAccess = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const { owner, email } = await requireViewer(ctx)
		if (await memberOf(ctx, owner)) return null
		const first = (await ctx.db.query('members').first()) === null
		await ctx.db.insert('members', {
			owner,
			email,
			role: first ? 'admin' : 'member',
			approved: first,
		})
		return null
	},
})

/** The accounts the admin approves or revokes. */
export const members = query({
	args: {},
	returns: v.object({ pending: v.array(member), approved: v.array(member) }),
	handler: async (ctx) => {
		await requireAdmin(ctx)
		const others = (await ctx.db.query('members').collect()).filter(
			(record) => record.role === 'member',
		)
		const pick = ({ _id, _creationTime, email }: Doc<'members'>) => ({ _id, _creationTime, email })
		return {
			pending: others.filter((record) => !record.approved).map(pick),
			approved: others.filter((record) => record.approved).map(pick),
		}
	},
})

const setApproved = async (ctx: MutationCtx, memberId: Id<'members'>, approved: boolean) => {
	await requireAdmin(ctx)
	const record = await ctx.db.get(memberId)
	if (record?.role !== 'member') throw new ConvexError('No such member')
	await ctx.db.patch(memberId, { approved })
	return null
}

export const approve = mutation({
	args: { memberId: v.id('members') },
	returns: v.null(),
	handler: (ctx, { memberId }) => setApproved(ctx, memberId, true),
})

export const revoke = mutation({
	args: { memberId: v.id('members') },
	returns: v.null(),
	handler: (ctx, { memberId }) => setApproved(ctx, memberId, false),
})
