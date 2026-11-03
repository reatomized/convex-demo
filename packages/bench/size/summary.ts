// What both size apps show: every piece of state they read.
import type { ReatomConvexClient } from '@reatomized/convex'

export const summaryOf =
	(convex: ReatomConvexClient, item: () => unknown, results: () => unknown) => () =>
		JSON.stringify([
			convex.isAuthenticated(),
			convex.isRefreshingAuth(),
			convex.connectionState().isWebSocketConnected,
			item(),
			results(),
		])
