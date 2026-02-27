FROM node:18-alpine

WORKDIR /usr/src/app

# 安装依赖（仅生产依赖）
COPY package*.json ./
RUN npm ci --omit=dev

# 复制应用源码
COPY . .

# 创建数据目录
RUN mkdir -p /usr/src/app/data

# 以非 root 用户运行，提升安全性
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/src/app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server/index.js"]
