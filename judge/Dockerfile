# Judge: runs untrusted code. Python 3, g++ and Node are the only toolchains inside.
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY test ./test
# Never run submissions as root.
USER node
ENV PORT=7000 NODE_ENV=production
EXPOSE 7000
CMD ["node", "src/server.js"]
