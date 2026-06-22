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
| **Start Command** | *(оставить пустым — используется CMD из Dockerfile)* |
| **Pre-Deploy Command** | *(оставить пустым)* |

Render builds from `apps/api/Dockerfile`. В папке `apps/api` должен быть **`pnpm-lock.yaml`** (коммитится в git вместе с `package.json`).

При добавлении зависимостей в `apps/api/package.json` обновляй **оба** lockfile:

```bash
pnpm install                    # корень монорепо
cd apps/api && pnpm install     # lockfile для Render
```

Если в Start Command указано `pnpm install && ...` — уберите: зависимости уже установлены при сборке Docker-образа, повторный `pnpm install` при старте падает с `frozen-lockfile`.

Alternative: leave Root Directory empty and set Dockerfile to `./Dockerfile` at repo root for monorepo `--frozen-lockfile` builds.

## Security note

If JWT tokens were ever committed to git history, rotate `JWT_SECRET` in your deployment environment (e.g. Render dashboard). That invalidates all previously issued tokens immediately.
