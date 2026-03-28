FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json

RUN npm ci

COPY . .

ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}

RUN npm run build --workspace @itecify/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@itecify/web"]
