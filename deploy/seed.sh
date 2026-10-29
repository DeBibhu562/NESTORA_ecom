#!/bin/sh
# First install only: creates the owner account, roles, categories, pincodes and the demo bottle catalogue.
set -e
cd /app
pnpm --filter @app/db exec tsx seed/seed.ts
