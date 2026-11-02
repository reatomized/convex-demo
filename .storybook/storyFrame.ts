import type { AuthProviderId } from '#shared/api'
import type { RootFrame } from '@reatom/core'
import type { PreviewAddon } from 'storybook/internal/csf'

import { assert, context, noop, urlAtom, withChangeHook } from '@reatom/core'
import {
	convexStory,
	type ConvexStorybookParameters,
	type ConvexStoryFake,
} from '@reatomized/convex-storybook'

import { authProvider } from '#entities/session'
import { backendAtom } from '#shared/api'
import { fakeBackend } from '#shared/mocks/convexDeployment'

export interface StoryFrameParameters {
	/** Path the router boots at, relative to the Storybook base URL. */
	initialPath?: string
	/** The auth library selected on the sign-in page. */
	authProvider?: AuthProviderId
}

type StoryContext = {
	parameters: StoryFrameParameters & ConvexStorybookParameters & Record<string, unknown>
	abortSignal: AbortSignal
}

const LOADED_KEY = 'reatomFrame'
const frames = new WeakSet<object>()
// Storybook keeps a render's abort signal across rerenders after a control or
// global change, and replaces it on remount, on another story and on every
// test run.
const renderFrames = new WeakMap<AbortSignal, RootFrame>()
const originalHref = window.location.href

// Routing state changes inside each story's frame; the iframe URL stays fixed
// for Storybook.
urlAtom.extend(withChangeHook(() => window.history.replaceState({}, '', originalHref)))

const startStoryFrame = (story: StoryContext) => {
	// withLocalStorage atoms (theme, locale, top-bar toggles, the auth provider)
	// would otherwise read what a previous story on the same origin persisted.
	if ((globalThis as Record<string, unknown>)['__vitest_worker__']) {
		window.localStorage.clear()
	}
	window.localStorage.removeItem('authProvider')
	const frame = context.start()
	frame.run(() => {
		urlAtom.sync.set(() => noop)
		if (story.parameters.authProvider) authProvider.set(story.parameters.authProvider)
		// The app keeps its backend in `backendAtom`; the story's fakes go there
		// before `urlAtom.go`, so routes match once, with the final state.
		backendAtom.set(fakeBackend(convexStory(story), authProvider))
		urlAtom.go((import.meta.env.BASE_URL ?? '') + (story.parameters.initialPath ?? ''))
	})
	frames.add(frame)
	return frame
}

/**
 * The frame for one story render: started on the first load, returned again
 * while the story rerenders, so a control or toolbar change keeps the state
 * the user reached.
 */
const loadStoryFrame = (story: StoryContext): RootFrame => {
	let frame = renderFrames.get(story.abortSignal)
	if (!frame) {
		frame = startStoryFrame(story)
		renderFrames.set(story.abortSignal, frame)
	}
	return frame
}

/**
 * Loads the story's frame before it mounts. A plain object, because
 * `definePreviewAddon` only returns its argument.
 */
export const storyFrameAddon: PreviewAddon<{ parameters: StoryFrameParameters }> = {
	loaders: [(story) => ({ [LOADED_KEY]: loadStoryFrame(story) })],
}

const isStoryFrame = (value: unknown): value is RootFrame =>
	typeof value === 'object' && value !== null && frames.has(value)

/** The frame a story renders with. */
export const storyFrame = ({ loaded }: { loaded: Record<string, unknown> }): RootFrame => {
	const frame = loaded[LOADED_KEY]
	assert(
		isStoryFrame(frame),
		'The story has no Reatom frame; storyFrameAddon is missing from the preview',
	)
	return frame
}

/**
 * Runs a story test body in the frame its story renders with, so the test
 * reads and writes the state the UI shows, and hands it the story's Convex
 * fakes. A continuation stays in the frame only after awaiting a promise from
 * `wrap(...)`.
 */
export const inStoryFrame =
	(fn: (fake: ConvexStoryFake) => Promise<void>) =>
	(story: StoryContext & { loaded: Record<string, unknown> }): Promise<void> =>
		storyFrame(story).run(() => fn(convexStory(story)))
