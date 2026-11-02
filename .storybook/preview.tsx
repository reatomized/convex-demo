/// <reference types="msw-storybook-addon/types" />
import '../src/setup'

import '../src/index.css'

import type { ConvexStorybookParameters } from '@reatomized/convex-storybook'
import type { PreviewAddon } from 'storybook/internal/csf'

import { type RootFrame } from '@reatom/core'
import { reatomContext } from '@reatom/react'
import convexStorybook from '@reatomized/convex-storybook'
import addonA11y from '@storybook/addon-a11y'
import { definePreview } from '@storybook/react-vite'
import { configureDiagnostics } from 'kahraman/preview'
import addonMsw from 'msw-storybook-addon'
import { setupWorker } from 'msw/browser'

import { clearAbortErrors, drainAbortErrors, formatAbortErrors } from './abortErrorGuard'
// oxlint-disable-next-line no-restricted-imports
import { useEffect, type PropsWithChildren } from 'react'

import { handlersArray } from '#app/mocks/handlers'
import { ALEX, deployment, storyIdentity } from '#shared/mocks/convexDeployment'
import { css } from '#styled-system/css'

import { storyFrame, storyFrameAddon } from './storyFrame'
import { FALLBACK_VIEWPORT, getViewportSize } from './viewports'

// Storybook 10.5's test preview replaces `HTMLElement.prototype.focus` with an
// accessor for interaction instrumentation. Zag's focus-visible manager reads
// that property from the prototype, invoking the accessor with an invalid
// receiver and causing `TypeError: Illegal invocation`. Keep the native method
// and restore it before each story until the upstream compatibility issue is resolved.
const nativeHTMLElementFocus = globalThis.HTMLElement
	? Object.getOwnPropertyDescriptor(globalThis.HTMLElement.prototype, 'focus')?.value
	: undefined

// MSW worker setup. The default request handlers (`handlersArray`) are passed
// as initial handlers so they survive the addon's per-story `resetHandlers()`
// — every story gets the full route set mocked by default, with individual
// routes overridable via `msw.use(...)` in a story's `beforeEach`.
async function setupMswWorker() {
	const worker = setupWorker(...handlersArray)
	await worker.start({
		onUnhandledRequest: 'bypass',
		quiet: true,
		serviceWorker: {
			url: `${import.meta.env['BASE_URL']}mockServiceWorker.js`,
		},
	})
	return worker
}

function ReatomDecorator({ children, frame }: PropsWithChildren<{ frame: RootFrame }>) {
	useEffect(() => {
		return () => {
			clearAbortErrors()
			queueMicrotask(clearAbortErrors)
		}
	}, [frame])

	return <reatomContext.Provider value={frame}>{children}</reatomContext.Provider>
}

// Name the addon's public parameter type for TypeScript composite-project inference.
const convexAddon: PreviewAddon<{ parameters: ConvexStorybookParameters }> = convexStorybook()

const preview = definePreview({
	addons: [addonA11y(), addonMsw(setupMswWorker), convexAddon, storyFrameAddon],
	decorators: [
		(Story, story) => (
			<ReatomDecorator frame={storyFrame(story)}>
				<Story />
			</ReatomDecorator>
		),
		(Story) => (
			<div className={css({ colorPalette: 'indigo' })}>
				<Story />
			</div>
		),
	],
	parameters: {
		a11y: { test: 'todo' },
		// Stories start signed in with ALEX's restored Convex Auth session.
		convex: { identity: storyIdentity('convex-auth', ALEX.email), setup: deployment() },
	},
	// fallow-ignore-next-line complexity
	beforeEach: async ({ globals, parameters }) => {
		// Run before a story mounts, so Zag observes the native focus method.
		if (nativeHTMLElementFocus) {
			Object.defineProperty(HTMLElement.prototype, 'focus', {
				configurable: true,
				value: nativeHTMLElementFocus,
			})
		}
		configureDiagnostics(parameters['kahraman'])
		clearAbortErrors()
		if (!(globalThis as Record<string, unknown>)['__vitest_worker__']) return
		const { page } = await import('vite-plus/test/browser')
		const viewportGlobal = globals['viewport'] as { value?: string } | string | undefined
		const viewportName = typeof viewportGlobal === 'string' ? viewportGlobal : viewportGlobal?.value
		const viewport = (viewportName ? getViewportSize(viewportName) : null) ?? FALLBACK_VIEWPORT
		await page.viewport(viewport.width, viewport.height)
		return () => {
			const errors = drainAbortErrors()
			if (errors.length > 0) {
				throw new Error(
					`Reatom AbortErrors detected during story test:\n${formatAbortErrors(errors)}`,
				)
			}
		}
	},
})

export default preview
