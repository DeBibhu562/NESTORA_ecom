# Deploying with Docker

One server, one `docker compose` stack: Postgres, Redis, the API, the storefront, the admin and Caddy (the front door).

| What | Address |
|---|---|
| Storefront | `PUBLIC_URL` (port 80) |
| Admin | `ADMIN_URL` (port 8081) |
| API | same addresses, under `/v1` |

## First install
```sh
cp .env.example .env        # fill in passwords and secrets (never commit .env)
docker compose build        # 5–10 minutes the first time
docker compose up -d
docker compose run --rm api sh deploy/seed.sh   # once: owner account, categories, pincodes, demo bottles
```
Log in to the admin as `SEED_OWNER_EMAIL`, then set up two-factor authentication when asked (required in production).

## Update
```sh
git pull   # or copy the new files
docker compose build && docker compose up -d     # migrations run automatically on start
```

## Notes
- `NEXT_PUBLIC_*` values are baked in at build time: change `PUBLIC_URL`/`ADMIN_URL` ⇒ rebuild.
- Over plain `http://IP` cookies can't be `Secure`, hence `COOKIE_SECURE=false`. Put a domain in front, switch to `https://` URLs and remove that line.
- Backups: `docker compose exec postgres pg_dump -U nestora ecommerce > backup.sql`, plus the `uploads` volume.
- Logs: `docker compose logs -f api`.

## Production setup at livoware.store (shared server)
The server's ports 80/443 belong to another project's Caddy (`/opt/coaching-platform/Caddyfile`). Livoware's own Caddy listens on host ports **8090** (storefront) and **8091** (admin); the shared Caddy forwards `livoware.store` to 8090 and (once DNS exists) `admin.livoware.store` to 8091.
Change that file safely: copy it, append the block, run `caddy validate` in a throwaway container with `/etc/letsencrypt` mounted, back up the live file, then `caddy reload` (graceful). Block for the admin:
```
admin.livoware.store {
	encode gzip zstd
	reverse_proxy 129.121.98.177:8091 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```
Server `.env` for https: `COOKIE_SECURE=true`, `TRUST_PROXY=2` (shared Caddy + Livoware Caddy), `PUBLIC_URL=https://livoware.store`.
