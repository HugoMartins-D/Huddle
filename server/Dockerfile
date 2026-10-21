# API do HUDDLE. Build a partir da raiz do projeto (veja docker-compose.yml).
FROM node:24-alpine
WORKDIR /app
COPY server/package.json server/package.json
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY src/lib/types.ts src/lib/selectors.ts src/lib/
COPY server/*.ts server/
ENV NODE_ENV=production DATA_DIR=/data PORT=3400
EXPOSE 3400
CMD ["node", "server/index.ts"]
