---
module: emdash-plugin
problem_type: api_mismatch
tags: ["emdash","block-kit","action_id","testing"]
---
### [2026-05-22] Block Kit fields use action_id not name
EmDash Block Kit field descriptors use `action_id` as the key property, not `name`. When querying fields from a block type descriptor (e.g., `block.fields.find(f => f.action_id === "code")`), always use `action_id`. The field type values are `text_input` (not `text`), `toggle` (not `boolean`), `select`, and `string`. Tests that check field existence must use the correct property name and type values to match the actual descriptor shape.\n\nFile reference: `src/index.ts` shows `blockFields` array with `{ type: \"text_input\", action_id: \"code\", ... }` shape.
