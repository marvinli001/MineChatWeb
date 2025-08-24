
# File Search（OpenAI 文档要点整理）

> 让模型在生成回答前，先在你上传的**向量库（vector store）**中检索相关文件内容。适合私有知识库、FAQ、技术文档、合规资料等“检索增强生成（RAG）”场景。

---

## 1) 工作原理简述
- 你先用 **Files API** 上传文件，再把文件加入 **Vector Store**。
- 在调用 **Responses API** 时，将 `file_search` 工具和 `vector_store_ids` 一起传给模型。
- 模型按需调用检索工具：语义+关键词检索 → 读取片段 → 结合上下文生成含**文件引用**的回答。

---

## 2) 快速上手（Python / JS）

### 2.1 上传文件（Files API）
**Python**
```python
import requests
from io import BytesIO
from openai import OpenAI

client = OpenAI()

def create_file(client, file_path):
    if file_path.startswith(("http://", "https://")):
        res = requests.get(file_path)
        res.raise_for_status()
        file_content = BytesIO(res.content)
        file_name = file_path.split("/")[-1]
        result = client.files.create(file=(file_name, file_content), purpose="assistants")
    else:
        with open(file_path, "rb") as fh:
            result = client.files.create(file=fh, purpose="assistants")
    return result.id

file_id = create_file(client, "https://cdn.openai.com/API/docs/deep_research_blog.pdf")
print(file_id)
```

**JavaScript**
```javascript
import fs from "fs";
import OpenAI from "openai";
const openai = new OpenAI();

async function createFile(filePath) {
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const res = await fetch(filePath);
    const buffer = await res.arrayBuffer();
    const name = filePath.split("/").pop();
    const file = new File([buffer], name);
    const r = await openai.files.create({ file, purpose: "assistants" });
    return r.id;
  } else {
    const r = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants",
    });
    return r.id;
  }
}

const fileId = await createFile("https://cdn.openai.com/API/docs/deep_research_blog.pdf");
console.log(fileId);
```

### 2.2 创建向量库（Vector Store）
**Python**
```python
vector_store = client.vector_stores.create(name="knowledge_base")
print(vector_store.id)
```

**JavaScript**
```javascript
const vectorStore = await openai.vectorStores.create({ name: "knowledge_base" });
console.log(vectorStore.id);
```

### 2.3 将文件加入向量库
**Python**
```python
client.vector_stores.files.create(
    vector_store_id=vector_store.id,
    file_id=file_id
)
```

**JavaScript**
```javascript
await openai.vectorStores.files.create(vectorStore.id, { file_id: fileId });
```

### 2.4 轮询检查处理状态（直到 `completed`）
**Python**
```python
client.vector_stores.files.list(vector_store_id=vector_store.id)
```

**JavaScript**
```javascript
await openai.vectorStores.files.list({ vector_store_id: vectorStore.id });
```

### 2.5 在 Responses API 中启用 File Search
**Python**
```python
from openai import OpenAI
client = OpenAI()

resp = client.responses.create(
    model="gpt-4.1",
    input="What is deep research by OpenAI?",
    tools=[{
        "type": "file_search",
        "vector_store_ids": ["<vector_store_id>"]
    }]
)
print(resp.output_text)
```

**JavaScript**
```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const resp = await openai.responses.create({
  model: "gpt-4.1",
  input: "What is deep research by OpenAI?",
  tools: [{ type: "file_search", vector_store_ids: ["<vector_store_id>"] }],
});
console.log(resp.output_text);
```

---

## 3) 响应结构与引用
- 输出包含：
  1) `file_search_call` —— 标记了一次检索调用（可选含 queries / results）。  
  2) `message` —— 模型回答正文；`content[0].annotations` 内会给出 **file_citation**（文件 ID、文件名、在文本中的索引位置）。
- 你可以显示这些引用，或把它们映射到“查看原文”链接。

示例（节选，JSON）
```json
{
  "output": [
    { "type": "file_search_call", "id": "fs_...", "status": "completed" },
    {
      "type": "message",
      "content": [{
        "type": "output_text",
        "text": "Deep research is ...",
        "annotations": [{
          "type": "file_citation",
          "file_id": "file_...",
          "filename": "deep_research_blog.pdf"
        }]
      }]
    }
  ]
}
```

---

## 4) 检索定制（可选）

### 4.1 限制返回条数（降低成本/时延）
**Python**
```python
client.responses.create(
  model="gpt-4.1",
  input="What is deep research by OpenAI?",
  tools=[{
    "type": "file_search",
    "vector_store_ids": ["<vector_store_id>"],
    "max_num_results": 2
  }]
)
```

**JavaScript**
```javascript
await openai.responses.create({
  model: "gpt-4.1",
  input: "What is deep research by OpenAI?",
  tools: [{ type: "file_search", vector_store_ids: ["<vector_store_id>"], max_num_results: 2 }],
});
```

### 4.2 在响应中返回检索结果列表（调试/可视化）
**Python**
```python
client.responses.create(
  model="gpt-4.1",
  input="What is deep research by OpenAI?",
  tools=[{ "type": "file_search", "vector_store_ids": ["<vector_store_id>"] }],
  include=["file_search_call.results"]
)
```

**JavaScript**
```javascript
await openai.responses.create({
  model: "gpt-4.1",
  input: "What is deep research by OpenAI?",
  tools: [{ type: "file_search", vector_store_ids: ["<vector_store_id>"] }],
  include: ["file_search_call.results"],
});
```

### 4.3 基于文件元数据过滤
> 先给向量库文件设置 metadata，然后用 `filters` 过滤（详见 Retrieval 指南）。
**Python**
```python
client.responses.create(
  model="gpt-4.1",
  input="What is deep research by OpenAI?",
  tools=[{
    "type": "file_search",
    "vector_store_ids": ["<vector_store_id>"],
    "filters": { "type": "eq", "key": "type", "value": "blog" }
  }]
)
```

**JavaScript**
```javascript
await openai.responses.create({
  model: "gpt-4.1",
  input: "What is deep research by OpenAI?",
  tools: [{
    type: "file_search",
    vector_store_ids: ["<vector_store_id>"],
    filters: { type: "eq", key: "type", value: "blog" }
  }],
});
```

---

## 5) 支持的文件类型（节选）
> 文本类需 `utf-8 / utf-16 / ascii` 编码。

| 扩展名 | MIME | 说明 |
|---|---|---|
| .txt | text/plain | 纯文本 |
| .md  | text/markdown | Markdown |
| .pdf | application/pdf | PDF 文档 |
| .doc/.docx | application/msword / application/vnd.openxmlformats-officedocument.wordprocessingml.document | Word |
| .pptx | application/vnd.openxmlformats-officedocument.presentationml.presentation | PowerPoint |
| .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | Excel（建议转 CSV） |
| .csv | text/csv / application/csv | 逗号分隔数据 |
| .json | application/json | JSON |
| .html | text/html | HTML |
| .py/.js/.ts/.java/.go/.rb/.php/.c/.cpp/.cs/.sh/.tex | 对应 text/x-* / application/x-sh 等 | 源码/脚本 |

> 需要更全列表时，参考原文档的“Supported files”。

---

## 6) 速率与用量（概览）
- **Responses / Chat / Assistants**：与所用模型的**分层限额**一致。文档给出一组示例：  
  - Tier 1：100 RPM  
  - Tier 2-3：500 RPM  
  - Tier 4-5：1000 RPM  
- 计费以模型文本 token 为主；检索本身为托管工具，不用你自己实现召回。

> 实际费率/限额以你的组织面板与最新定价为准。

---

## 7) 最佳实践 & 常见问题

**提示词与工具声明**
- 在 `tools` 中仅暴露必要的 `vector_store_ids`（按业务域拆分库，避免噪声。）。
- 系统提示里说明：遇到与知识库相关的问题**优先使用** file_search。

**文件与分片**
- 尽量提供**结构化文本**或可解析的 PDF/HTML，保证可提取正文（图片扫描建议 OCR 预处理）。
- 按主题拆分文档，减少长文件引入的无关片段；用 metadata 标记来源、日期、版本。

**答案可追溯**
- 展示 `file_citation`，并提供“在原文中查看”跳转。  
- 对外输出需标注来源，尤其在合规或学术场景。

**质量与成本平衡**
- 先用默认召回；若回答啰嗦或偏题，尝试：收紧提示词、设置 `max_num_results`、在向量库侧做更细粒度切片。  
- 如回答缺失信息，可增大知识库覆盖或放宽过滤条件，并考虑**并行检索多个 vector store**。

**调试技巧**
- 临时开启 `include=["file_search_call.results"]` 观察召回片段。  
- 逐步对比“开启/关闭过滤”“不同切片策略/向量库”的答案差异。

---

## 8) 端到端最简模板（Python）
```python
from openai import OpenAI
client = OpenAI()

# 假设已完成：文件上传 -> 向量库创建 -> 文件入库 -> 状态 completed
VECTOR_STORE_ID = "<your_vector_store_id>"

resp = client.responses.create(
    model="gpt-4.1",
    input="根据内部FAQ，解释如何申请报销，并给出条目式步骤。",
    tools=[{ "type": "file_search", "vector_store_ids": [VECTOR_STORE_ID] }]
)

print(resp.output_text)          # 最终答案
# resp.output[0] 里可找到 file_search_call（如有）；
# resp.output 中的 message.content[0].annotations 包含 file_citation 引用。
```

---

### 参考
- 原文：**File search**（OpenAI 官方文档）
- 相关：**Retrieval 指南**（元数据与过滤）、**Responses API**（含工具调用输出结构）

