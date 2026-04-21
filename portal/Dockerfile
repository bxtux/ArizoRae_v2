FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -D -u 1001 -G nodejs next
COPY --from=builder --chown=next:nodejs /app/.next ./.next
COPY --from=builder --chown=next:nodejs /app/public ./public
COPY --from=builder --chown=next:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=next:nodejs /app/package.json ./package.json
COPY --from=builder --chown=next:nodejs /app/prisma ./prisma
USER next
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
