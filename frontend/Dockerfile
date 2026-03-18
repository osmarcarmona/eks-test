# Stage 1: Build
FROM --platform=linux/amd64 node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM --platform=linux/amd64 nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
