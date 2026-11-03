// The size apps' models over @reatomized/convex's extensions, whatever renders them.
import { action, atom, clearStack, computed, context, wrap } from '@reatom/core'
import {
	reatomConvexClient,
	withConvexMutation,
	withConvexPaginatedQuery,
	withConvexQuery,
} from '@reatomized/convex'

import { addNoteFirst, api } from '../api'
import { summaryOf } from './summary'

clearStack()
export const frame = context.start()
const convex = reatomConvexClient('https://bench.convex.cloud', {}, 'convexClient')
const item = computed(() => (convex.isAuthenticated() ? { id: 1 } : 'skip'), 'item').extend(
	withConvexQuery(convex, api.item),
)
const pages = atom({}, 'pages').extend(
	withConvexPaginatedQuery(convex, api.page, { initialNumItems: 10 }),
)
const addNote = action(() => ({ text: 'x' }), 'addNote').extend(
	withConvexMutation(convex, api.add, { optimisticUpdate: addNoteFirst }),
)
frame.run(() => convex.setAuth(async () => 'token'))

/** Adds a note, then loads another page. */
export const onClick = () =>
	void frame.run(() => addNote()).then(wrap(() => pages.loadMore(10), frame))

/** Reads every piece of state the app shows. */
export const summary = summaryOf(convex, item.data, pages.results)
