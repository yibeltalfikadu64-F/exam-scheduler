# ------------------------------------------------------------
# Backend Dockerfile — UNVERIFIED (Docker is not installed on the
# development machine). Build context is ./backend.
#
# NOTE: SQL migrations live at ../database/migrations (repo root), which is
# outside this build context. After the stack is up, run migrations from the
# host with `npm run db:migrate`, or adjust the compose service to mount the
# migrations and run them at startup.
# ------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
