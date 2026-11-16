# Serves the built site; CI runs `bun run build` first, so dist/ is in the build context.
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
