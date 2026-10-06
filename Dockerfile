# Encore server. Runs as a long-lived container: the Qloo harness's MCP server is a local
# stdio process, so serverless platforms are not supported.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci
COPY server/ server/
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/app/var
RUN npm install --global @qloo/qloo-harness@0.1.26 && npm cache clean --force
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/package.json server/
COPY --from=build --chown=node:node /app/server/dist server/dist
RUN mkdir -p /app/var && chown node:node /app/var
USER node
# Hackathon keys only work against the hackathon API; the harness defaults to production.
RUN qloo config set base-url https://hackathon.api.qloo.com
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
