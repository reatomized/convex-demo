# Benchmark: convex/react vs @reatomized/convex

```bash
mise run bench          # print the report
mise run bench --write  # also save it to RESULTS.md
mise run bench --items 50 --iterations 1 --warmup 0  # quick check that it runs
```

[RESULTS.md](RESULTS.md) holds the latest numbers. This page explains how they
are measured and what they say.

## How it runs

Five columns run the same scenarios on one page:

- `convex/react`: `ConvexReactClient` with `useQuery`, `usePaginatedQuery` and
  `useMutation` (`official.tsx`).
- `@reatom/react`: [`@reatomized/convex`](https://www.npmjs.com/package/@reatomized/convex)
  rendered by `reatomComponent` (`reatom.tsx`).
- `@reatom/jsx`: the same models rendered by @reatom/jsx, real DOM nodes with
  no virtual DOM (`reatomJsx.tsx`).
- `@reatom/react ext` and `@reatom/jsx ext`: the same views over models built
  with the client's Reatom extensions.

`reatomModels.ts` builds the Reatom models two ways. The plain columns call the
client: `convex.query(api.item, { id })` per item, `convex.mutation` with the
optimistic update, `convex.paginatedQuery`. The `ext` columns build an atom per
item, `atom({ id }).extend(withConvexQuery(convex, api.item))`, and use
`withConvexMutation` and `withConvexPaginatedQuery` for the rest. The React
columns share the root that counts commits (`reactView.tsx`).

`run.ts` builds `index.html` in production mode, with React's profiling build
so `<Profiler>` can count commits, and serves it with cross-origin isolation
for 5µs timers. Playwright drives `window.bench` from `main.tsx`. Each
iteration runs every scenario for every column, rotating which column goes
first, and every run gets a fresh server, client and container. Warmup
iterations are dropped.

A scenario ends when a DOM condition holds, such as 1000 elements with
`data-v="1"`. `completion.ts` scans the container once, then checks only the
nodes each mutation record names, so the check costs the same for a renderer
that commits once and one that patches 1000 nodes separately.

The server is `packages/convex-fake-server`, running in the page. It speaks
Convex's websocket protocol and answers on later macrotasks, so the clients do
their normal work: JSON parsing, query set versions, optimistic layers. Every
scenario runs against two response shapes, alternating which goes first:

- per-message: one transition for each query-set message. A client that sends
  one message per subscription gets up to 1000 transitions for 1000 queries.
- coalesced: one transition after a burst of query-set messages.

Neither is a claim about how a deployed Convex backend groups its responses.

@reatom/jsx's `jsx-runtime` entry exports only the classic `h`/`hf`, so
`run.ts` resolves `@reatom/jsx/jsx-runtime` to `reatomJsxRuntime.ts`, a small
automatic runtime over them.

Bundle sizes come from minified builds of `size/*.tsx`. Each Convex app is the
same small app over `size/app.ts` or its convex/react equivalent: client,
auth, connection state, a skippable query, an optimistic mutation and a
paginated query. Its Convex share is its size over a baseline with the same
view layer and no Convex.

## What the numbers say

From [RESULTS.md](RESULTS.md), 1000 components where a scenario mounts many, on
a 4-core cloud VM. Its times are about four times those of the Apple M4 Pro run
of
[0.3.0](https://github.com/reatomized/convex-demo/blob/226566179f762eb1c1eaf5ba7012e2a4d5d893f3/packages/bench/RESULTS.md),
so compare ratios across runs, not milliseconds. Repeated runs on this VM moved
single medians by up to 15%.

**The extensions against client calls:**

- **Mounting costs 15–30 µs more per query.** Per-message mount is 96.9 against
  78.0 ms under @reatom/react and 50.7 against 35.7 ms under @reatom/jsx;
  coalesced, 98.2 against 67.6 and 57.2 against 35.3 ms. An extended item
  builds its arguments atom, the computed that maps them to the client's entry,
  and its `data` computed; a direct item reads the entry's atoms. A Node run
  over the scripted server measures the same gap, about 11–14 µs per query.
- **Updates cost 1–4 µs more per query.** Update all is 26.7 against 25.3 ms
  per-message and 27.6 against 23.3 ms coalesced under @reatom/react, 9.41
  against 7.89 and 8.92 against 7.58 ms under @reatom/jsx. `data` reads the
  entry's result, so an update recomputes as many atoms; the extra cost is
  checking the arguments computed.
- **Unmount** is 52.9 against 41.3 ms under @reatom/react per-message and
  within 2 ms in the other three cells.
- **Single queries, mutations, optimistic updates and pagination stay within
  0.1 ms of the plain columns.** The 20-transition burst varies more between
  runs than between columns.
- **Bundle.** The extension apps add 2.4–2.5 KiB gzip over the same apps on
  client calls: the extensions module and `withAsync` for the mutation.

None of this shows on a page with a few dozen queries. Code that mounts
hundreds of queries at once and needs every microsecond can read
`convex.query(ref, args)` directly; both styles share the client's entries.

**@reatomized/convex against convex/react:**

- **Mounting 1000 queries with per-message responses: 168 ms for convex/react,
  78 ms (0.46×) with @reatom/react, 36 ms (0.21×) with @reatom/jsx.**
  convex/browser sends a query-set message per subscription and gets 1001
  transitions back. @reatomized/convex batches the changes of one microtask
  into one message, so the server answers twice.
- **With coalesced responses that batching no longer matters,** and
  @reatom/react mounts slower on this machine: 53 ms for convex/react, 68 ms
  (1.27×) with @reatom/react and 35 ms (0.67×) with @reatom/jsx. The M4 Pro run
  measured 1.18× and 0.52×.
- **@reatom/react is slower when many components update at once:** update all
  2.1×, shared mount and shared update 1.5–1.9×. @reatom/jsx is 0.3–0.7× on the
  same rows, so the cost is in `reatomComponent`, not the client.
- **Fewer renders.** Both Reatom columns render each item twice on mount,
  against three times for `useQuery`, and @reatom/react commits twice where
  convex/react commits three or four times.
- **Bundle.** The Convex share is 16.8 KiB gzip with @reatom/react and 17.7 KiB
  with @reatom/jsx, against 20.9 KiB for convex/react. The @reatom/jsx app is
  25.4 KiB in total, against 86.7 KiB for the convex/react one, because React
  is gone.

The differences between the clients matter when hundreds of subscriptions
start, stop or update in one frame.

## Limits

- One machine, one browser. The ratios mean more than the absolute times.
- React runs its profiling build for timing and render counts alike.
- Below 0.3 ms, scheduling and harness overhead dominate.
- The fake server answers in the page, so there is no network latency, and
  the response shapes are synthetic.
