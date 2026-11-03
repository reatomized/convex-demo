# Reatom Convex Auth

A [Convex](https://convex.dev) app whose client state lives in
[Reatom](https://github.com/reatom/reatom) v1001 atoms, built on the
[Karkas](https://github.com/apphane-dev/karkas) stack:

- The app runs on [`@reatomized/convex`](https://github.com/reatomized/convex),
  and its stories on `@reatomized/convex/testing` through
  `@reatomized/convex-storybook`. See [Testing](#testing).
- Convex Auth and better-auth on one deployment, behind one session model.
  See [Auth providers](#auth-providers).
- `packages/bench`: a browser benchmark of `packages/reatom-convex`, the
  binding over `convex/browser` this repository started with, against
  convex/react, rendered by @reatom/react and @reatom/jsx. See
  [packages/bench/README.md](packages/bench/README.md).

## Stack

- Package Manager: Nub
- Framework: React 19
- State Management & Routing: Reatom
- Styling: Panda CSS with Park UI components
- Internationalization: ParaglideJS
- UI Development & Testing: Storybook with Vitest integration
- Testing: Vitest browser mode with Playwright, written as Storybook stories
- Mocking: MSW (Mock Service Worker)
- Code Quality: oxfmt, oxlint, Fallow, TypeScript 7
- Build Tooling: Vite+ (`vite-plus`)
- Git Hooks & Quality Orchestration: `hk`
- Task Workflows: `mise`

## Architecture

The app follows a Feature-Sliced Design (FSD) layout under `src/`:

| Layer        | Responsibility                                                                |
| ------------ | ----------------------------------------------------------------------------- |
| `app/`       | Application shell, global composition, integration stories, MSW browser setup |
| `pages/`     | Route-level compositions and per-page UI, navigation, loading/error states    |
| `widgets/`   | Compositional blocks combining entities and shared UI (e.g. `AppShell`)       |
| `entities/`  | Domain models: API client calls, types, mocks, and Reatom atoms               |
| `shared/`    | Cross-cutting infra: API client, router, kahraman test extensions, components |
| `paraglide/` | Generated ParaglideJS output (do not edit)                                    |

## Setup

Install dependencies (this also generates Panda CSS, compiles ParaglideJS,
generates the MSW worker, and installs `hk` Git hooks):

```bash
nub install
```

## Development

The app needs a Convex backend. `convex:dev` runs a local deployment on
127.0.0.1:3210 with no Convex account, pushes `convex/` on every change, and
writes `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` to `.env.local`. Keep it
running in its own terminal:

```bash
mise run convex:dev
```

On the first run, and whenever the deployment is new, set the variables both
auth libraries need. The script generates the missing secrets and leaves
existing ones alone:

```bash
mise run convex:env
```

Then start the app at http://localhost:5173:

```bash
mise run dev
```

The site URL better-auth trusts is `SITE_URL` on the deployment, which defaults
to `http://localhost:5173`. Run `SITE_URL=... mise run convex:env` on a fresh
deployment to use another origin.

Start Storybook:

```bash
mise run storybook
```

## Auth providers

The sign-in page has an "Auth provider" radio group: Convex Auth
(`@convex-dev/auth`, Password) or Better Auth (`@convex-dev/better-auth`, email
and password). The choice lives in localStorage and stays fixed while signed
in. Each provider has its own accounts, so the same email can exist twice.

Both providers run on one deployment. `createBackend` in
`src/shared/api/createBackend.ts` builds the Convex client, both libraries
through `@reatomized/convex/convex-auth` and `@reatomized/convex/better-auth`,
and a `reatomAuthState` that follows the selected one. `main.tsx` puts it in
`backendAtom` at startup. `src/entities/session` reports `authenticated` only
after the backend accepts the library's token. The private pages render only in
that state, so their queries never run for a signed-out user.

On the backend, both libraries sign RS256 JWTs with the same issuer
(`CONVEX_SITE_URL`) and audience (`convex`). Convex checks a token against the
first provider whose issuer matches, and its OIDC check accepts Convex Auth's
kid-less tokens only when the JWKS holds one key. So the two
libraries share one key pair: `convex:env` derives Convex Auth's
`JWT_PRIVATE_KEY`/`JWKS` and better-auth's static `BETTER_AUTH_JWKS` from it,
and `convex/auth.config.ts` lists a single provider. better-auth is mounted at
`/api/better-auth` because Convex Auth owns `/api/auth`. Every token carries a
`provider` claim, and `convex/viewer.ts` turns it into the owner key for notes.

## Compared with convex/react

The app reads Convex through `backend().convex`, a `reatomConvexClient`. Its
state is in atoms, so routes, loaders and tests read it without a component
tree.

| convex/react                             | @reatomized/convex                                                  |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `useQuery(q, args)`                      | `convex.query(q, args)`: `data`, `error`, `status` atoms            |
| `usePaginatedQuery`                      | `convex.paginatedQuery(q, args, { initialNumItems })`               |
| `useMutation(m).withOptimisticUpdate(u)` | `convex.mutation(m, args, { optimisticUpdate: u })`                 |
| `useAction`                              | `convex.action(a, args)`                                            |
| `useConvexAuth()`                        | `reatomAuthState(convex, provider)`: `status`, `isLoading` and more |
| `useConvexConnectionState`               | `convex.connectionState`                                            |

Query errors land in `error()` and never reach an error boundary. A query is
subscribed while something reads its atoms, not while a component is mounted.
Routes gate on `sessionStatus` instead of `<Authenticated>`. The pagination
helpers from `convex/react` work with the client's optimistic updates: the
notes page adds notes through `insertAtTop`.

`mise run bench` measures convex/react against @reatomized/convex, with models
that call the client and models built with its extensions, see
[packages/bench/README.md](packages/bench/README.md).

## Testing

Three layers, each against what it can prove:

| Layer      | Runs                                          | Proves                                     |
| ---------- | --------------------------------------------- | ------------------------------------------ |
| UI         | Stories on a fake client, `mise run test:run` | What a user sees and does, per state       |
| Functions  | `convex/*.test.ts` on `convex-test`           | Server rules: owners, access, validation   |
| End to end | `mise run convex:smoke`, `mise run e2e:real`  | The real client, auth libraries and server |

**UI.** Stories never touch a deployment. `.storybook/storyFrame.ts` starts a
Reatom frame per story in a loader, and inside it calls `convexStory` from
`@reatomized/convex-storybook`, which builds a fake client and a fake auth
library from the story's `parameters.convex`. The frame setup puts them in
`backendAtom`, the atom `main.tsx` fills with the real backend. Handlers
answer the app's functions by reference in `parameters.convex.setup`.
Story tests use Kahraman actors and assert visible UI, as in this excerpt
from the seeded Access stories:

```tsx
export const AdminManagesAccounts = meta.story({
	parameters: {
		authProvider: 'better-auth',
		convex: { identity: storyIdentity('better-auth', 'olga@example.com') },
	},
})

AdminManagesAccounts.test('approves a waiting account', async () => {
	await I.see(loc.spaceHeading.wait())
	await I.click(button('Approve: alex@example.com'))
	await I.see(text('alex@example.com').within(loc.approved).wait())
	await I.dontSee(text('alex@example.com').within(loc.pending))
})
```

Query handlers run inside computeds: a mutation handler that writes the atoms
they read updates every query that depends on them, as a deployment would.
`src/shared/mocks/convexDeployment.ts` keeps accounts and notes that way, and
`src/app/integration/Access.stories.tsx` the team space's members. A story that
calls a function without a handler fails, even when the app catches the error.
Actor-only tests need no frame wrapper. Model and atom assertions belong in
unit tests. Reconnects, token refreshes and query sets are covered by the
client's parity tests. The connection-banner infrastructure tests inject those
external events into the fake and assert the resulting UI.

**Functions.** `convex-test` runs the functions in `convex/` against an
in-memory database, with identities set per call.

**End to end.** With `convex:dev` and `dev` running:

```bash
mise run convex:smoke  # both providers sign up and read their own notes over HTTP
mise run e2e:real      # the same journeys in Chromium, including a reload
```

## Validation

Run the full local quality pipeline (format, lint, typecheck, tests with
coverage, architecture, Fallow, build, tree-shaking):

```bash
mise run validate
```

For fast feedback on staged files, prefer `hk check` / `hk fix`. `validate`
never touches a real backend.
