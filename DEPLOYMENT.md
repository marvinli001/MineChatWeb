# MineChatWeb 部署教程

本文档提供了 MineChatWeb 的多种部署方案，您可以根据自己的需求选择合适的部署方式。

## 目录

- [Docker Compose 部署（推荐）](#docker-compose-部署推荐)
- [Vercel + Railway 部署](#vercel--railway-部署)
- [环境变量配置](#环境变量配置)
- [常见问题](#常见问题)

---

## Docker Compose 部署（推荐）

Docker Compose 是最简单的一键部署方案，适合快速搭建和本地开发。

### 前置要求

- Docker 20.10 或更高版本
- Docker Compose 2.0 或更高版本
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

### 部署步骤

#### 1. 克隆项目

```bash
git clone https://github.com/your-username/MineChatWeb.git
cd MineChatWeb
```

#### 2. 直接启动（无需配置）

项目已包含完整的 Docker 配置文件,无需额外配置即可启动。

#### 3. 启动所有服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 4. 访问应用

- **前端**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs

#### 5. 停止服务

```bash
# 停止所有服务
docker-compose down
```

### Docker 配置文件说明

项目已包含以下 Dockerfile:

#### frontend/Dockerfile（前端）

```dockerfile
FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

#### backend/Dockerfile（后端）

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    libffi-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 升级 pip 并安装 Python 依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建必要的目录
RUN mkdir -p /app/uploads /app/logs

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```


### 生产环境优化

对于生产环境部署，建议修改 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
      - NODE_ENV=production
    restart: unless-stopped
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    restart: unless-stopped

  # 可选：添加 Nginx 反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
```

---

## Vercel + Railway 部署

这是一种分离部署方案：前端部署在 Vercel，后端部署在 Railway。适合需要自动化部署和扩展的场景。

### 方案优势

- ✅ 自动化 CI/CD 部署
- ✅ 全球 CDN 加速（Vercel）
- ✅ 零配置 HTTPS
- ✅ 免费额度充足
- ✅ 自动扩展

### 部署步骤

#### 第一步：Fork 仓库

1. 访问项目仓库：https://github.com/your-username/MineChatWeb
2. 点击右上角的 `Fork` 按钮
3. 将项目 Fork 到你的 GitHub 账户

#### 第二步：部署后端到 Railway

1. **访问 Railway**
   - 打开 [Railway.app](https://railway.app/)
   - 使用 GitHub 账户登录

2. **创建新项目**
   - 点击 `New Project`
   - 选择 `Deploy from GitHub repo`
   - 选择你 Fork 的 `MineChatWeb` 仓库

3. **配置后端服务**
   - Railway 会自动检测到项目
   - 在项目设置中，设置 `Root Directory` 为 `backend`
   - Railway 会自动识别 Python 项目并安装依赖

4. **部署完成**
   - Railway 会自动部署并提供一个域名，如: `https://your-app.railway.app`
   - 记录这个后端 URL，稍后配置前端时需要用到

#### 第三步：部署前端到 Vercel

1. **访问 Vercel**
   - 打开 [Vercel.com](https://vercel.com/)
   - 使用 GitHub 账户登录

2. **导入项目**
   - 点击 `Add New...` → `Project`
   - 选择你 Fork 的 `MineChatWeb` 仓库
   - 点击 `Import`

3. **配置前端路径**

   在项目配置页面：
   - **Framework Preset**: Next.js
   - **Root Directory**: 点击 `Edit` → 选择 `frontend`
   - **Build Command**: `npm run build` (自动识别)
   - **Output Directory**: `.next` (自动识别)

4. **配置环境变量**

   在 `Environment Variables` 部分添加:

   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-app.railway.app
   NEXT_PUBLIC_API_BASE_URL=https://your-app.railway.app
   ```

   > 将 `https://your-app.railway.app` 替换为你在第二步中获得的 Railway 后端 URL

5. **部署项目**
   - 点击 `Deploy`
   - Vercel 会自动构建和部署前端
   - 部署完成后会得到一个域名，如: `https://your-app.vercel.app`

6. **配置自定义域名（可选）**
   - 在 Vercel 项目设置中，点击 `Domains`
   - 添加你的自定义域名并按照提示配置 DNS

#### 第四步：验证部署

1. 访问你的 Vercel 前端域名
2. 检查是否能正常访问聊天界面
3. 测试发送消息，验证前后端连接是否正常

### 更新部署

这种部署方式支持自动化更新：

1. **前端更新**
   - 推送代码到 GitHub 的 `main` 分支
   - Vercel 会自动检测并重新部署

2. **后端更新**
   - 推送代码到 GitHub 的 `main` 分支
   - Railway 会自动检测并重新部署

---

## 环境变量配置

### 前端环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NEXT_PUBLIC_BACKEND_URL` | 后端 API 地址 | `http://localhost:8000` |
| `NEXT_PUBLIC_API_BASE_URL` | 备用 API 地址 | `http://localhost:8000` |

### 后端环境变量

后端无需配置任何环境变量，Railway 会自动处理端口分配。

---

## 常见问题

### 1. Docker 部署时前端无法连接后端

**问题**: 前端显示网络错误，无法连接 API

**解决方案**:
- 检查 `NEXT_PUBLIC_API_URL` 是否设置正确
- 在浏览器中访问 `http://localhost:8000/docs` 确认后端是否正常运行
- 检查 Docker 网络配置: `docker-compose logs backend`

### 2. Railway 部署后端失败

**问题**: Railway 显示构建失败或启动失败

**解决方案**:
- 确保 `Root Directory` 设置为 `backend`
- 检查 `requirements.txt` 是否完整
- 查看 Railway 部署日志找到具体错误

### 3. Vercel 部署前端后页面空白

**问题**: Vercel 部署成功但访问时页面空白

**解决方案**:
- 检查 Vercel 部署日志是否有构建错误
- 确认 `Root Directory` 设置为 `frontend`
- 检查环境变量 `NEXT_PUBLIC_BACKEND_URL` 是否正确
- 在浏览器控制台查看是否有 CORS 错误

### 4. API 请求 CORS 错误

**问题**: 浏览器控制台显示 CORS 跨域错误

**解决方案**:
- 确认后端已正确配置 CORS（项目已默认配置）
- 检查前端环境变量 `NEXT_PUBLIC_BACKEND_URL` 是否正确
- Vercel 部署时确保域名配置正确

### 5. 如何查看日志

**Docker Compose**:
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Railway**:
- 在 Railway 项目页面查看实时日志

**Vercel**:
- 在 Vercel 项目页面的 Deployments → 选择部署 → 查看日志

### 6. 如何更新到最新版本

**Docker Compose**:
```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Vercel + Railway**:
- 在 GitHub 仓库中同步上游更新
- Vercel 和 Railway 会自动重新部署

---

## 性能优化建议

### Docker Compose 部署

1. **使用 Nginx 反向代理**
   - 添加 Nginx 服务统一处理前后端请求
   - 启用 gzip 压缩和静态资源缓存
   - 配置 SSL/TLS 证书实现 HTTPS

2. **资源限制**（可选）
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 512M
     frontend:
       deploy:
         resources:
           limits:
             cpus: '0.5'
             memory: 256M
   ```

3. **日志轮转**
   - 配置 Docker 日志驱动避免日志文件过大
   - 使用 `docker-compose logs --tail=100` 查看最近日志

### Vercel + Railway 部署

1. **CDN 配置**
   - Vercel 自动提供全球 CDN，无需额外配置

2. **Railway 优化**
   - 根据流量调整 Railway 实例规格
   - 启用自动休眠节省成本（开发环境）

3. **环境隔离**
   - 创建 `development` 和 `production` 分支
   - 配置不同的部署环境和环境变量

---

## 技术支持

如遇到部署问题，请：

1. 查看项目 [Issues](https://github.com/your-username/MineChatWeb/issues)
2. 提交新 Issue 并附上详细日志
3. 加入社区讨论获取帮助

---

**最后更新**: 2025-10-09
