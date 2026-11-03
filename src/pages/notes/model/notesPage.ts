import { action, atom, reatomForm, wrap } from '@reatom/core'
import {
	updateQuery,
	withConvexMutation,
	withConvexPaginatedQuery,
	withConvexQuery,
} from '@reatomized/convex'

import { api } from '#convex/_generated/api.js'
import { backend } from '#shared/api'

export const NOTES_PAGE_SIZE = 10

export const reatomNotesPage = () => {
	const { convex } = backend()
	const notes = atom({}, 'notesPage.notes').extend(
		withConvexPaginatedQuery(convex, api.notes.list, { initialNumItems: NOTES_PAGE_SIZE }),
	)
	const addNote = action((text: string) => ({ text }), 'notesPage.addNote').extend(
		withConvexMutation(convex, api.notes.add, {
			// Shows the note first until the server's list includes it.
			optimisticUpdate: updateQuery(notes, (page, { text }, { first }, localQueryStore) => {
				const owner = localQueryStore.getQuery(api.viewer.current, {})?.owner
				if (!first || !owner) return page
				const note = {
					_id: `optimistic:${crypto.randomUUID()}` as never,
					_creationTime: Date.now(),
					owner,
					text: text.trim(),
				}
				return [note, ...page]
			}),
		}),
	)
	const form = reatomForm(
		{ text: '' },
		{
			name: 'notesPage.form',
			onSubmit: async ({ text }) => {
				if (!text.trim()) return
				await wrap(addNote(text))
				form.reset()
			},
		},
	)
	return {
		notes,
		// The backend's view of the caller, independent of the client-side session.
		viewer: atom({}, 'notesPage.viewer').extend(withConvexQuery(convex, api.viewer.current)),
		form,
	}
}

export type NotesPageModel = ReturnType<typeof reatomNotesPage>
