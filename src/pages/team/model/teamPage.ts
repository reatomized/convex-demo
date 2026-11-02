import type { Id } from '#convex/_generated/dataModel'

import { action, withAsync, wrap } from '@reatom/core'

import { api } from '#convex/_generated/api.js'
import { backend } from '#shared/api'

export const reatomTeamPage = () => {
	const { convex } = backend()
	const memberAction = (name: string, run: (memberId: Id<'members'>) => Promise<null>) =>
		action(async (memberId: Id<'members'>) => {
			await wrap(run(memberId))
		}, `teamPage.${name}`).extend(withAsync())
	return {
		access: convex.query(api.access.viewer, {}),
		// Read only for the admin, the one caller the server answers.
		members: convex.query(api.access.members, {}),
		requestAccess: action(async () => {
			await wrap(convex.mutation(api.access.requestAccess, {}))
		}, 'teamPage.requestAccess').extend(withAsync()),
		approve: memberAction('approve', (memberId) =>
			convex.mutation(api.access.approve, { memberId }),
		),
		revoke: memberAction('revoke', (memberId) => convex.mutation(api.access.revoke, { memberId })),
	}
}

export type TeamPageModel = ReturnType<typeof reatomTeamPage>
