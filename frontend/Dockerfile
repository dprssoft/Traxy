# ===================================================
# STAGE 1: Build (Builder)
# ===================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate && pnpm install --frozen-lockfile

COPY . .

# SvelteKit embeds PUBLIC_ variables into the bundle at build time
ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=${PUBLIC_API_URL}

RUN pnpm run build

RUN pnpm prune --prod

# ===================================================
# STAGE 2: Run (Runner)
# ===================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Increase request body size limit for avatars (default adapter-node is 512kb)
ENV BODY_SIZE_LIMIT=10M

# Disable telemetry
ENV MY_CLI_NO_UPDATE_NOTIFIER=true

# Use unprivileged 'node' user for security
USER node

COPY --from=builder --chown=node:node /app/build build/
COPY --from=builder --chown=node:node /app/node_modules node_modules/
COPY --from=builder --chown=node:node /app/package.json .

EXPOSE 3000

CMD ["node", "build"]
