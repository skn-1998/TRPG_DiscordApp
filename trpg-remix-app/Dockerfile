FROM node:22-alpine AS base

RUN apk add --no-cache wget

ARG PNPM_VERSION=11.5.1
RUN npm install --global "pnpm@${PNPM_VERSION}"

WORKDIR /usr/src/app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS development

RUN pnpm install --frozen-lockfile
COPY . .

ENV NODE_ENV=development
ENV WATCHPACK_POLLING=true

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173/ || exit 1

CMD ["sh", "-c", "CI=true pnpm install --frozen-lockfile && exec pnpm run dev"]

FROM base AS build

RUN pnpm install --frozen-lockfile
COPY . .

ENV NODE_ENV=production
RUN pnpm run build

FROM node:22-alpine AS production

RUN apk add --no-cache wget

WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /usr/src/app/public ./public
COPY --from=build --chown=nextjs:nodejs /usr/src/app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /usr/src/app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
