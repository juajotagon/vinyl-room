# --- build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Download the album art at build time. Pass a Discogs token as a build
# secret to prefer Discogs; without it, Cover Art Archive is used.
#   docker build --secret id=discogs_token,env=DISCOGS_TOKEN .
RUN --mount=type=secret,id=discogs_token \
    DISCOGS_TOKEN="$(cat /run/secrets/discogs_token 2>/dev/null || true)" npm run fetch-art \
 && npm run build

# --- serve ---------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
