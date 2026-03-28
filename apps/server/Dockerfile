FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ docker.io ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY . .

RUN npm run build --workspace @itecify/server

ENV NODE_ENV=production
ENV PORT=4000
ENV CLIENT_URL=http://localhost:3000

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "@itecify/server"]
