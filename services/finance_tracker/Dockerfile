FROM node:18-slim
WORKDIR /usr/src/app

# set sensible defaults; override at runtime with `-e FRONTEND_ORIGIN=...`
ENV NODE_ENV=production
ENV FRONTEND_ORIGIN=http://localhost:4000

COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# copy app sources including public/wasm so built image serves wasm
COPY . .

EXPOSE 4000
CMD ["node","app.js"]
