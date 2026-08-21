# apps/web — Next.js, standalone output (see next.config.ts). Multi-stage:
# the builder stage needs the full node_modules + devDependencies to run
# `next build`; the runtime stage only needs what `.next/standalone`
# actually traced as used, which is dramatically smaller.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Standalone output already bundles a minimal node_modules subset — no
# `npm install` needed in this stage at all.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
