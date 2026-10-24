# Life Curator — notes for Claude

- Product brief: `PRODUCT_SPEC.md` (condensed; the original master spec is canonical). Defaults: `USER_PROFILE.md`.
- Stack: Next.js 15 App Router, React 19, TypeScript (strict), Tailwind v4, Vitest, Playwright.
- Domain logic lives in `src/lib/domain/` as pure functions with tests in `__tests__/`. Keep scheduling,
  budget, status and ranking rules deterministic there — never move them into UI code or an LLM.
- Backend lives in `src/server/` + `src/app/api/`. The server applies changes with the same reducer
  (`src/lib/store/state.ts`); validate every new action in `src/server/validate.ts`, and scope every
  query by the session user's id. Add schema changes as a new entry in `src/server/migrations.ts`.
- Event providers implement `EventSourceAdapter` (`src/lib/sources/types.ts`) and go through `collectEvents`.
- Sample data must stay labelled as fictional and must never carry booking links.
- Never add calendar writes, purchases, bookings or automatic messaging (a guardrail test scans for them).

## Checks
```bash
npm run check   # typecheck + lint + unit tests
npm run build
CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run e2e   # builds must exist (npm run build)
```
