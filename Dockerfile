FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 make g++ fontconfig && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY . .
RUN npm run build
