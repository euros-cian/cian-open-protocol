FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY src ./src
COPY database ./database
COPY examples/docker-registry.mjs ./examples/docker-registry.mjs
CMD ["node", "examples/docker-registry.mjs"]
