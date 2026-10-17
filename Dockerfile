# --- build the static site ------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && rm -rf dist/data

# --- runtime: one small Node server that serves the site and picks daily ---
FROM node:24-alpine
# tzdata so TZ (e.g. Europe/Madrid) decides when "today" starts.
RUN apk add --no-cache tzdata
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DIST_DIR=/app/dist DATA_DIR=/data PICK_TIME=06:00
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts/picker ./scripts/picker
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "server/index.mjs"]
