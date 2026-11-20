# Stage 1: Build Vite production bundle
FROM node:22-alpine AS builder
WORKDIR /app/Frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend ./
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Stage 2: Serve static assets with non-root nginx
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY Frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/Frontend/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
