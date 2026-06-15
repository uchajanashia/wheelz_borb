# syntax=docker/dockerfile:1

# ---- Build stage: compile the Angular SSR bundle -------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install all deps (devDependencies are needed for `ng build`).
COPY package.json package-lock.json ./
RUN npm ci

# Build → dist/wheelz/{browser,server}. server/server.mjs is the entry point.
COPY . .
RUN npm run build

# ---- Runtime stage: only what's needed to serve --------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Production deps only (express, compression, @angular/ssr runtime, ...).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The built app. server.mjs resolves ../browser relative to its own folder,
# so the dist/wheelz layout must be preserved.
COPY --from=build /app/dist ./dist

# Render injects PORT at runtime; the server reads process.env.PORT (default 4000).
EXPOSE 4000
CMD ["node", "dist/wheelz/server/server.mjs"]
