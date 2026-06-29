# syntax=docker/dockerfile:1

# ---- Build stage: compile the Angular SSR bundle -------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# The lockfile is authored by npm 11 (see package.json "packageManager"), which
# omits optional peer deps that node:22's bundled npm 10 expects -> `npm ci`
# fails with "Missing: @emnapi/* from lock file". Pin npm to match the lockfile.
RUN npm i -g npm@11.6.2

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

# Match the lockfile's npm version here too (see build stage above).
RUN npm i -g npm@11.6.2

# Production deps only (express, compression, @angular/ssr runtime, ...).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The built app. server.mjs resolves ../browser relative to its own folder,
# so the dist/wheelz layout must be preserved.
COPY --from=build /app/dist ./dist

# Render injects PORT at runtime; the server reads process.env.PORT (default 4000).
EXPOSE 4000
CMD ["node", "dist/wheelz/server/server.mjs"]
