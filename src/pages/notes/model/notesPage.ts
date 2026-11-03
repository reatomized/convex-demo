import { action, atom, reatomForm, wrap } from '@reatom/core'
import { withConvexMutation, withConvexPaginatedQuery, withConvexQuery } from '@reatomized/convex'
import { insertAtTop } from 'convex/react'

import { api } from '#convex/_generated/api.js'
import { backend } from '#shared/api'

export const NOTES_PAGE_SIZE = 10

export const reatomNotesPage = () => {
	const { convex } = backend()
	const addNote = action((text: string) => ({ text }), 'notesPage.addNote').extend(
		withConvexMutation(convex, api.notes.add, {
			// Shows the note first until the server's list includes it.
			optimisticUpdate: (localQueryStore, { text }) => {
				const owner = localQueryStore.getQuery(api.viewer.current, {})?.owner
				if (!owner) return
				insertAtTop({
					paginatedQuery: api.notes.list,
					localQueryStore,
					item: {
						_id: `optimistic:${crypto.randomUUID()}` as never,
						_creationTime: Date.now(),
						owner,
						text: text.trim(),
					},
				})
			},
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
		notes: atom({}, 'notesPage.notes').extend(
			withConvexPaginatedQuery(convex, api.notes.list, { initialNumItems: NOTES_PAGE_SIZE }),
		),
		// The backend's view of the caller, independent of the client-side session.
		viewer: atom({}, 'notesPage.viewer').extend(withConvexQuery(convex, api.viewer.current)),
		form,
	}
}

export type NotesPageModel = ReturnType<typeof reatomNotesPage>
