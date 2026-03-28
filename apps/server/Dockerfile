FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    curl \
    docker.io \
    file \
    g++ \
    gcc \
    git \
    jq \
    less \
    make \
    nano \
    openssh-client \
    pkg-config \
    procps \
    python-is-python3 \
    python3 \
    python3-pip \
    ripgrep \
    rsync \
    tree \
    unzip \
    vim-tiny \
    wget \
    xz-utils \
    zip \
  && corepack enable \
  && corepack prepare pnpm@10.17.0 --activate \
  && corepack prepare yarn@stable --activate \
  && rm -rf /var/lib/apt/lists/*

RUN printf '%s\n' \
  'export TERM=xterm-256color' \
  'export FORCE_COLOR=1' \
  'export CLICOLOR=1' \
  'export NPM_CONFIG_UPDATE_NOTIFIER=false' \
  'export npm_config_fund=false' \
  'export PIP_DISABLE_PIP_VERSION_CHECK=1' \
  'alias ll="ls -lah --color=auto"' \
  'alias la="ls -A --color=auto"' \
  'alias l="ls -CF --color=auto"' \
  'alias gs="git status"' \
  'alias gp="git pull"' \
  'alias ..="cd .."' \
  >> /root/.bashrc

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
