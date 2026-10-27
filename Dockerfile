# Encore server. Runs as a long-lived container: the Qloo harness's MCP server is a local
# stdio process, so serverless platforms are not supported.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY server/ server/
COPY web/ web/
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
COPY --from=build --chown=node:node /app/web/dist web/dist
# Aggregate evaluation results (the dataset itself is never bundled; its license forbids it).
COPY --chown=node:node eval/results.json eval/results.json
RUN mkdir -p /app/var && chown node:node /app/var
# Hackathon keys only work against the hackathon API; the harness defaults to production.
# Set here for the image and again at start by the entrypoint.
RUN setpriv --reuid=node --regid=node --init-groups env HOME=/home/node qloo config set base-url https://hackathon.api.qloo.com
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/dist/index.js"]
