// The size apps' models over @reatomized/convex's client calls, whatever renders them.
import { clearStack, computed, context, wrap } from '@reatom/core'
import { reatomConvexClient } from '@reatomized/convex'

import { addNoteFirst, api } from '../api'
import { summaryOf } from './summary'

clearStack()
export const frame = context.start()
const convex = reatomConvexClient('https://bench.convex.cloud', {}, 'convexClient')
const item = computed(
	() => (convex.isAuthenticated() ? convex.query(api.item, { id: 1 }).data() : undefined),
	'item',
)
const pages = frame.run(() => convex.paginatedQuery(api.page, {}, { initialNumItems: 10 }))
frame.run(() => convex.setAuth(async () => 'token'))

/** Adds a note, then loads another page. */
export const onClick = () =>
	void frame
		.run(() => convex.mutation(api.add, { text: 'x' }, { optimisticUpdate: addNoteFirst }))
		.then(wrap(() => pages.loadMore(10), frame))

/** Reads every piece of state the app shows. */
export const summary = summaryOf(convex, item, pages.results)
