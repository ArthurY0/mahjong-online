FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /usr/src/app/data

EXPOSE 3000

# 修复：正确的入口文件路径
CMD ["node", "server/index.js"]