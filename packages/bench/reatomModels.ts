import type { Computed, Frame } from '@reatom/core'

import { action, atom, context } from '@reatom/core'
import {
	reatomConvexClient,
	withConvexMutation,
	withConvexPaginatedQuery,
	withConvexQuery,
	type ReatomConvexClient,
} from '@reatomized/convex'

import { addNoteFirst, api, CLIENT_URL, type BenchServer, type Handle } from './fixture'

export type ItemModel = { data: Computed<{ id: number; v: number } | undefined> }

/**
 * How the models reach the client: `client` calls `convex.query` and the other
 * methods, `extensions` builds atoms and actions with `withConvexQuery` and the
 * other extensions.
 */
export type Calls = 'client' | 'extensions'

/** What the Reatom views render: @reatomized/convex in a fresh context. */
export type ReatomModels = {
	frame: Frame
	connected(): boolean
	item(id: number): ItemModel
	list(handle: Handle): () => Array<{ _id: string; text: string }>
	pages(initialNumItems: number, handle: Handle): () => Array<{ _id: string; text: string }>
	close(): Promise<void>
}

type Features = Pick<ReatomModels, 'item' | 'list' | 'pages'>

const clientCalls = (convex: ReatomConvexClient, frame: Frame): Features => ({
	item: (id) => frame.run(() => convex.query(api.item, { id })),
	list(handle) {
		const notes = frame.run(() => convex.query(api.list, {}))
		handle.add = (text) =>
			frame.run(() => convex.mutation(api.add, { text }, { optimisticUpdate: addNoteFirst }))
		return () => notes.data() ?? []
	},
	pages(initialNumItems, handle) {
		const pages = frame.run(() => convex.paginatedQuery(api.page, {}, { initialNumItems }))
		handle.loadMore = (numItems) => frame.run(() => pages.loadMore(numItems))
		return pages.results
	},
})

const extensionCalls = (convex: ReatomConvexClient, frame: Frame): Features => ({
	item: (id) => atom({ id }, `item${id}`).extend(withConvexQuery(convex, api.item)),
	list(handle) {
		const notes = atom({}, 'list').extend(withConvexQuery(convex, api.list))
		const add = action((text: string) => ({ text }), 'add').extend(
			withConvexMutation(convex, api.add, { optimisticUpdate: addNoteFirst }),
		)
		handle.add = (text) => frame.run(() => add(text))
		return () => notes.data() ?? []
	},
	pages(initialNumItems, handle) {
		const pages = atom({}, 'pages').extend(
			withConvexPaginatedQuery(convex, api.page, { initialNumItems }),
		)
		handle.loadMore = (numItems) => frame.run(() => pages.loadMore(numItems))
		return pages.results
	},
})

export function reatomModels({ server }: BenchServer, calls: Calls): ReatomModels {
	const convex = reatomConvexClient(CLIENT_URL, {
		webSocketConstructor: server.WebSocket,
		skipConvexDeploymentUrlCheck: true,
		unsavedChangesWarning: false,
	})
	const frame = context.start()
	// Connects now, as `new ConvexReactClient` does.
	const unsubscribe = frame.run(() => convex.connectionState.subscribe(() => {}))
	return {
		frame,
		connected: () => frame.run(() => convex.connectionState().isWebSocketConnected),
		...(calls === 'client' ? clientCalls : extensionCalls)(convex, frame),
		close: () =>
			frame.run(() => {
				unsubscribe()
				return convex.close()
			}),
	}
}
