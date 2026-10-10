FROM node:22-slim
ENV NODE_ENV=production HOME=/home/node PORT=8080
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
