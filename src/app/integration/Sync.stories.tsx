import { wrap } from '@reatom/core'
import { ConvexError } from 'convex/values'

import preview from '#.storybook/preview'
import { inStoryFrame } from '#.storybook/storyFrame'
import { App } from '#app/App'
import { api } from '#convex/_generated/api.js'
import { notesLoc, withNotesPage } from '#pages/notes/testing'
import { deployment, heldWrites } from '#shared/mocks/convexDeployment'
import { button, createActor, role, text } from '#shared/test'

const I = createActor().extend(withNotesPage)

// Seeded oldest first; the list shows newest first.
const seedNotes = Array.from({ length: 12 }, (_, index) => `Seeded note ${index + 1}`)

const meta = preview.meta({
	title: 'Integration/Sync',
	component: App,
	parameters: {
		layout: 'fullscreen',
		initialPath: 'notes',
		convex: { setup: deployment({ notes: seedNotes }) },
	},
	loaders: [(ctx) => I.init(ctx)],
})

export default meta

export const PaginatesNotes = meta.story({ name: 'Paginates Notes' })

PaginatesNotes.test('loads ten notes, then the rest on demand', async () => {
	await I.seeNote('Seeded note 12')
	await I.see(text('Seeded note 3'))
	await I.dontSee(text('Seeded note 2'))

	await I.click(button('Load more'))
	await I.seeNote('Seeded note 1')
	await I.waitExit(button('Load more'))
})

PaginatesNotes.test('shows an added note first', async () => {
	await I.addNote('Fresh note')
	const list = await I.see(notesLoc.list)
	await I.see(text('Fresh note').within(list))
})

export const ShowsPendingNote = meta.story({ name: 'Shows Pending Note' })

// The server's answer has no UI control, so the test holds the deployment's
// write; the note shows through the page's optimistic update meanwhile.
ShowsPendingNote.test(
	'shows an added note before the server confirms it',
	inStoryFrame(async () => {
		await wrap(I.seeNote('Seeded note 12'))
		let confirm!: () => void
		heldWrites.set(new Promise<void>((resolve) => (confirm = resolve)))
		await wrap(I.fill(notesLoc.newNote, 'Pending note'))
		await wrap(I.click(button('Add note')))
		await wrap(I.see(button('Adding note').wait()))
		await wrap(I.seeNote('Pending note'))
		confirm()
		await wrap(I.waitExit(button('Adding note')))
		await wrap(I.seeNote('Pending note'))
	}),
)

export const ShowsConnectionState = meta.story({ name: 'Shows Connection State' })

// Reconnects and token refreshes are the client's job, covered by its parity
// tests; the app only shows what the client reports. These infrastructure tests
// inject events with no UI control. User journeys use actor-only tests above.
ShowsConnectionState.test(
	'tells the user while the connection is down',
	inStoryFrame(async ({ convex }) => {
		await wrap(I.seeNote('Seeded note 12'))
		convex.connected.set(false)
		await wrap(I.see(role('status', /Connection lost/).wait()))
		convex.connected.set(true)
		await wrap(I.waitExit(role('status', /Connection lost/)))
	}),
)

ShowsConnectionState.test(
	'tells the user while the session refreshes',
	inStoryFrame(async ({ convex }) => {
		await wrap(I.seeNote('Seeded note 12'))
		convex.isRefreshingAuth.set(true)
		await wrap(I.see(role('status', 'Refreshing session').wait()))
		convex.isRefreshingAuth.set(false)
		await wrap(I.waitExit(role('status', 'Refreshing session')))
		await wrap(I.seeNote('Seeded note 12'))
	}),
)

export const NotesFailToLoad = meta.story({
	name: 'Notes Fail To Load',
	parameters: {
		convex: {
			setup: (fake, context) => {
				deployment()(fake, context)
				fake.convex.handleQuery(api.notes.list, () => {
					throw new ConvexError('Notes are unavailable')
				})
			},
		},
	},
})

NotesFailToLoad.test('shows the error the server sent', async () => {
	await I.see(role('alert').wait())
	await I.see(text('Could not load notes'))
	await I.see(text(/Notes are unavailable/))
})
