# Monorepo build: use with docker-compose or Render Root Directory = (repo root).
FROM node:22-bullseye

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api

ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/territory_run?schema=public"

WORKDIR /app/apps/api
RUN pnpm exec prisma generate
RUN pnpm run build

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
