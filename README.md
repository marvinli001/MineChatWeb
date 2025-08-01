# MineChatWeb

一个功能强大的AI聊天应用，支持多种AI提供商，使用 Python FastAPI + Next.js 构建。

![image1](image1)

## 功能特性

- 🤖 **多AI提供商支持**: OpenAI, Anthropic, Google Gemini等
- 🧠 **思考模式**: 支持o1, Claude, Gemini的推理过程显示
- 🎙️ **语音功能**: 语音转文字、文字转语音
- 🖼️ **图片处理**: 图片生成和识别
- ☁️ **云同步**: 支持Milvus向量数据库存储聊天历史
- 🎨 **现代UI**: 仿OpenAI ChatGPT界面设计
- 📱 **响应式设计**: 支持桌面和移动设备
- 🔒 **隐私保护**: 配置保存在本地浏览器

## 技术栈

### 后端
- **FastAPI**: 现代Python Web框架
- **SQLAlchemy**: 数据库ORM
- **Redis**: 缓存和会话存储
- **Milvus**: 向量数据库
- **WebSocket**: 实时通信

### 前端
- **Next.js 14**: React框架
- **TypeScript**: 类型安全
- **Tailwind CSS**: 样式框架
- **Zustand**: 状态管理
- **React Markdown**: Markdown渲染

## 快速开始

### 使用Docker Compose (推荐)

```bash
# 克隆项目
git clone <your-repo-url>
cd chatgpt-clone

# 启动所有服务
docker-compose up -d

# 访问应用
# 前端: http://localhost:3000
# 后端API: http://localhost:8000
```

### 手动安装

#### 后端设置

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 运行开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 运行开发服务器
npm run dev
```

## 配置说明

### API密钥配置

在应用的设置页面中配置以下API密钥：

1. **OpenAI API Key**
   - 获取地址: https://platform.openai.com/api-keys
   - 支持模型: GPT-4o, GPT-4-turbo, o1-preview等

2. **Anthropic API Key**
   - 获取地址: https://console.anthropic.com/
   - 支持模型: Claude-3.5-sonnet, Claude-3-opus等

3. **Google API Key**
   - 获取地址: https://aistudio.google.com/app/apikey
   - 支持模型: Gemini-2.0-flash, Gemini-1.5-pro等

### Milvus向量数据库配置

支持两种部署方式：

1. **自部署Milvus**
   ```bash
   # 使用docker-compose启动Milvus
   docker-compose up milvus etcd minio
   ```

2. **Zilliz Cloud**
   - 注册地址: https://zilliz.com/
   - 获取连接信息后在设置中配置

## API文档

启动后端服务后，访问以下地址查看API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 主要API端点

### 聊天相关
- `POST /api/v1/chat/completion` - 聊天完成
- `WebSocket /api/v1/chat/stream` - 流式聊天
- `GET /api/v1/chat/providers` - 获取支持的AI提供商
- `GET /api/v1/chat/models/{provider}` - 获取模型列表

### 语音相关
- `POST /api/v1/voice/transcribe` - 语音转文字
- `POST /api/v1/voice/synthesize` - 文字转语音
- `GET /api/v1/voice/voices/{provider}` - 获取语音列表

### 用户认证
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/logout` - 用户登出

## 环境变量

### 后端环境变量

```bash
# 数据库
DATABASE_URL=sqlite:///./data/chat.db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Milvus
MILVUS_HOST=localhost
MILVUS_PORT=19530
```

### 前端环境变量

```bash
# API地址
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 部署

### 生产部署

1. **构建前端**
   ```bash
   cd frontend
   npm run build
   ```

2. **构建后端Docker镜像**
   ```bash
   cd backend
   docker build -t chatgpt-clone-backend .
   ```

3. **使用docker-compose部署**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### 环境要求

- **Node.js**: >= 18.0.0
- **Python**: >= 3.9
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目基于 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 支持

如果您觉得这个项目有用，请给它一个⭐️！

## 更新日志

### v1.0.0 (2024-12-XX)
- 初始版本发布
- 支持OpenAI, Anthropic, Google Gemini
- 实现思考模式
- 添加语音功能
- 集成Milvus向量数据库
