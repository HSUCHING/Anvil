# syntax=docker/dockerfile:1-labs@sha256:7d49dad25a050e14338ba7028b0460243f9d911dedc160a8fe20c34738fef3af

ARG NODE_VERSION=22.18.0

FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /workspace

RUN corepack enable

COPY . .

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,id=pnpm-store \
    pnpm install --frozen-lockfile

ARG GHOST_BUILD_VERSION=""
ENV GHOST_BUILD_VERSION=${GHOST_BUILD_VERSION}

RUN pnpm build:production && \
    pnpm --filter ghost archive

FROM node:${NODE_VERSION}-bookworm-slim AS production

ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y --no-install-recommends libjemalloc2 fontconfig && \
    rm -rf /var/lib/apt/lists/* && \
    groupmod -g 1001 node && \
    usermod -u 1001 node && \
    adduser --disabled-password --gecos "" -u 1000 ghost

WORKDIR /home/ghost

RUN corepack enable

COPY --from=builder /workspace/ghost/core/package ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,id=pnpm-store \
    apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 && \
    pnpm install --ignore-scripts --prod --prefer-offline && \
    (cd node_modules/sqlite3 && npm run install) && \
    apt-get purge -y build-essential python3 && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p default log && \
    cp -R content base_content && \
    cp -R content/themes/casper default/casper && \
    ([ -d content/themes/source ] && cp -R content/themes/source default/source || true) && \
    chown ghost:ghost /home/ghost && \
    chown -R nobody:nogroup /home/ghost/* && \
    chown -R ghost:ghost /home/ghost/content /home/ghost/log

USER ghost
ENV LD_PRELOAD=libjemalloc.so.2

EXPOSE 2368

CMD ["node", "index.js"]
