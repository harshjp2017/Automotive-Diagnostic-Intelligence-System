FROM node:20-slim

WORKDIR /app

# Install npm dependencies with legacy peer deps
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy full application code
COPY . .

# Build production bundle inside the container
RUN npm run build

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
