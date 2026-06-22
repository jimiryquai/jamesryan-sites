/**
 * Shared constants for languages and themes.
 * Single source of truth — imported by index.ts, admin.tsx, and highlighter.ts.
 */

export const LANGUAGES = [
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "Rust", value: "rust" },
  { label: "Go", value: "go" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
  { label: "Bash", value: "bash" },
  { label: "SQL", value: "sql" },
  { label: "Markdown", value: "markdown" },
  { label: "YAML", value: "yaml" },
  { label: "Plain Text", value: "text" },
  { label: "Mermaid Diagram", value: "mermaid" },
] as const;

export const THEMES = [
  { label: "GitHub Dark", value: "github-dark" },
  { label: "GitHub Light", value: "github-light" },
  { label: "Dracula", value: "dracula" },
  { label: "Nord", value: "nord" },
  { label: "One Dark Pro", value: "one-dark-pro" },
  { label: "Solarized Dark", value: "solarized-dark" },
  { label: "Solarized Light", value: "solarized-light" },
  { label: "Monokai", value: "monokai" },
  { label: "Synthwave '84", value: "synthwave-84" },
  { label: "Tokyo Night", value: "tokyo-night" },
  { label: "Night Owl", value: "night-owl" },
  { label: "Rosé Pine", value: "rose-pine" },
  { label: "Rosé Pine Moon", value: "rose-pine-moon" },
  { label: "Rosé Pine Dawn", value: "rose-pine-dawn" },
  { label: "Ayu Dark", value: "ayu-dark" },
  { label: "Light Plus", value: "light-plus" },
  { label: "Dark Plus", value: "dark-plus" },
  { label: "Material Theme", value: "material-theme" },
  { label: "Material Theme Darker", value: "material-theme-darker" },
  { label: "Material Theme Lighter", value: "material-theme-lighter" },
  { label: "Material Theme Palenight", value: "material-theme-palenight" },
  { label: "Poimandres", value: "poimandres" },
  { label: "Vitesse Dark", value: "vitesse-dark" },
  { label: "Vitesse Light", value: "vitesse-light" },
] as const;

/** Default theme applied when none is specified. */
export const DEFAULT_THEME = "github-dark";

/** Default language applied when none is specified. */
export const DEFAULT_LANGUAGE = "javascript";

/** All supported language values for the Shiki highlighter. */
export const LANGUAGE_VALUES = LANGUAGES.map((l) => l.value);

/** All supported theme values for the Shiki highlighter. */
export const THEME_VALUES = THEMES.map((t) => t.value);
