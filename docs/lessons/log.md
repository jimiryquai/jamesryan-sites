# Lessons log

## 2026-11-12

* **Creation**: Usermaven's browser SDK keeps a localStorage retry buffer and requires tagged form tracking (from ticket 26's SDK verification rounds `26b` and `26c`).
* **Creation**: Cookie-forced theme tests mask broken cookie-less System dark mode (from ticket 13 codebase review, filed as ticket `30-96529855`).
* **Creation**: Cloudflare Workers Assets ignores public/_headers on SSR routes (from ticket 13 codebase review, filed as ticket `32-a552c031`).
* **Creation**: Pass Satori VNodes and bundled WOFF1 bytes to workers-og instead of HTML strings (from ticket `31-3370abcf` build and cross-family review).
* **Creation**: Place Tailwind v4 `@variant dark` rules after equal-specificity light rules (from ticket `33-2cbc0092` cross-family review).
* **Creation**: Workspace Astro UI packages need their own `astro check` and canonical platform unions (from ticket `29-79f19342` cross-family review).
* **Creation**: EmDash published queries still overlay pending draft revisions during `editMode` and `preview` sessions (from ticket `32-a552c031` cross-family review).
* **Creation**: Keep Astro config factories inside Vite's config bundle, run `Astro.rewrite` before component streaming, and attach taxonomy cache tags (from ticket `34-688a3b6c` implementation and cross-family review).

## 2026-11-13

* **Creation**: Workers AI fast-v2 models return parsed JSON objects instead of strings (from ticket `11-3b1d7a85` live staging verification of `emdash-plugin-ai-comment-moderation`).
