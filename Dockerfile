FROM node:20-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy dependency manifests + patches first (for layer caching)
COPY package.json pnpm-lock.yaml .npmrc* ./
COPY patches/ ./patches/

# Install ALL deps with shamefully-hoist so node_modules is flat (no symlink issues)
# Do NOT prune - pnpm prune removes hoisted packages breaking ESM resolution
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Copy source and build
COPY . .
RUN pnpm build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
