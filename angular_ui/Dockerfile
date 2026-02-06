FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD wget -q -O- http://localhost/ || exit 1
