/** @jsxImportSource @reatom/jsx */
// The features the app uses, through @reatomized/convex's extensions and @reatom/jsx.
import { mount } from '@reatom/jsx'

import { frame, onClick, summary } from './appExtensions'

frame.run(() =>
	mount(document.getElementById('root')!, <button on:click={onClick}>{summary}</button>),
)
