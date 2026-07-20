FROM node:22-alpine AS build
WORKDIR /app
# Same-origin relative URL so browser sends cookies to nginx → api proxy
ARG PUBLIC_API_URL=/api/v1
ARG PUBLIC_TURNSTILE_SITE_KEY=
ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_TURNSTILE_SITE_KEY=$PUBLIC_TURNSTILE_SITE_KEY
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
