#!/bin/sh
# Apply database migrations (safe to repeat), then start the API.
set -e
cd /app
pnpm --filter @app/db exec prisma migrate deploy
exec node --enable-source-maps apps/api/dist/main.js
