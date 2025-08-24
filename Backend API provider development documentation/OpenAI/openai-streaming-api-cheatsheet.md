# Streaming API responses — Dev Cheatsheet

A quick guide to streaming model outputs from the **Responses API** using semantic events (SSE).

---

## TL;DR
- Enable streaming with `stream: true` in **Responses API** requests.
- Consume a typed event stream; render `response.output_text.delta` as it arrives.
- Listen for `response.created` → text/tool deltas → `response.completed` (or `error`).

---

## Minimal examples

### JavaScript (Node)
```js
import { OpenAI } from "openai";
const client = new OpenAI();

const stream = await client.responses.create({
  model: "gpt-5",
  input: [{ role: "user", content: "Say 'double bubble bath' ten times fast." }],
  stream: true,
});

for await (const event of stream) {
  if (event.type === "response.output_text.delta") process.stdout.write(event.delta);
  else if (event.type === "response.completed") process.stdout.write("\n");
  else if (event.type === "error") console.error(event);
}
```

### Python
```py
from openai import OpenAI
client = OpenAI()

stream = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Say 'double bubble bath' ten times fast."}],
    stream=True,
)

for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="")
    elif event.type == "response.completed":
        print()
    elif event.type == "error":
        print(event)
```

---

## Event model (common ones)
The stream emits **typed semantic events**. Useful listeners:
- `response.created` — stream opened.
- `response.output_text.delta` — partial text tokens.
- `response.completed` — finished successfully.
- `error` — terminal error (network, safety, etc.).

You may also see (non-exhaustive):
- `response.output_item.added` / `.done` — new output block (e.g., text, tool call).
- `response.content_part.added` / `.done` — chunk boundaries within an item.
- `response.refusal.delta` / `.done` — safety refusal content.
- **Function calling:** `response.function_call_arguments.delta` / `.done`.
- **File search:** `response.file_search_call.{in_progress|searching|completed}`.
- **Code interpreter:** `response.code_interpreter.*` (code, interpreting, completed).

> Treat unknown event types as no-ops to remain forward-compatible.

---

## Pattern: accumulate deltas

### Text
```js
let text = "";
for await (const e of stream) {
  if (e.type === "response.output_text.delta") text += e.delta;
  if (e.type === "response.completed") break;
}
```

### Function call arguments
```js
let callArgs = "";
for await (const e of stream) {
  if (e.type === "response.function_call_arguments.delta") callArgs += e.delta;
  if (e.type === "response.function_call_arguments.done") {
    const args = JSON.parse(callArgs || "{}");
    // execute your tool, then continue the conversation
  }
}
```

---

## UI tips
- **Flush early and often**: render deltas as they arrive for best UX.
- **Show status**: spinner on `response.created`; stop on `response.completed`.
- **Handle refusals**: surface friendly message on `response.refusal.*`.
- **Backpressure**: buffer small chunks; avoid excessive DOM updates.

---

## Error handling & fallbacks
- Always listen for `error` and show a retry affordance.
- Time out client-side if no events for N seconds; cancel request.
- Fall back to non-streaming response for critical flows or when moderation gating is required.

---

## Moderation note
Streaming partial text is harder to pre‑moderate. If you must block unsafe content **before** showing it, disable streaming or gate deltas behind a server-side moderator that buffers and inspects content before forwarding.

---

## Testing checklists
- ✅ Verify order: created → deltas → completed
- ✅ Verify tool-call deltas aggregate to valid JSON
- ✅ Cancel mid-stream and confirm server closes
- ✅ Network error resilience and idempotent retries
- ✅ Measure TTFB and total latency
