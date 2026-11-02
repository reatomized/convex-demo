import type { Id } from '#convex/_generated/dataModel'

import { wrap, type Action, type AsyncExt } from '@reatom/core'
import { reatomComponent } from '@reatom/react'

import { sessionUser } from '#entities/session'
import { type TeamPageModel } from '#pages/team/model/teamPage'
import { m } from '#paraglide/messages.js'
import { Alert, Button, Heading, Skeleton, Text } from '#shared/components'
import { styled } from '#styled-system/jsx'

type Member = { _id: Id<'members'>; email: string }
type MemberAction = Action<[Id<'members'>], Promise<void>> & AsyncExt<[Id<'members'>], void>

const ErrorAlert = ({ title }: { title: string }) => (
	<Alert.Root status="error" role="alert">
		<Alert.Indicator />
		<Alert.Content>
			<Alert.Title>{title}</Alert.Title>
		</Alert.Content>
	</Alert.Root>
)

const MemberList = reatomComponent(
	({
		label,
		empty,
		members,
		verb,
		actionLabel,
		onAction,
	}: {
		label: string
		empty: string
		members: Member[]
		verb: string
		actionLabel: (email: string) => string
		onAction: MemberAction
	}) => (
		<styled.section aria-label={label} display="flex" flexDirection="column" gap="2">
			<Heading as="h3" fontSize="md">
				{label}
			</Heading>
			{members.length === 0 ? (
				<Text color="muted">{empty}</Text>
			) : (
				<styled.ul display="grid" gap="2">
					{members.map((member) => (
						<styled.li
							key={member._id}
							display="flex"
							alignItems="center"
							justifyContent="space-between"
							gap="3"
							p="3"
							borderWidth="1px"
							borderColor="border"
							borderRadius="md"
						>
							<Text>{member.email}</Text>
							<Button
								size="sm"
								variant="outline"
								aria-label={actionLabel(member.email)}
								disabled={!onAction.ready()}
								onClick={wrap(() => onAction(member._id))}
							>
								{verb}
							</Button>
						</styled.li>
					))}
				</styled.ul>
			)}
		</styled.section>
	),
	'MemberList',
)

const Accounts = reatomComponent(({ model }: { model: TeamPageModel }) => {
	const lists = model.members.data()
	const failed = model.approve.error() ?? model.revoke.error()
	return (
		<styled.section aria-label={m.team_accounts()} display="flex" flexDirection="column" gap="4">
			<Heading as="h2" fontSize="lg">
				{m.team_accounts()}
			</Heading>
			{failed && <ErrorAlert title={m.team_action_error()} />}
			{lists ? (
				<>
					<MemberList
						label={m.team_pending()}
						empty={m.team_none_pending()}
						members={lists.pending}
						verb={m.team_approve_short()}
						actionLabel={(email) => m.team_approve({ email })}
						onAction={model.approve}
					/>
					<MemberList
						label={m.team_approved()}
						empty={m.team_none_approved()}
						members={lists.approved}
						verb={m.team_revoke_short()}
						actionLabel={(email) => m.team_revoke({ email })}
						onAction={model.revoke}
					/>
				</>
			) : (
				<Skeleton h="10" />
			)}
		</styled.section>
	)
}, 'Accounts')

const RequestAccess = reatomComponent(({ model }: { model: TeamPageModel }) => {
	const { requestAccess } = model
	return (
		<>
			<Heading as="h1" fontSize="2xl">
				{m.team_request_title()}
			</Heading>
			<Text color="muted">{m.team_request_description()}</Text>
			{requestAccess.error() && <ErrorAlert title={m.team_request_error()} />}
			<Button
				alignSelf="flex-start"
				loading={!requestAccess.ready()}
				loadingText={m.team_requesting()}
				onClick={wrap(() => requestAccess())}
			>
				{m.team_request()}
			</Button>
		</>
	)
}, 'RequestAccess')

const Gate = reatomComponent(({ model }: { model: TeamPageModel }) => {
	const { access } = model
	const status = access.status()
	if (status === 'loading') {
		return (
			<styled.div role="status" aria-label={m.team_checking()}>
				<Skeleton h="8" w="64" />
			</styled.div>
		)
	}
	const current = access.data()
	if (status === 'error' || current === undefined) {
		return <ErrorAlert title={m.team_check_error()} />
	}
	if (current === null) return <RequestAccess model={model} />
	if (current === 'pending') {
		return (
			<>
				<Heading as="h1" fontSize="2xl">
					{m.team_waiting_title()}
				</Heading>
				<Text color="muted">
					{m.team_waiting_description({ email: sessionUser()?.email ?? '' })}
				</Text>
			</>
		)
	}
	return (
		<>
			<Heading as="h1" fontSize="2xl">
				{m.team_title()}
			</Heading>
			<Text color="muted">{m.team_open()}</Text>
			{current === 'admin' && <Accounts model={model} />}
		</>
	)
}, 'Gate')

export const TeamPage = reatomComponent(
	({ model }: { model: TeamPageModel }) => (
		<styled.main p="6" display="flex" flexDirection="column" gap="4" maxW="2xl">
			<Gate model={model} />
		</styled.main>
	),
	'TeamPage',
)
