# Territory Run

Game backend for GPS-based territory capture. NestJS monorepo with a single API app.

![CI](https://github.com/sasha251086/territory-run/actions/workflows/ci.yml/badge.svg)

## Stack

- **Backend:** NestJS, Prisma, PostgreSQL, Redis, BullMQ, H3
- **Package manager:** pnpm (workspace)

## Development

```bash
pnpm install
cd apps/api
pnpm start:dev
```

## Scripts (repository root)

| Command         | Description                          |
|-----------------|--------------------------------------|
| `pnpm lint`     | ESLint on `apps/api/src`             |
| `pnpm type-check` | TypeScript check + Prisma generate |
| `pnpm test`     | Jest unit tests                      |
| `pnpm build`    | NestJS production build              |

## Docker

**Local (monorepo, frozen lockfile):**

```bash
docker compose up --build
```

Uses root `Dockerfile` with full pnpm workspace context.

**Render.com**

| Setting | Value |
|---------|--------|
| Root Directory | `apps/api` |
| Dockerfile path | `Dockerfile` |

Render builds from `apps/api/Dockerfile` with context `apps/api` (no monorepo root files in context). Dependencies install from `apps/api/package.json` via pnpm.

Alternative: leave Root Directory empty and set Dockerfile to `./Dockerfile` at repo root for `--frozen-lockfile` builds.

## Security note

If JWT tokens were ever committed to git history, rotate `JWT_SECRET` in your deployment environment (e.g. Render dashboard). That invalidates all previously issued tokens immediately.
