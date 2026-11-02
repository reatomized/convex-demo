import { expect, test } from 'vite-plus/test'

import { readJwtClaims } from './jwt'

const encode = (value: unknown) =>
	btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

test('reads the claims of a JWT without verifying it', () => {
	const token = `${encode({ alg: 'none' })}.${encode({ sub: 'u1', email: 'ada@example.com' })}.`
	expect(readJwtClaims(token)).toEqual({ sub: 'u1', email: 'ada@example.com' })
})

test('returns null for anything that is not a JWT with an object payload', () => {
	expect(readJwtClaims('opaque')).toBeNull()
	expect(readJwtClaims('a.not-base64!.c')).toBeNull()
	expect(readJwtClaims(`a.${encode(42)}.c`)).toBeNull()
})
