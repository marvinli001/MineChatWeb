# MineChatWeb

MineChatWeb 是一个开源 AI 聊天平台，整合多个主流大语言模型，提供现代化的对话体验。项目采用 Python FastAPI 后端和 Next.js + TypeScript 前端架构。

> ⚠️ 项目目前处于早期阶段，接口和 UI 仍在不断迭代中，欢迎反馈问题或贡献代码。

## 核心功能

- **多模型支持**：OpenAI、Anthropic、Google Gemini、DeepSeek、Moonshot 等主流 AI 提供商
- **流式对话**：WebSocket 实时通信，支持心跳保活机制
- **推理可视化**：支持 GPT-5、o 系列等思考模型的推理过程展示
- **文件处理**：支持文档、代码、数据文件的上传与分析，提供直读、Code Interpreter、File Search 三种处理模式
- **图像识别**：支持多图上传，兼容 OpenAI 和 Anthropic 视觉模型
- **语音转录**：基于 Whisper 和 GPT-4o 的语音转文字功能
- **深度研究**：集成 Web 搜索和工具调用的深度研究任务系统
- **模型市场**：可视化模型选择界面，支持在线刷新配置
- **插件系统**：Function Calling 和 MCP 服务器支持
- **现代界面**：响应式 UI，支持深色模式，适配移动端
- **本地存储**：所有密钥和配置仅保存在浏览器本地

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

## 支持的 AI 提供商

前端内置模型市场，配置基于 `models-config.json`，支持在线刷新。已集成以下提供商：

- **OpenAI**：GPT-4、GPT-5、o 系列等模型
- **Anthropic**：Claude 3.5 Sonnet、Claude 3 Opus 等
- **Google Gemini**：Gemini 2.0 Flash、Gemini Pro 等
- **DeepSeek**：DeepSeek V3 等
- **Moonshot（Kimi）**：Moonshot 系列模型

## 主要技术实现

### 文件处理系统
支持 PDF、Word、Excel、代码文件、压缩包等多种格式，提供三种处理模式：
- 直读模式：适用于文档阅读、内容总结
- Code Interpreter：适用于数据分析、代码执行
- File Search：适用于多文档检索、知识库查询

### 深度研究功能
集成 OpenAI Responses API，支持：
- Web 搜索工具调用
- 文件上传与向量库检索
- 多轮工具调用与推理
- 任务状态实时更新

### 图像与语音
- 图像：支持 JPG、PNG、WebP、GIF 格式，兼容 OpenAI base64 和 Anthropic Files API
- 语音：支持 Whisper-1、GPT-4o Transcribe 等转录模型

## API 文档

后端启动后访问以下地址查看完整 API 文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

主要 API 端点：
- `/api/v1/chat` - 聊天对话（REST 和 WebSocket）
- `/api/v1/file` - 文件处理
- `/api/v1/image` - 图像上传
- `/api/v1/voice` - 语音转录
- `/api/v1/deep_research` - 深度研究任务