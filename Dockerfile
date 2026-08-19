FROM node:22.13-alpine
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY src ./src
COPY database ./database
COPY public ./public
COPY examples/docker-registry.mjs ./examples/docker-registry.mjs
CMD ["node", "examples/docker-registry.mjs"]
