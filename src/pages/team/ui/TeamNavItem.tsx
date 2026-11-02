import { reatomComponent } from '@reatom/react'
import { Users } from 'lucide-react'

import { m } from '#paraglide/messages.js'
import { SideNavButton, SideNavItemContent } from '#widgets/side-nav'

import { teamRoute } from '../model/routes'

export const TeamNavItem = reatomComponent(
	() => (
		<a href={teamRoute.path()}>
			<SideNavButton active={teamRoute.match()}>
				<SideNavItemContent Icon={Users} label={m.nav_team()} />
			</SideNavButton>
		</a>
	),
	'TeamNavItem',
)
