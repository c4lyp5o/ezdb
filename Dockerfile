FROM oven/bun:1.4.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend ./frontend
RUN bun run build

FROM oven/bun:1.4.4
WORKDIR /app
ENV NODE_ENV=production EZDB_HOST=0.0.0.0 EZDB_PORT=8080
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
USER bun
EXPOSE 8080
CMD ["bun", "backend/app.js"]
