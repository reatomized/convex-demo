import type { Id } from '#convex/_generated/dataModel'

import { action, atom } from '@reatom/core'
import { withConvexMutation, withConvexQuery } from '@reatomized/convex'

import { api } from '#convex/_generated/api.js'
import { backend } from '#shared/api'

export const reatomTeamPage = () => {
	const { convex } = backend()
	const memberAction = (name: string, mutation: typeof api.access.approve) =>
		action((memberId: Id<'members'>) => ({ memberId }), `teamPage.${name}`).extend(
			withConvexMutation(convex, mutation),
		)
	return {
		access: atom({}, 'teamPage.access').extend(withConvexQuery(convex, api.access.viewer)),
		// Read only for the admin, the one caller the server answers.
		members: atom({}, 'teamPage.members').extend(withConvexQuery(convex, api.access.members)),
		requestAccess: action(() => {}, 'teamPage.requestAccess').extend(
			withConvexMutation(convex, api.access.requestAccess),
		),
		approve: memberAction('approve', api.access.approve),
		revoke: memberAction('revoke', api.access.revoke),
	}
}

export type TeamPageModel = ReturnType<typeof reatomTeamPage>
