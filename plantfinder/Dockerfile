# PlantFinder: one container serves the API and the built web app.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/
COPY apps/web/package.json apps/web/
COPY apps/extension/package.json apps/extension/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @plantfinder/web build && pnpm --filter @plantfinder/api build \
 && pnpm --filter @plantfinder/api deploy --prod --legacy /out \
 && cp -r services/api/dist services/api/fixtures /out/

FROM node:22-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 NODE_USE_ENV_PROXY=1 PF_WEB_DIST=/app/web PF_FIXTURES_DIR=/app/fixtures PF_DATA_DIR=/data
WORKDIR /app
COPY --from=build /out /app
COPY --from=build /app/apps/web/dist /app/web
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
