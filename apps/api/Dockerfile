# Render: Root Directory = apps/api (default). Build context is this folder only.
FROM node:22-bullseye

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/territory_run?schema=public"

RUN pnpm exec prisma generate
RUN pnpm run build

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
