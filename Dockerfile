# One image for the API, storefront and admin: they share the workspace packages, and compose picks the command per service.
FROM node:22-alpine AS app
RUN corepack enable && apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# Next.js bakes NEXT_PUBLIC_* in at build time, so changing a public URL means rebuilding the image.
ARG NEXT_PUBLIC_BRAND_NAME=Nestora
ARG NEXT_PUBLIC_WEB_API_URL
ARG NEXT_PUBLIC_ADMIN_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY=
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NEXT_PUBLIC_FIREBASE_APP_ID=
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
RUN pnpm --filter @app/db generate \
 && pnpm --filter @app/api build \
 && NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_WEB_API_URL pnpm --filter @app/web build \
 && NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_ADMIN_API_URL pnpm --filter @app/admin build
ENV NODE_ENV=production
