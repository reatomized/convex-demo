/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test } from 'vite-plus/test'

import { api } from './_generated/api'
import schema from './schema'

// The functions only: a test globbing the other tests would import them.
const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'])

const account = (email: string) => ({ subject: email, provider: 'better-auth', email })

test('the first account to ask is the admin and approves the others', async () => {
	const t = convexTest(schema, modules)
	const olga = t.withIdentity(account('olga@example.com'))
	const alex = t.withIdentity(account('alex@example.com'))

	expect(await t.query(api.access.viewer, {})).toBeNull()
	expect(await alex.query(api.access.viewer, {})).toBeNull()
	await olga.mutation(api.access.requestAccess, {})
	await alex.mutation(api.access.requestAccess, {})
	await alex.mutation(api.access.requestAccess, {})
	expect(await olga.query(api.access.viewer, {})).toBe('admin')
	expect(await alex.query(api.access.viewer, {})).toBe('pending')

	const { pending } = await olga.query(api.access.members, {})
	expect(pending.map(({ email }) => email)).toEqual(['alex@example.com'])
	await olga.mutation(api.access.approve, { memberId: pending[0]!._id })
	expect(await alex.query(api.access.viewer, {})).toBe('approved')
	expect(await olga.query(api.access.members, {})).toMatchObject({
		pending: [],
		approved: [{ email: 'alex@example.com' }],
	})

	await olga.mutation(api.access.revoke, { memberId: pending[0]!._id })
	expect(await alex.query(api.access.viewer, {})).toBe('pending')
})

test('only the admin manages accounts, and not their own', async () => {
	const t = convexTest(schema, modules)
	const olga = t.withIdentity(account('olga@example.com'))
	const alex = t.withIdentity(account('alex@example.com'))
	await olga.mutation(api.access.requestAccess, {})
	await alex.mutation(api.access.requestAccess, {})

	await expect(alex.query(api.access.members, {})).rejects.toThrow('Only the admin')
	await expect(t.mutation(api.access.requestAccess, {})).rejects.toThrow('Not authenticated')
	const admin = await t.run((ctx) => ctx.db.query('members').first())
	await expect(olga.mutation(api.access.revoke, { memberId: admin!._id })).rejects.toThrow(
		'No such member',
	)
})
