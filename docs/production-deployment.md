# Production Deployment

This project is intended to run as a fully containerized Ghost deployment. The application services are managed by Docker Compose. Server-wide network concerns such as public HTTPS, Cloudflare, and Nginx can live outside this repository.

## Deployment Model

The production Compose stack starts these services:

| Service | Purpose |
| --- | --- |
| `gateway` | Internal HTTP gateway using Caddy, exposed on `GATEWAY_HTTP_PORT` |
| `ghost` | Built from this repository using `docker/ghost-production/Dockerfile` |
| `mysql` | Ghost database |
| `redis` | Cache/session support |

The expected public request path is:

```txt
Visitor
  -> Cloudflare, optional
  -> Server Nginx/Caddy reverse proxy, optional but recommended
  -> Docker gateway on 127.0.0.1:GATEWAY_HTTP_PORT
  -> Ghost container
```

Only the Docker gateway should be exposed to the server reverse proxy. MySQL and Redis should stay internal to Docker.

## Server Prerequisites

Install these on the server:

- Git
- Docker Engine
- Docker Compose plugin
- Optional: Nginx or Caddy as the server-wide HTTPS reverse proxy
- Optional: pnpm, only if you want to use package scripts instead of raw `docker compose` commands

Recommended firewall exposure:

| Port | Public? | Purpose |
| --- | --- | --- |
| `22` | yes, restricted | SSH |
| `80` | yes | HTTP challenge/redirect |
| `443` | yes | HTTPS traffic |
| `GATEWAY_HTTP_PORT` | no, or localhost only | Docker gateway behind Nginx/Caddy |
| MySQL/Redis | no | Internal Docker services only |

## Cloudflare

If using Cloudflare:

1. Create an `A` record for the site hostname pointing to the server IP.
2. Keep the proxy enabled if you want Cloudflare in front of the site.
3. Use SSL/TLS mode `Full (strict)` when the origin has a valid certificate.
4. Do not cache Ghost admin routes. At minimum, avoid caching:

```txt
/ghost/*
/members/*
```

5. If uploads or imports fail, increase Cloudflare and Nginx upload/body limits.

Cloudflare is not required. The stack works behind any reverse proxy that forwards the correct headers.

## Nginx Example

If Nginx is installed globally on the server, keep Docker bound to an internal/local HTTP port and proxy to it.

Example server block:

```nginx
server {
    listen 80;
    server_name example.com;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:2368;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Match `proxy_pass` to your `GATEWAY_HTTP_PORT` value.

## Clone The Project

```bash
git clone https://github.com/HSUCHING/Anvil.git
cd Anvil
```

Use the deployment branch you intend to run:

```bash
git checkout rx-custom
```

## Configure Environment Variables

Create a local `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` and fill the production values. Do not commit `.env`.

Required production variables:

| Variable | Required | Meaning |
| --- | --- | --- |
| `GHOST_URL` | yes | Public URL for the site, for example `https://example.com`. Ghost uses this in links, redirects, email links, and canonical URLs. |
| `MYSQL_ROOT_PASSWORD` | yes | Root password for the MySQL container. Use a strong unique value. |
| `MYSQL_PASSWORD` | yes | Password for the Ghost MySQL user. Use a strong unique value. |
| `MAIL_FROM` | yes | Sender identity, for example `xcognix <noreply@mail.example.com>`. The sender domain must be verified by your SMTP provider. |
| `MAIL_HOST` | yes | SMTP host, for example `smtp.resend.com`. |
| `MAIL_USER` | yes | SMTP username. For Resend this is commonly `resend`. |
| `MAIL_PASSWORD` | yes | SMTP password or API key. Never commit this value. |

Common optional variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `GATEWAY_HTTP_PORT` | `2368` | Host port exposed by the Docker gateway. If Nginx is global, proxy to this port. |
| `MYSQL_DATABASE` | `ghost_dev` | Database name used by Ghost. |
| `MYSQL_USER` | `ghost` | MySQL user used by Ghost. |
| `MAIL_TRANSPORT` | `SMTP` | Ghost mail transport. Use `SMTP` for Resend/Mailgun/etc. |
| `MAIL_PORT` | `587` | SMTP port. |
| `NODE_VERSION` | `22.18.0` | Node version used by the production image build. |
| `GHOST_BUILD_VERSION` | empty | Optional build version metadata. |

Example Resend mail settings:

```env
MAIL_TRANSPORT=SMTP
MAIL_FROM="xcognix <noreply@mail.example.com>"
MAIL_HOST=smtp.resend.com
MAIL_PORT=587
MAIL_USER=resend
MAIL_PASSWORD=your-resend-smtp-key
```

Make sure the `MAIL_FROM` domain is verified in Resend. If `MAIL_FROM` is `noreply@mail.example.com`, verify `mail.example.com` in Resend and configure its DNS records.

## Audit The Environment

Before building or starting the stack, run the production environment check:

```bash
pnpm docker:production:check-env
```

Without pnpm, run the script directly:

```bash
node scripts/validate-production-env.js
```

The script checks:

- `.env` exists
- required variables are present
- obvious placeholders or weak defaults are not being used
- `GHOST_URL` is valid
- `MAIL_FROM` contains an email address
- shell variables that override `.env` values are reported
- `docker compose -f compose.production.yaml config --quiet` succeeds

If the script reports errors, fix `.env` before starting Docker.

## Build And Start

With pnpm:

```bash
pnpm docker:production:up
```

Without pnpm:

```bash
docker compose -f compose.production.yaml up -d --build --wait
```

Check service status:

```bash
docker compose -f compose.production.yaml ps
```

Follow logs:

```bash
pnpm docker:production:logs
```

or:

```bash
docker compose -f compose.production.yaml logs -f
```

Stop the stack:

```bash
pnpm docker:production:down
```

or:

```bash
docker compose -f compose.production.yaml down
```

## Updating A Server

```bash
git pull
pnpm docker:production:check-env
pnpm docker:production:up
```

This rebuilds the Ghost image and restarts changed services.

## Data Persistence

Production data is stored in Docker volumes:

| Volume | Contains |
| --- | --- |
| `anvil_mysql-data` | MySQL database |
| `anvil_redis-data` | Redis data |
| `anvil_ghost-production-data` | Ghost data files |
| `anvil_ghost-production-images` | Uploaded images |
| `anvil_ghost-production-media` | Uploaded media |
| `anvil_ghost-production-files` | Uploaded files |
| `anvil_ghost-production-logs` | Ghost logs |

Do not delete these volumes unless you intend to delete production data.

## Backups

At minimum, back up:

- MySQL database
- Ghost content volumes, especially images/media/files/data
- `.env`, stored securely outside Git

Example MySQL dump:

```bash
docker compose -f compose.production.yaml exec mysql \
  sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  > ghost-backup.sql
```

Also back up Docker volumes using your normal server backup process.

## Troubleshooting

Run the environment audit first:

```bash
pnpm docker:production:check-env
```

Check logs:

```bash
docker compose -f compose.production.yaml logs ghost gateway mysql
```

Common issues:

| Symptom | Likely Cause |
| --- | --- |
| Signup/login emails fail | `MAIL_FROM` domain is not verified by SMTP provider, or SMTP credentials are wrong |
| Site redirects to the wrong domain | `GHOST_URL` is wrong |
| Admin assets or links look wrong | Reverse proxy is missing `X-Forwarded-Proto https` or `Host` headers |
| Uploads fail | Nginx/Cloudflare body size limit is too low |
| Compose refuses to start | Required `.env` variables are missing |
