ARG BASE_IMAGE=mirror.gcr.io/library/node:22-alpine
FROM ${BASE_IMAGE} AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm i; fi
COPY prisma ./prisma
RUN npx prisma generate
RUN npx prisma generate --schema=prisma/sgu/schema.prisma
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
RUN npm run build
RUN npm prune --production
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
