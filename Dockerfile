# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages/config/package.json packages/config/
COPY packages/atlassian/package.json packages/atlassian/
COPY packages/scrubber/package.json packages/scrubber/
COPY packages/mcp-servers/package.json packages/mcp-servers/
COPY packages/chat-backend/package.json packages/chat-backend/
COPY packages/chat-ui/package.json packages/chat-ui/
RUN npm ci

COPY packages/ packages/
RUN npm run build -w packages/config \
 && npm run build -w packages/atlassian \
 && npm run build -w packages/scrubber \
 && npm run build -w packages/mcp-servers \
 && npm run build -w packages/chat-backend
RUN cd packages/chat-ui && npx vite build

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/config/package.json packages/config/package.json
COPY packages/atlassian/package.json packages/atlassian/package.json
COPY packages/scrubber/package.json packages/scrubber/package.json
COPY packages/mcp-servers/package.json packages/mcp-servers/package.json
COPY packages/chat-backend/package.json packages/chat-backend/package.json

COPY --from=builder /app/packages/config/dist/ packages/config/dist/
COPY --from=builder /app/packages/atlassian/dist/ packages/atlassian/dist/
COPY --from=builder /app/packages/scrubber/dist/ packages/scrubber/dist/
COPY --from=builder /app/packages/mcp-servers/dist/ packages/mcp-servers/dist/
COPY --from=builder /app/packages/chat-backend/dist/ packages/chat-backend/dist/
COPY --from=builder /app/dist/public/ dist/public/

RUN npm ci --omit=dev

# Writable configuration directory (mounted as a named volume)
RUN mkdir -p /var/lib/foxbridge

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "packages/chat-backend/dist/index.js"]
