# MineChatWeb

MineChatWeb 是一个正在积极开发中的开源 AI 聊天平台。它整合了多个主流大语言模型，为用户提供聊天、语音、图片等多模态体验。项目采用 Python FastAPI 作为后端，Next.js + Tailwind CSS 作为前端。

> ⚠️ 项目目前处于早期阶段，接口和 UI 仍在不断迭代中，欢迎反馈问题或贡献代码。

## 功能亮点

- **多模型支持**：OpenAI、Anthropic、Google Gemini 等主流提供商
- **推理展示**：o1、Claude、Gemini 等模型的思考过程可视化
- **语音能力**：语音转文字 & 文字转语音
- **图片能力**：图片生成与识别
- **云端记忆**：可选 Milvus 向量数据库持久化聊天历史
- **现代界面**：仿 ChatGPT 的响应式 UI，支持深色模式
- **本地配置**：所有密钥信息仅存储在浏览器

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | FastAPI · SQLAlchemy · Redis · Milvus · WebSocket |
| 前端 | Next.js 14 · TypeScript · Tailwind CSS · Zustand · React Markdown |
| 其他 | Docker Compose · Node.js 18+ · Python 3.9+ |

## 目录结构

```
.
├── backend/               # FastAPI 服务
├── frontend/              # Next.js 前端
├── docker-compose.yml     # 一键启动
├── models-config.json     # 模型配置示例
└── README.md
```

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
git clone <your-repo-url>
cd MineChatWeb
docker-compose up -d

# 前端: http://localhost:3000
# 后端: http://localhost:8000
```

### 方式二：手动启动

#### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端

```bash
cd frontend
npm install
npm run dev
```

## 配置

在前端设置页面或 `.env` 文件中配置以下内容：

### API 密钥

1. **OpenAI**：https://platform.openai.com/api-keys  
2. **Anthropic**：https://console.anthropic.com/  
3. **Google**：https://aistudio.google.com/app/apikey  

### Milvus（可选）

可自行部署 Milvus 或使用 Zilliz Cloud：

```bash
docker-compose up milvus etcd minio   # 本地部署
```

## API 文档

后端启动后访问：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 环境变量示例

`backend/.env`:

```env
DATABASE_URL=sqlite:///./data/chat.db
REDIS_URL=redis://localhost:6379
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
MILVUS_HOST=localhost
MILVUS_PORT=19530
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 部署

1. 构建前端：

```bash
cd frontend
npm run build
```

2. 构建后端镜像：

```bash
cd backend
docker build -t minechat-backend .
```

3. 启动生产环境：

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 贡献

欢迎 Issue 和 PR！

1. Fork 项目
2. 新建分支：`git checkout -b feature/xxx`
3. 提交代码：`git commit -m "feat: xxx"`
4. 推送分支并发起 PR

## 许可证

MIT，详见 [LICENSE](LICENSE)。

---

如果这个项目对你有帮助，请点个 ⭐️ 支持！
