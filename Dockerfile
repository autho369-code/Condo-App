FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml .npmrc ./

# Install all dependencies (hoisted flat node_modules via .npmrc)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build (vite frontend + esbuild server)
RUN pnpm build

# Expose port
EXPOSE 3000

# Start server
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
