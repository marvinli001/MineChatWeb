# MineChatWeb

MineChatWeb 是一个正在积极开发中的开源 AI 聊天平台。它整合了多个主流大语言模型，为用户提供聊天、语音、图片等多模态体验。项目采用 Python FastAPI 作为后端，Next.js + Tailwind CSS 作为前端。

> ⚠️ 项目目前处于早期阶段，接口和 UI 仍在不断迭代中，欢迎反馈问题或贡献代码。

## 功能亮点

- **多模型支持**：OpenAI、Anthropic、Google Gemini、DeepSeek 等主流提供商
- **推理展示**：支持 o 系列、GPT-5 等思考模型的推理过程可视化
- **语音能力**：语音转文字 & 文字转语音
- **图片能力**：图片生成与识别
- **云端记忆**：可选 Milvus 向量数据库持久化聊天历史
- **云端同步**：试验性 Cloudflare D1 同步聊天记录与设置
- **现代界面**：仿 ChatGPT 的响应式 UI，支持深色模式
- **本地配置**：所有密钥信息仅存储在浏览器
- **模型市场**：可视化选择模型，支持在线刷新模型配置

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
├── models-config.json     # 模型市场配置
└── README.md
```

## 模型市场与配置

@@ -86,26 +87,35 @@ npm run dev
6. **Moonshot（Kimi）**：https://platform.moonshot.cn/

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
```

## 未来开发计划

- 实现完整且兼容性的云同步（聊天记录、设置偏好、附加对话工具配置等）
- 解决 Thinking 模型无法展示完整思维链的问题，持续优化流式输出
- 增强 OpenAI O 系列、GPT-5 系列模型的支持与研究
- 实现上传图片/文件后自动 embedding 作为对话附件
- 支持更多附加工具：搜索、向量、图片生成等