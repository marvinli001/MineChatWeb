# MineChatWeb

MineChatWeb 是一个正在积极开发中的开源 AI 聊天平台。它整合了多个主流大语言模型，为用户提供现代化的聊天体验。项目采用 Python FastAPI 作为后端，Next.js + Tailwind CSS 作为前端。

> ⚠️ 项目目前处于早期阶段，接口和 UI 仍在不断迭代中，欢迎反馈问题或贡献代码。

## 功能亮点

- **多模型支持**：OpenAI、Anthropic、Google Gemini、DeepSeek 等主流提供商
- **流式对话**：WebSocket 连接与心跳保活，带来顺滑的实时输出
- **推理展示**：支持 o 系列、GPT-5 等思考模型的推理过程可视化
- **云端同步**：试验性 Cloudflare D1 同步聊天记录与设置
- **模型市场**：可视化选择模型，支持在线刷新配置
- **插件扩展**：预留插件市场入口，便于未来拓展
- **语音与图片接口（开发中）**：后端提供占位 API，功能持续完善
- **现代界面**：仿 ChatGPT 的响应式 UI，支持深色模式
- **本地配置**：所有密钥信息仅存储在浏览器

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | FastAPI · httpx · WebSocket |
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

前端内置模型市场，配置来自 `models-config.json`，也可在线刷新。当前支持的提供商包括：

1. **OpenAI**：https://platform.openai.com/
2. **Anthropic**：https://console.anthropic.com/
3. **Google Gemini**：https://aistudio.google.com/
4. **DeepSeek**：https://platform.deepseek.com/
5. **Moonshot（Kimi）**：https://platform.moonshot.cn/

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

- 实现完整且兼容性的云同步（包括聊天记录、设置偏好、额外对话工具的配置信息，自动检测对比浏览器端消息和云端备份并按聊天 ID 进行整合同步，所有 Key 的备份）
- 实现上传图片和上传文件后进行 embedding 作为文件附件功能
- 推进附加工具的具体实现：搜索、图片生成等，未来将拓展更多生产力工具
- 解决 Thinking 模型无法展示完整思维链的问题，持续优化流式输出