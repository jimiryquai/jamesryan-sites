/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHighlighter, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import { LANGUAGE_VALUES } from "../constants.js";

/**
 * Map of statically analyzable theme imports for Vite to bundle them as chunks.
 * Each key matches a value from THEMES in constants.ts.
 */
const THEME_MAP: Record<string, () => Promise<any>> = {
  "github-dark": () => import("shiki/themes/github-dark.mjs"),
  "github-light": () => import("shiki/themes/github-light.mjs"),
  "dracula": () => import("shiki/themes/dracula.mjs"),
  "nord": () => import("shiki/themes/nord.mjs"),
  "one-dark-pro": () => import("shiki/themes/one-dark-pro.mjs"),
  "solarized-dark": () => import("shiki/themes/solarized-dark.mjs"),
  "solarized-light": () => import("shiki/themes/solarized-light.mjs"),
  "monokai": () => import("shiki/themes/monokai.mjs"),
  "synthwave-84": () => import("shiki/themes/synthwave-84.mjs"),
  "tokyo-night": () => import("shiki/themes/tokyo-night.mjs"),
  "night-owl": () => import("shiki/themes/night-owl.mjs"),
  "rose-pine": () => import("shiki/themes/rose-pine.mjs"),
  "rose-pine-moon": () => import("shiki/themes/rose-pine-moon.mjs"),
  "rose-pine-dawn": () => import("shiki/themes/rose-pine-dawn.mjs"),
  "ayu-dark": () => import("shiki/themes/ayu-dark.mjs"),
  "light-plus": () => import("shiki/themes/light-plus.mjs"),
  "dark-plus": () => import("shiki/themes/dark-plus.mjs"),
  "material-theme": () => import("shiki/themes/material-theme.mjs"),
  "material-theme-darker": () => import("shiki/themes/material-theme-darker.mjs"),
  "material-theme-lighter": () => import("shiki/themes/material-theme-lighter.mjs"),
  "material-theme-palenight": () => import("shiki/themes/material-theme-palenight.mjs"),
  "poimandres": () => import("shiki/themes/poimandres.mjs"),
  "vitesse-dark": () => import("shiki/themes/vitesse-dark.mjs"),
  "vitesse-light": () => import("shiki/themes/vitesse-light.mjs"),
};

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Get a cached Shiki highlighter instance using the JavaScript regex engine.
 *
 * The JS engine avoids WebAssembly.instantiate(), which is disallowed in
 * Cloudflare Workers (workerd). Oniguruma (the default) requires WASM.
 */
export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"], // Initial baseline theme
      langs: [...LANGUAGE_VALUES],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

/**
 * Highlight code to HTML using the JS regex engine (no WASM).
 */
export async function highlightCode(
  code: string,
  lang: string,
  theme: string,
): Promise<string> {
  const highlighter = await getHighlighter();

  // Load language on demand if not pre-loaded
  if (
    lang !== "text" &&
    !highlighter.getLoadedLanguages().includes(lang)
  ) {
    try {
      await highlighter.loadLanguage(lang as any);
    } catch {
      // Language not available — fall back to text
      lang = "text";
    }
  }

  // Load theme on demand using the static dynamic imports map
  if (!highlighter.getLoadedThemes().includes(theme as any)) {
    try {
      const loadThemeFn = THEME_MAP[theme];
      if (loadThemeFn) {
        const themeMod = await loadThemeFn();
        await highlighter.loadTheme(themeMod.default || themeMod);
      } else {
        await highlighter.loadTheme(theme as any);
      }
    } catch (err) {
      console.error(`[code-block-pro] Failed to load theme "${theme}":`, err);
      theme = "github-dark";
    }
  }

  return highlighter.codeToHtml(code, {
    lang: lang || "text",
    theme: theme || "github-dark",
  });
}
