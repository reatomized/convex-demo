import { Fragment } from 'react'

import { protectedRoute } from '#entities/session'

import { TeamPage } from '../ui/TeamPage'
import { reatomTeamPage } from './teamPage'

export const teamRoute = protectedRoute.reatomRoute(
	{
		path: 'team',
		async loader() {
			return reatomTeamPage()
		},
		render(self) {
			const { isFulfilled, data } = self.loader.status()
			return isFulfilled ? <TeamPage key="team" model={data} /> : <Fragment key="loading" />
		},
	},
	'team',
)
