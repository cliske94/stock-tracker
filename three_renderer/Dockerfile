FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund
COPY . .
EXPOSE 9092
CMD ["node", "app.js"]
