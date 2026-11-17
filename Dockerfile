FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS build
WORKDIR /repo

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY astro.config.mjs tsconfig.json ./
COPY docs/brand/tokens.css docs/brand/tokens.css
COPY docs/brand/avatar/memoji.webp docs/brand/avatar/memoji.webp
COPY public public
COPY src src
COPY scripts/fetch-sounds.ts scripts/fetch-sounds.ts
ARG SOUNDS_REPO=AndryOre/andryore-private
ARG SOUNDS_REF=main
COPY package.json .env* ./
RUN mkdir /env-out && if [ -f .env ]; then cp .env /env-out/.env && chmod 644 /env-out/.env; fi
RUN --mount=type=secret,id=DOTENV_PRIVATE_KEY,env=DOTENV_PRIVATE_KEY \
    SOUNDS_REPO="$SOUNDS_REPO" SOUNDS_REF="$SOUNDS_REF" \
    bun --bun ./node_modules/.bin/dotenvx run -- bun scripts/fetch-sounds.ts
RUN --mount=type=secret,id=DOTENV_PRIVATE_KEY,env=DOTENV_PRIVATE_KEY \
    bun --bun ./node_modules/.bin/dotenvx run -- bun run build
COPY docker/security-headers.conf.template docker/security-headers.conf.template
COPY scripts/render-csp.ts scripts/render-csp.ts
RUN bun scripts/render-csp.ts dist docker/security-headers.conf.template /repo/security-headers.conf
RUN bun build --compile --no-compile-autoload-dotenv src/server/stream-status-server.ts --outfile /repo/stream-status-server

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /repo/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/site.conf /etc/nginx/conf.d/site.conf
COPY --from=build /repo/dist /usr/share/nginx/html
COPY --from=build /repo/stream-status-server /usr/local/bin/stream-status-server
COPY --from=build /env-out/ /app/
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
