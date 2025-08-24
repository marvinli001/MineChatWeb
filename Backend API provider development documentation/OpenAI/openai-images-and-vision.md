<!-- File: openai-images-and-vision.md -->
# Images and vision

**Source:** https://platform.openai.com/docs/guides/images-vision

本文为*Images and vision*页面的**纯净 Markdown**版：移除侧栏/杂项，只保留与开发相关的核心说明与示例。

---

## Overview

- **Create images**：使用 *GPT Image* 或 *DALL·E* 生成/编辑图像（详见：/docs/guides/image-generation）。  
- **Process image inputs**：使用视觉能力（vision）分析图像（详见下文“Analyze images”）。

支持多种 API：

| API | 支持的用例 |
|---|---|
| **Responses API** | 将图像作为输入分析，或生成图像作为输出 |
| **Images API** | 仅生成图像（可选：以图生图/编辑） |
| **Chat Completions API** | 将图像作为输入，生成文本或音频 |

> 输入/输出模态与可用模型请参考 *Models* 页面。

---

## Generate or edit images

你可以用 **Images API** 或 **Responses API** 生成/编辑图像。

- **gpt-image-1**：原生多模态大模型，理解文本与图像，具备更强的指令跟随与上下文感知。  
- **DALL·E 2/3**：专用图像生成模型，不具备与 GPT Image 相同的世界知识与理解力。

### 使用 Responses 生成图像

#### JavaScript
```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  input: "Generate an image of gray tabby cat hugging an otter with an orange scarf",
  tools: [{ type: "image_generation" }],
});

// 保存图片到文件
const imageData = response.output
  .filter((output) => output.type === "image_generation_call")
  .map((output) => output.result);

if (imageData.length > 0) {
  const imageBase64 = imageData[0];
  const fs = await import("fs");
  fs.writeFileSync("cat_and_otter.png", Buffer.from(imageBase64, "base64"));
}
```

#### Python
```python
from openai import OpenAI
import base64

client = OpenAI()

response = client.responses.create(
    model="gpt-4.1-mini",
    input="Generate an image of gray tabby cat hugging an otter with an orange scarf",
    tools=[{"type": "image_generation"}],
)

# 保存图片到文件
image_data = [
    output.result
    for output in response.output
    if output.type == "image_generation_call"
]

if image_data:
    image_base64 = image_data[0]
    with open("cat_and_otter.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
```

> 更多图像生成功能与细节：/docs/guides/image-generation

**关于“世界知识”与图像质量**：原生多模态的 GPT Image 能基于现实世界知识生成更贴合语义的细节（例如能自发选择常见半宝石并逼真呈现），与传统纯扩散模型不同。

---

## Analyze images

**Vision** 表示模型能“看见并理解”图像（包含图中文字）。它可以识别**对象、形状、颜色、材质**等，但仍存在一定局限（见下文“Limitations”）。

### 提供图像作为输入的方式

- 通过**图像 URL**（完全限定的可访问 URL）  
- 通过**Base64 data URL**（`data:image/...;base64,...`）  
- 通过**文件 ID**（先用 Files API 上传，再引用 `file_id`）  

单个请求可在 `content` 中提供**多张图**，但注意图片也会计入**tokens**并产生相应计费。

#### A. 传入 URL

##### JavaScript
```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: "what's in this image?" },
      {
        type: "input_image",
        image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
      },
    ],
  }],
});

console.log(response.output_text);
```

##### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1-mini",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_text", "text": "what's in this image?"},
            {
                "type": "input_image",
                "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
            },
        ],
    }],
)

print(response.output_text)
```

##### cURL
```bash
curl https://api.openai.com/v1/responses   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-4.1-mini",
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_text", "text": "what is in this image?"},
          {
            "type": "input_image",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
          }
        ]
      }
    ]
  }'
```

#### B. 传入 Base64

##### JavaScript
```javascript
import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI();
const imagePath = "path_to_your_image.jpg";
const base64Image = fs.readFileSync(imagePath, "base64");

const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: "what's in this image?" },
      { type: "input_image", image_url: `data:image/jpeg;base64,${base64Image}` },
    ],
  }],
});

console.log(response.output_text);
```

##### Python
```python
import base64
from openai import OpenAI

client = OpenAI()

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

image_path = "path_to_your_image.jpg"
base64_image = encode_image(image_path)

response = client.responses.create(
    model="gpt-4.1",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_text", "text": "what's in this image?"},
            {"type": "input_image", "image_url": f"data:image/jpeg;base64,{base64_image}"}
        ],
    }],
)

print(response.output_text)
```

#### C. 传入文件 ID

##### JavaScript
```javascript
import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI();

async function createFile(filePath) {
  const fileContent = fs.createReadStream(filePath);
  const result = await openai.files.create({ file: fileContent, purpose: "vision" });
  return result.id;
}

const fileId = await createFile("path_to_your_image.jpg");

const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: "what's in this image?" },
      { type: "input_image", file_id: fileId },
    ],
  }],
});

console.log(response.output_text);
```

##### Python
```python
from openai import OpenAI
client = OpenAI()

def create_file(file_path):
    with open(file_path, "rb") as file_content:
        result = client.files.create(file=file_content, purpose="vision")
        return result.id

file_id = create_file("path_to_your_image.jpg")

response = client.responses.create(
    model="gpt-4.1-mini",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_text", "text": "what's in this image?"},
            {"type": "input_image", "file_id": file_id},
        ],
    }],
)

print(response.output_text)
```

---

## Image input requirements

**文件类型**：PNG（.png）、JPEG（.jpeg/.jpg）、WEBP（.webp）、非动图 GIF（.gif）  
**单次请求大小**：总载荷 ≤ 50 MB；单次最多 500 张图像输入  
**其它要求**：无水印/Logo、无 NSFW 内容、清晰到**人类**可理解

---

## 指定图像细节等级（detail）

通过 `detail` 参数控制视觉理解的细节级别：`"low" | "high" | "auto"`（默认 `auto`）。

```json
{
  "type": "input_image",
  "image_url": "https://.../image.jpg",
  "detail": "high"
}
```

- `"low"`：可**显著节省 tokens** 与时延（预算约 85 tokens，内部以 512×512 低分辨率进行处理），适合需求不高的场景（如询问主色/主形状）。  
- `"high"`：用于需要细节理解的场景。  
- 具体成本计算见下文“Calculating costs”。

---

## Limitations（已知限制）

- **医疗影像**：不适用于诊断场景（如 CT），不得作为医疗建议。  
- **非拉丁文字**：含非拉丁字符（如日文/韩文）的文本理解可能不理想。  
- **小字号文本**：尽量放大，但避免裁掉关键信息。  
- **旋转图像**：倒置/旋转文本/图像可能被误判。  
- **图表/样式**：多色/虚线/点线等复杂视觉编码可能不稳定。  
- **空间推理**：对棋局等高精度空间定位任务较弱。  
- **准确性**：在某些场景会给出错误描述/标注。  
- **图像形状**：全景/鱼眼等畸变画面理解较差。  
- **元数据**：不读取原文件名/EXIF 等；图像会被缩放，影响原始尺寸。  
- **计数**：对目标数量可能只给近似值。  
- **CAPTCHA**：为安全原因被屏蔽。  

---

## Calculating costs（计算费用）

图像输入像文本一样按 **tokens** 计费；不同模型的折算方式不同。

### A) gpt-4.1-mini / gpt-4.1-nano / o4-mini（以及 gpt-5-mini / gpt-5-nano）

1) 以 32×32 **patch** 覆盖整张图片：  
`raw_patches = ceil(width/32) × ceil(height/32)`  
2) 若 `raw_patches > 1536`，按比例缩放至不超过 1536 个 patch；保持长宽比：  
`r = sqrt(32^2 × 1536 / (width × height))` 并对齐到 32 的整数倍网格  
3) 计算最终 patch 数（即 tokens，最多 1536）：  
`image_tokens = ceil(resized_width/32) × ceil(resized_height/32)`  
4) 乘以**模型系数**得到总 tokens：

| Model | Multiplier |
|---|---|
| gpt-5-mini | 1.62 |
| gpt-5-nano | 2.46 |
| gpt-4.1-mini | 1.62 |
| gpt-4.1-nano | 2.46 |
| o4-mini | 1.72 |

**示例**：  
- 1024×1024 → 32×32 patch = **1024 tokens**（低于 1536，无需缩放）  
- 1800×2400：原始 57×75=4275（超 1536）→ 按预算等比缩放并网格对齐 → **1452 tokens**  

### B) GPT‑4o / GPT‑4.1 / GPT‑4o‑mini / CUA / o‑series（除 o4‑mini）

费用由**尺寸**与**细节**共同决定：

- `detail: "low"`：**固定基础 tokens**（不同模型不同）。  
- `detail: "high"`：步骤：① 缩放至不超过 2048×2048；② 将短边缩放到 768px；③ 计算 512px **tile** 个数，每个 tile 有固定 tokens；④ 加上基础 tokens。

| Model | Base tokens | Tile tokens |
|---|---:|---:|
| gpt-5 / gpt-5-chat-latest | 70 | 140 |
| 4o / 4.1 / 4.5 | 85 | 170 |
| 4o-mini | 2833 | 5667 |
| o1 / o1-pro / o3 | 75 | 150 |
| computer-use-preview | 65 | 129 |

**示例（gpt‑4o）**：  
- 1024×1024（high）：缩至 768×768 → 512px tiles = 4 → `170×4 + 85 = 765` tokens  
- 2048×4096（high）：缩至 768×1536 → tiles = 6 → `170×6 + 85 = 1105` tokens  
- 任意尺寸（low）：固定 **85** tokens  

### C) GPT Image 1（gpt‑image‑1）

与上一节类似，但**短边**缩放到 **512px**。并依据输入保真度（input fidelity）额外计费：

- **low**：基础 **65** image tokens；每个 tile **129** image tokens  
- **high**：在上述基础上，按**长宽比**加固定额外 tokens：  
  - **正方形**：+ **4096**  
  - **近似横/竖幅**：+ **6144**  

> 计价以“图像 tokens”为单位，并计入 TPM（tokens per minute）限额。最准确/最新的估算以官方定价页面与计算器为准。

---

*本页为你提供的原始文本内容的 Markdown 化与结构化整理版本，方便直接纳入文档仓库。*
