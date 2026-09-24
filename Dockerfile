FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace @nexus/shared \
  && npm run build --workspace @nexus/api \
  && npm run build --workspace @nexus/web

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/dist/apps/web/browser ./apps/web/browser
COPY --from=build /app/infra/migrations ./infra/migrations

EXPOSE 10000
CMD ["sh", "-c", "node apps/api/dist/database/migrate.js && node apps/api/dist/main.js"]
