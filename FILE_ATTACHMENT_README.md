# 文件附带消息功能说明

## 概述

MineChatWeb 现已支持完整的文件附带消息功能，基于 OpenAI 的三种文件处理方式实现：
- **直读模式** (Direct Reading)
- **Code Interpreter 模式** (代码解释器)
- **File Search 模式** (文件搜索/向量库)

## 功能特性

### 🚀 智能文件处理
- **自动模式识别**：根据文件类型自动选择最佳处理方式
- **多种格式支持**：PDF、Word、Excel、代码文件、压缩包等
- **实时进度显示**：带有加载动画的视觉反馈

### 📁 支持的文件类型

#### 文档类（默认直读模式）
- `.pdf` - PDF 文档
- `.doc/.docx` - Word 文档  
- `.ppt/.pptx` - PowerPoint 演示文稿
- `.txt/.md` - 文本和 Markdown 文件

#### 数据类（自动切换到 Code Interpreter）
- `.csv/.xlsx/.xls` - 表格文件
- `.json/.xml/.yaml` - 数据交换格式
- `.zip/.rar/.7z/.tar/.gz` - 压缩文件

#### 代码类（自动切换到 Code Interpreter）
- `.py/.js/.ts/.java/.cpp/.c` - 编程语言文件
- `.html/.css/.php/.sql` - Web 和数据库文件

## 三种处理模式详解

### 1. 直读模式 (Direct)
- **适用场景**：文档阅读、内容总结、文本翻译
- **工作原理**：文件直接作为 `input_file` 传入对话
- **特点**：低延迟、低成本、适合临时文本处理任务

### 2. Code Interpreter 模式
- **适用场景**：数据分析、代码执行、文件转换、图表生成
- **工作原理**：在安全容器内运行代码，支持文件上传和处理
- **特点**：支持运算、可生成新文件、支持复杂数据处理
- **生成文件**：处理后的文件可直接下载

### 3. File Search 模式
- **适用场景**：多文档检索、知识库查询、语义搜索
- **工作原理**：创建向量数据库，支持相似度检索
- **特点**：适合大量文档的反复查询，智能检索相关内容

## 使用方法

### 前端操作
1. **拖拽上传**：直接将文件拖拽到聊天输入框
2. **点击上传**：点击附件按钮选择文件
3. **实时反馈**：查看文件处理状态和进度
4. **发送消息**：等待文件处理完成后发送

### API 调用

#### 文件处理 API
```http
POST /api/v1/file/process
Content-Type: multipart/form-data

file: [文件内容]
process_mode: [可选，直接指定模式]
vector_store_id: [可选，File Search 模式的向量库 ID]
api_key: [OpenAI API 密钥]
```

#### 聊天 API（含文件）
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "请分析这个文件",
      "files": [
        {
          "filename": "data.csv",
          "type": "text/csv",
          "size": 1024,
          "process_mode": "code_interpreter",
          "openai_file_id": "file-xxx",
          "status": "completed"
        }
      ]
    }
  ],
  "api_key": "sk-xxx"
}
```

## 技术实现

### 前端组件
- **InputArea.tsx**：文件上传界面和状态管理
- **MessageItem.tsx**：消息显示和文件下载
- **fileUtils.ts**：文件处理工具函数

### 后端服务
- **file.py**：文件处理路由和 OpenAI 集成
- **ai_providers.py**：AI 服务提供商适配
- **chat.py**：聊天消息处理

### 数据流程
```
用户上传文件 → 前端验证 → 发送到后端 → OpenAI Files API 
→ 根据模式配置工具 → 聊天 API 调用 → 返回结果 → 前端显示
```

## 配置要求

### 环境变量
```bash
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # 后端地址
```

### 依赖包
```bash
# Python 后端
pip install openai fastapi python-multipart

# Node.js 前端
npm install @heroicons/react react-hot-toast zustand
```

## 限制说明

### 文件大小限制
- **最大文件大小**：100MB
- **图片文件**：15MB（已有功能）

### 支持的 OpenAI 模型
- GPT-4 系列：完全支持所有模式
- GPT-3.5：支持直读和部分工具功能
- GPT-5 系列：完全支持，包括推理模式

### 注意事项
- 文件在聊天记录中只保存文件名和 ID，实际内容存储在 OpenAI
- 文件有时效性，不会永久保存
- Code Interpreter 容器会在 20 分钟后过期
- Vector Store 需要手动管理生命周期

## 故障排除

### 常见问题
1. **文件上传失败**：检查文件大小和格式是否支持
2. **处理超时**：大文件处理可能需要更长时间
3. **API 调用失败**：检查 OpenAI API 密钥和余额
4. **下载失败**：检查文件 ID 是否有效

### 调试方法
- 查看浏览器控制台日志
- 检查后端日志输出
- 验证 API 密钥权限
- 确认 OpenAI 服务状态

## 未来规划

### 即将支持
- [ ] 更多文件格式（PPT、音频、视频）
- [ ] 批量文件处理
- [ ] 文件预览功能
- [ ] 自定义向量库管理

### 长期规划
- [ ] 本地文件存储选项
- [ ] 文件版本控制
- [ ] 协作功能
- [ ] 多语言文档处理

## 联系方式

如有问题或建议，请在项目 GitHub 页面提交 Issue。

---

*该文档随代码更新，最后更新时间：2025-01*