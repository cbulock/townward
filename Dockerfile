# Production image: builds the client, then runs the save server, which also serves the client.
# See docs/deploy.md. Build: docker build -t citybuilder .

FROM node:26-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:26-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787
RUN npm install -g pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && npm uninstall -g pnpm
# The server runs its TypeScript directly (Node type stripping) and shares one file with the client.
COPY server ./server
COPY src/shared/api.ts ./src/shared/api.ts
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "server/index.ts"]
