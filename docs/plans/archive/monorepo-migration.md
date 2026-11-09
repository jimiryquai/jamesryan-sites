> **Archived 2026-11-08.** Shipped: this repo is the pnpm monorepo it describes.

# Monorepo Migration Plan: jamesryan.dev & jamesryan.me

This document outlines the architectural plan for refactoring the current Astro + EmDash projects into a single unified `pnpm` monorepo. This will allow sharing UI components, themes, and logic while keeping the two sites visually distinct and connected to separate database instances.

---

## 1. Directory Structure

We will adopt a `pnpm` workspace directory structure:

```text
jamesryan-monorepo/
├── apps/
│   ├── marketing-site/         # jamesryan.dev (AI Consultancy)
│   │   ├── astro.config.mjs    # Cloudflare workers adapter with jamesryan.dev bindings
│   │   ├── package.json
│   │   └── src/
│   └── digital-garden/         # jamesryan.me (Long-form guides & digital garden)
│       ├── astro.config.mjs    # Cloudflare workers adapter with jamesryan.me bindings
│       ├── package.json
│       └── src/
├── packages/
│   ├── ui/                     # Shared Astro components, layout blocks, and assets
│   │   ├── package.json
│   │   └── src/
│   │       ├── Button.astro
│   │       ├── Card.astro
│   │       └── theme.css       # Core Tailwind CSS v4 variables
│   └── cms-helpers/            # Shared DB query functions, reading-time calculation, etc.
│       ├── package.json
│       └── src/
├── pnpm-workspace.yaml
├── package.json
└── pnpm-lock.yaml
```

---

## 2. Shared Styling System (Tailwind CSS v4)

Tailwind v4 is CSS-first, which eliminates the need to compile multiple configuration JS files.

1. **Base Styles (`packages/ui/src/theme.css`)**:
   Contains common typography, spacing scales, shadow levels, and layout base variables:
   ```css
   @theme {
     --font-sans: "Inter", sans-serif;
     --font-display: "Instrument Serif", serif;
     --radius-lg: 16px;
   }
   ```

2. **Apps Overrides**:
   * **jamesryan.dev (AI Consultancy)**:
     ```css
     /* apps/marketing-site/src/styles/global.css */
     @import "tailwindcss";
     @import "@jamesryan/ui/theme.css";

     :root {
       --color-primary: #6366f1; /* Indigo */
       --color-accent: #f472b6;  /* Pink */
     }
     ```
   * **jamesryan.me (Digital Garden)**:
     ```css
     /* apps/digital-garden/src/styles/global.css */
     @import "tailwindcss";
     @import "@jamesryan/ui/theme.css";

     :root {
       --color-primary: #047857; /* Emerald Green */
       --color-accent: #f59e0b;  /* Amber */
     }
     ```

---

## 3. EmDash CMS Configuration

* **Backend Separation**: Both sites will connect to separate databases and media stores.
  * `jamesryan.dev` connects to D1 database `marketing-db` and R2 bucket `marketing-media`.
  * `jamesryan.me` connects to D1 database `garden-db` and R2 bucket `garden-media`.
* **Individual Schemas**: Each app folder retains its own `seed/seed.json` with collections tailored to its theme:
  * Marketing: `pages`, `posts`, `projects`, `services`.
  * Garden: `guides`, `notes`, `categories`.

---

## 4. Migration & Redirects (`.dev` ➜ `.me`)

To migrate the 5 existing blog posts to the new digital garden and ensure zero link rot (SEO protection):

1. **Data Import**:
   * Extract D1 posts rows/JSON from `jamesryan.dev` and seed them into `jamesryan.me`.
   
2. **Cloudflare URL Redirects**:
   Map old blog paths to the new garden domain using Cloudflare Page/Redirect rules or Astro configuration:
   ```js
   // apps/marketing-site/astro.config.mjs
   export default defineConfig({
     redirects: {
       '/blog/[...slug]': 'https://jamesryan.me/blog/[...slug]'
     }
   });
   ```

---

## 5. Next Steps for Tomorrow

1. Initialize the monorepo root directory and create the `pnpm-workspace.yaml`.
2. Move the existing Oatmeal project code into `apps/marketing-site`.
3. Scaffold `packages/ui` and start extracting common components (e.g., `ProjectCard.astro`, `PostCard.astro`).
4. Set up the `apps/digital-garden` project structure.
