# Build
FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_RECAPTCHA_SITE_KEY
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY
ARG VITE_WELLOUS_API_BASE_URL
ENV VITE_WELLOUS_API_BASE_URL=$VITE_WELLOUS_API_BASE_URL
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Serve with nginx (SPA fallback: semua path → index.html)
FROM nginx:alpine
RUN apk add --no-cache bash
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
