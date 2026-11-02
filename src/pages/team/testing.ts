import { button, heading, role } from '#shared/test'

export const teamLoc = {
	requestHeading: heading('Join the team space'),
	waitingHeading: heading('Waiting for approval'),
	spaceHeading: heading('Team space'),
	accounts: role('region', 'Accounts'),
	pending: role('region', 'Pending'),
	approved: role('region', 'Approved'),
	approve: (email: string) => button(`Approve: ${email}`),
	revoke: (email: string) => button(`Revoke access: ${email}`),
}
