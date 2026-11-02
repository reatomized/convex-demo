import { ConvexError, v } from 'convex/values'

import { query, type QueryCtx } from './_generated/server'
import { viewer, viewerFromIdentity, type Viewer } from './identity'

export type { Viewer }

export async function getViewer(ctx: QueryCtx): Promise<Viewer | null> {
	const identity = await ctx.auth.getUserIdentity()
	return identity ? viewerFromIdentity(identity) : null
}

export async function requireViewer(ctx: QueryCtx): Promise<Viewer> {
	const current = await getViewer(ctx)
	if (!current) throw new ConvexError('Not authenticated')
	return current
}

export const current = query({
	args: {},
	returns: v.union(viewer, v.null()),
	handler: (ctx) => getViewer(ctx),
})
