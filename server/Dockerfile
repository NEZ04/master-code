FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY test ./test
USER node
ENV PORT=4000 NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/index.js"]
