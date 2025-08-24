# Reasoning Models — Dev Cheat Sheet

> Based on the “Reasoning models” SearchK page. Focused on what you need to ship.

---

## TL;DR
Reasoning models (e.g., **gpt-5**, **gpt-5-mini**, **gpt-5-nano**) generate **internal reasoning tokens** before answering. They excel at complex problem solving, coding, STEM reasoning, and multi‑step planning (great for **agentic workflows** and **Codex CLI**). Larger models are smarter but slower/pricier; smaller ones trade capability for speed and cost.

---

## Pick a model
- **gpt-5** – Best for complex, broad tasks and heavy planning.
- **gpt-5-mini** – Balanced; cheaper and faster.
- **gpt-5-nano** – Highest throughput for simple/structured tasks.

---

## Quickstart (Responses API)
**JavaScript**
```js
import OpenAI from "openai";
const openai = new OpenAI();

const resp = await openai.responses.create({
  model: "gpt-5",
  reasoning: { effort: "medium" }, // low | medium (default) | high
  input: [{ role: "user", content: "Write a bash script to transpose '[1,2],[3,4],[5,6]'." }],
});

console.log(resp.output_text);
```

**Python**
```python
from openai import OpenAI
client = OpenAI()

resp = client.responses.create(
    model="gpt-5",
    reasoning={"effort": "medium"},
    input=[{"role": "user", "content": "Write a bash script to transpose '[1,2],[3,4],[5,6]'."}],
)
print(resp.output_text)
```

**curl**
```bash
curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json"   -d '{
    "model": "gpt-5",
    "reasoning": {"effort": "medium"},
    "input": [{"role":"user","content":"Write a bash script to transpose "[1,2],[3,4],[5,6]"."}]
  }'
```

---

## How reasoning works
- The model emits **reasoning tokens** (private “chain of thought”) before visible output.
- These tokens **consume context** and are **billed as output tokens**, but are **discarded** from the conversation afterward.
- Inspect usage via `response.usage.output_tokens_details.reasoning_tokens`.

```json
"output_tokens_details": { "reasoning_tokens": 1024 }
```

---

## Context & cost management
- Ensure enough headroom for reasoning + output. If unsure, **reserve ~25k tokens** initially, then tune down.
- Cap spend/latency via `max_output_tokens`. If hit, you’ll get `status: "incomplete"` with:
  - `incomplete_details.reason: "max_output_tokens"`
  - You may have **paid for reasoning** even if no visible text emitted.

**Pattern**
```js
if (resp.status === "incomplete" && resp.incomplete_details?.reason === "max_output_tokens") {
  console.log("Ran out of tokens");
  if (resp.output_text) console.log("Partial:", resp.output_text);
}
```

---

## Function calling + reasoning items
For **reasoning models**, when tools/functions are called:
- **Pass back**: all **reasoning items**, **function call items**, and **function outputs** **since the last user message**.
- Easiest: include the prior turn via `previous_response_id`, or inline the prior `output` items.
- This keeps the model “in-distribution” without re‑reasoning, improving quality and cost.

---

## Stateless / ZDR flows (encrypted reasoning)
- In stateless mode (e.g., `store: false` or **zero data retention**), include:
  - `include: ["reasoning.encrypted_content"]`
- Then forward `encrypted_content` reasoning items to subsequent turns.

**curl sketch**
```bash
curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json"   -d '{ "model":"o4-mini", "input":"...", "include":["reasoning.encrypted_content"] }'
```

---

## Reasoning summaries (opt‑in)
- Add `reasoning.summary: "auto"` to receive a **readable summary** of the model’s thinking in the output array.
- Some models may require **org verification** to enable summaries.

**JS**
```js
await openai.responses.create({
  model: "gpt-5",
  input: "What is the capital of France?",
  reasoning: { effort: "low", summary: "auto" },
});
```

**Output (simplified)**
```json
[
  { "type":"reasoning", "summary":[{"type":"summary_text","text":"..."}] },
  { "type":"message", "content":[{"type":"output_text","text":"Paris."}] }
]
```

---

## Prompting guidance
- Treat reasoning models like a **senior teammate**: give **goals** and constraints, not line‑by‑line steps.
- GPT‑style models behave more like **juniors**: give **explicit instructions** and fixed formats.

---

## Handy presets
- **Fast & cheap**: `reasoning.effort: "low"` and concise prompts.
- **Max quality**: `reasoning.effort: "high"`, ample token headroom, pass back tool reasoning items.
- **Guardrails**: add `max_output_tokens`, watch `usage`, and handle `incomplete`.

---

## Example prompts
- **Refactor**: transform React component with style/formatting constraints; return **code only**.
- **Planner**: design a project, propose filesystem layout, then emit full files.
- **STEM**: propose candidate compounds and justify choices.

---

## Gotchas
- Hitting `max_output_tokens` **during reasoning** can yield **no visible text**—still billed.
- Reasoning tokens are **not retained** automatically; **you** must pass back items across tool calls.
- Context windows differ by snapshot—check the **model reference** you’re targeting.
