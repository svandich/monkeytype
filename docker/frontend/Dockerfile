FROM node:24.11.0-alpine3.22 AS builder
WORKDIR /app

#ENV
ENV BACKEND_URL=###MONKEYTYPE_BACKENDURL### PROGCOMP_API_URL=###PROGCOMP_API_URL### PROGCOMP_SITE_URL=###PROGCOMP_SITE_URL### REQUIRE_LOGIN=###REQUIRE_LOGIN###

#COPY
COPY ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "./"]
COPY packages packages
COPY frontend frontend

#gimme pnpm + build
RUN npm i -g pnpm@11.21.0 && \
    pnpm i --frozen-lockfile && \
    npm run build

# COPY to target
FROM nginx:mainline-alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/frontend/updateConfig.sh /docker-entrypoint.d/updateConfig.sh
RUN chmod +x /docker-entrypoint.d/updateConfig.sh

# entry
#CMD ["./entryPoint.sh"]
