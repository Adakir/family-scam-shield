# Family Scam Shield

An Android-first mobile app that explains suspicious messages and links in plain language so families can pause before a scam.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/family-scam-shield/app/index.tsx` — primary mobile experience
- `artifacts/family-scam-shield/lib/scamAnalysis.ts` — local scam-signal analysis and plain-language results
- `artifacts/family-scam-shield/lib/storage.ts` — AsyncStorage persistence for recent checks and trusted-contact settings
- `artifacts/family-scam-shield/constants/colors.ts` — product color tokens

## Architecture decisions

- The first release is frontend-only and stores user data locally with AsyncStorage.
- The initial wedge is paste-to-check SMS/link analysis; automatic SMS reading, call screening, and push notifications are intentionally out of scope.
- Detection uses transparent local heuristics and explains the signals instead of presenting a technical reputation score.
- Trusted-contact alerts are represented as an opt-in share reminder until a notification or messaging service is added.

## Product

- Paste a suspicious message, link, or email into the checker.
- Receive a clear safe, caution, or likely scam result with a recommended next action.
- Review the reasons behind a warning in non-technical language.
- Save recent checks locally for reference.
- Configure a trusted contact and family-alert reminder locally on the device.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
