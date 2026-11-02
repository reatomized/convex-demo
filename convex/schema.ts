import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
	...authTables,
	notes: defineTable({
		owner: v.string(),
		text: v.string(),
	}).index('by_owner', ['owner']),
	// The team space's approval list; the first account to request access is its admin.
	members: defineTable({
		owner: v.string(),
		email: v.string(),
		role: v.union(v.literal('admin'), v.literal('member')),
		approved: v.boolean(),
	}).index('by_owner', ['owner']),
})
