> **Archived 2026-11-08.** Not shipped: a brainstorm; none of its block types exist. The jamesryan.dev blueprint (backlog) picks up the page builder.

# Brainstorm: Custom Flexible Blocks (EmDash + Astro)

This document is a brainstorm on how to leverage EmDash custom Portable Text block types to build a highly flexible, ACF-style page building experience for both **jamesryan.dev** (AI Consultancy) and **jamesryan.me** (Digital Garden).

---

## 1. Core Concept

By utilizing EmDash plugins (`definition.admin.portableTextBlocks`), we can define custom structured layouts. 
* Authors insert and configure these blocks in the editor.
* Astro maps each block to an isolated server-rendered component.
* Keeps the layout dynamic, lightweight, and queryable.

---

## 2. Block Ideas for jamesryan.dev (AI Consultancy)

The goal for the marketing site is lead generation, establishing authority, and showcasing concrete outcomes.

### 1. ROI / Value Calculator Block (`consultancy.roi_calculator`)
* **Fields**:
  * `headline` (string)
  * `subheadline` (string)
  * `hourlyRateDefault` (number)
  * `hoursSavedDefault` (number)
* **Frontend Rendering**: Renders an interactive Astro Island (using React or lightweight Vanilla JS) allowing potential clients to toggle inputs (e.g., number of manual tasks, hours spent) and see their annual savings when automated with AI/agents.

### 2. Case Study Spotlight Block (`consultancy.case_study`)
* **Fields**:
  * `headline` (string)
  * `projectReference` (select / reference to the `projects` collection)
  * `testimonialQuote` (text)
  * `metricLabel` (string - e.g. "Reduction in processing time")
  * `metricValue` (string - e.g. "82%")
* **Frontend Rendering**: A highlight card drawing live data from the selected project reference, highlighting the key metric and linking directly to the full case study page.

### 3. Tech Stack Grid (`consultancy.tech_stack`)
* **Fields**:
  * `headline` (string)
  * `description` (text)
  * `categories` (repeater of `{ categoryName, iconList }` - e.g. "AI Orchestration: LangChain, CrewAI, AutoGen")
* **Frontend Rendering**: A clean grid highlighting your technical capabilities (Power Platform, Azure OpenAI, Python, PyTorch) with crisp vector logos/icons.

### 4. Interactive Accordion / Services list (`consultancy.services_grid`)
* **Fields**:
  * `headline` (string)
  * `services` (repeater of `{ title, description, detailsUrl, priceEst }`)

---

## 3. Block Ideas for jamesryan.me (Digital Garden & Tech Blog)

The goal for the digital garden is readability, interactive learning, and clear technical explanation.

### 1. Code Playground / Split View (`garden.code_playground`)
* **Fields**:
  * `language` (select: js, python, bash, json)
  * `code` (text, multiline)
  * `explanation` (text, multiline)
* **Frontend Rendering**: A split-pane component showing the code block (with syntax highlighting and a "Copy" button) on the left, and a descriptive breakdown or telemetry explanation on the right.

### 2. Interactive Mermaid Diagram Block (`garden.mermaid`)
* **Fields**:
  * `syntax` (text, multiline - the Mermaid.js graph description)
  * `caption` (string)
* **Frontend Rendering**: Runs Mermaid.js client-side (or renders an SVG at build time) to show interactive system architectures, data flows, or agent pipelines.

### 3. Notice / Callout Box (`garden.callout`)
* **Fields**:
  * `type` (select: info, tip, warning, caution)
  * `title` (string)
  * `content` (text, multiline)
* **Frontend Rendering**: Styled banner blocks with matching semantic colors (blue, green, orange, red) and icons to highlight important callouts, gotchas, or prerequisites.

### 4. TL;DR / Summary Box (`garden.tldr`)
* **Fields**:
  * `content` (text, multiline - bulleted summary points)
* **Frontend Rendering**: A highlighted box at the very top of long-form guides, allowing readers to digest key points in 10 seconds before diving deep.

---

## 4. Implementation Strategy

To keep the codebase maintainable:

1. **Keep Blocks Isolated**: Custom block schemas are defined inside your local plugin. Keep component rendering logic completely matching that schema.
2. **Handle Multi-field CTAs cleanly**: Since EmDash does not support nested objects inside the Block Kit editor forms yet, always flatten objects (e.g. `ctaLabel` + `ctaUrl` instead of a nested `cta: { label, url }` object).
3. **Use Astro Islands Wisely**: Only load JavaScript (like `client:load` or `client:visible`) on blocks that actually require client-side interaction (e.g., ROI calculators, interactive diagrams). Keep layouts, feature grids, and code snippets completely static.
