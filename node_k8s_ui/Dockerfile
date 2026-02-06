FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --production
COPY . .
EXPOSE 8088
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD wget -q -O- http://localhost:8088/health || exit 1
CMD ["node", "app.js"]
