
# OpenAI API — Image Generation (Tool) Summary

This page summarizes how to generate and iteratively edit images using the **image_generation** tool in the OpenAI API (as described in the provided docs).

---

## Overview

The **image_generation** tool lets a model (e.g., `gpt-5`, `gpt-4.1`, `gpt-4o`) create or edit images from a text prompt, optionally with image inputs. Under the hood it uses **`gpt-image-1`** to produce the image, while your chosen **mainline model** handles the conversation and decides when to call the image tool.

- Supports single‑turn generation and **multi‑turn editing** (e.g., “make it look realistic” using the previous image).
- Returns a **base64‑encoded image** in the tool call result.
- You can **force** an image tool call via `tool_choice: {"type":"image_generation"}`.
- For streaming, partial images (1–3) can be emitted before the final image for faster visual feedback.

---

## Quick Start — Generate an Image

### JavaScript
```js
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-5",
  input: "Generate an image of gray tabby cat hugging an otter with an orange scarf",
  tools: [{ type: "image_generation" }],
});

// Save the image to a file
const imageData = response.output
  .filter((o) => o.type === "image_generation_call")
  .map((o) => o.result);

if (imageData.length > 0) {
  const imageBase64 = imageData[0];
  const fs = await import("fs");
  fs.writeFileSync("otter.png", Buffer.from(imageBase64, "base64"));
}
```

### Python
```python
from openai import OpenAI
import base64

client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    input="Generate an image of gray tabby cat hugging an otter with an orange scarf",
    tools=[{"type": "image_generation"}],
)

image_data = [
    o.result for o in response.output
    if o.type == "image_generation_call"
]

if image_data:
    image_base64 = image_data[0]
    with open("otter.png", "wb") as f:
        f.write(base64.b64decode(image_base64))
```

> **Tip:** You can also pass input images via **file IDs** or **base64**. The model automatically optimizes prompts (“revised prompts”) for better image quality.

---

## Tool Options

You can set these options on the `image_generation` tool call:

| Option       | Description                                                                                  |
|--------------|----------------------------------------------------------------------------------------------|
| `size`       | Image dimensions (e.g., `1024x1024`, `1024x1536`).                                           |
| `quality`    | Rendering quality: `low`, `medium`, `high`.                                                  |
| `format`     | Output file format (e.g., PNG, JPEG, WebP).                                                  |
| `compression`| Compression level (0–100%) for JPEG/WebP.                                                    |
| `background` | `transparent` or `opaque`.                                                                   |

- `size`, `quality`, and `background` support **`auto`** so the model can choose the best setting.
- See the full Image Generation guide for additional options and details.

---

## Revised Prompt

When the tool runs, the model may **revise your text prompt** to improve results. The revised prompt is available on the tool call:

```json
{
  "id": "ig_123",
  "type": "image_generation_call",
  "status": "completed",
  "revised_prompt": "A gray tabby cat hugging an otter. The otter is wearing an orange scarf. Both animals are cute and friendly, depicted in a warm, heartwarming style.",
  "result": "..."
}
```

---

## Prompting Tips

- Prefer verbs like **“draw”** or **“edit”**.
- For combining images, phrase it as **“edit the first image by adding…”** rather than “merge/compose.”
- Iterate in small steps for better control (see multi‑turn editing below).

---

## Multi‑Turn Image Editing

You can refine images over multiple turns by referencing either the **previous response** or a specific **image generation call ID**.

### A) Using `previous_response_id`

#### JavaScript
```js
import OpenAI from "openai";
const openai = new OpenAI();

// Initial image
const response = await openai.responses.create({
  model: "gpt-5",
  input: "Generate an image of gray tabby cat hugging an otter with an orange scarf",
  tools: [{ type: "image_generation" }],
});

// Follow-up edit
const response2 = await openai.responses.create({
  model: "gpt-5",
  previous_response_id: response.id,
  input: "Now make it look realistic",
  tools: [{ type: "image_generation" }],
});
```

#### Python
```python
from openai import OpenAI
import base64

client = OpenAI()

# Initial
resp = client.responses.create(
    model="gpt-5",
    input="Generate an image of gray tabby cat hugging an otter with an orange scarf",
    tools=[{"type": "image_generation"}],
)

# Follow-up
resp2 = client.responses.create(
    model="gpt-5",
    previous_response_id=resp.id,
    input="Now make it look realistic",
    tools=[{"type": "image_generation"}],
)
```

### B) Using an **image_generation_call** ID

#### JavaScript
```js
import OpenAI from "openai";
const openai = new OpenAI();

const resp = await openai.responses.create({
  model: "gpt-5",
  input: "Generate an image of gray tabby cat hugging an otter with an orange scarf",
  tools: [{ type: "image_generation" }],
});

const imageCalls = resp.output.filter((o) => o.type === "image_generation_call");

const respEdit = await openai.responses.create({
  model: "gpt-5",
  input: [
    { role: "user", content: [{ type: "input_text", text: "Now make it look realistic" }] },
    { type: "image_generation_call", id: imageCalls[0].id },
  ],
  tools: [{ type: "image_generation" }],
});
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

resp = client.responses.create(
    model="gpt-5",
    input="Generate an image of gray tabby cat hugging an otter with an orange scarf",
    tools=[{"type": "image_generation"}],
)

image_calls = [o for o in resp.output if o.type == "image_generation_call"]

resp_edit = client.responses.create(
    model="gpt-5",
    input=[
        {"role": "user", "content": [{"type": "input_text", "text": "Now make it look realistic"}]},
        {"type": "image_generation_call", "id": image_calls[0].id},
    ],
    tools=[{"type": "image_generation"}],
)
```

---

## Streaming Partial Images

You can stream **partial images** (1–3) as the final image is being generated.

### JavaScript
```js
import fs from "fs";
import OpenAI from "openai";
const openai = new OpenAI();

const stream = await openai.images.generate({
  prompt: "Draw a gorgeous image of a river made of white owl feathers, snaking its way through a serene winter landscape",
  model: "gpt-image-1",
  stream: true,
  partial_images: 2,
});

for await (const event of stream) {
  if (event.type === "image_generation.partial_image") {
    const idx = event.partial_image_index;
    const imageBase64 = event.b64_json;
    fs.writeFileSync(`river${idx}.png`, Buffer.from(imageBase64, "base64"));
  }
}
```

### Python
```python
from openai import OpenAI
import base64

client = OpenAI()

stream = client.images.generate(
    prompt="Draw a gorgeous image of a river made of white owl feathers, snaking its way through a serene winter landscape",
    model="gpt-image-1",
    stream=True,
    partial_images=2,
)

for event in stream:
    if event.type == "image_generation.partial_image":
        idx = event.partial_image_index
        data = base64.b64decode(event.b64_json)
        with open(f"river{idx}.png", "wb") as f:
            f.write(data)
```

---

## Supported Models

The **image_generation** tool can be called by these **mainline** models:

- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4.1`
- `gpt-4.1-mini`
- `gpt-4.1-nano`
- `o3`

> The actual image synthesis is performed by **`gpt-image-1`**. The models above decide when to invoke it during a conversation.

---

## Notes & Tips

- To force the tool: set `tool_choice` to `{ "type": "image_generation" }`.
- Multi‑turn refinement tends to yield better control/quality than a single giant prompt.
- Keep prompts concrete: subject, style, lighting, composition, and any constraints (size, background, etc.).

---

*End of summary.*
