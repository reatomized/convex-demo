import { DashboardNavItem } from '#pages/dashboard'
import { NotesNavItem } from '#pages/notes'
import { TeamNavItem } from '#pages/team'

export const SidebarNavigation = () => (
	<>
		<NotesNavItem />
		<TeamNavItem />
		<DashboardNavItem />
	</>
)
