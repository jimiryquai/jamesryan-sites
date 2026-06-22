import type { PluginDescriptor, PortableTextBlockConfig } from "emdash";
import { definePlugin } from "emdash";
import { LANGUAGES, THEMES, DEFAULT_THEME, DEFAULT_LANGUAGE } from "./constants.js";

/**
 * Block Kit field definitions for the code-block-pro editing modal.
 *
 * We use `as const` on each `type` literal so TypeScript narrows them to
 * the exact discriminant values that the `Element` union expects
 * (e.g. `"text_input"`, not `string`).
 */
const blockFields = [
  { type: "text_input" as const, action_id: "code", label: "Code", multiline: true },
  { type: "select" as const, action_id: "language", label: "Language", options: [...LANGUAGES], initial_value: DEFAULT_LANGUAGE },
  { type: "select" as const, action_id: "theme", label: "Theme", options: [...THEMES], initial_value: DEFAULT_THEME },
  { type: "text_input" as const, action_id: "filename", label: "Filename" },
  { type: "toggle" as const, action_id: "lineNumbers", label: "Show line numbers", initial_value: false },
  { type: "text_input" as const, action_id: "startingLineNumber", label: "Starting line number (default: 1)" },
  { type: "text_input" as const, action_id: "lineHighlights", label: "Highlight lines (e.g. 1,3-5)" },
  { type: "toggle" as const, action_id: "copyButton", label: "Show copy button", initial_value: true },
  { type: "text_input" as const, action_id: "maxHeight", label: "Max height (e.g. 400px)" },
];

const blockType: PortableTextBlockConfig = {
  type: "code-block-pro",
  label: "Code Block Pro",
  icon: "code",
  placeholder: "Paste or type code…",
  fields: blockFields,
};

/**
 * Extended descriptor that adds `portableTextBlocks` alongside the
 * standard PluginDescriptor fields. EmDash's virtual module generator
 * reads this property from the descriptor to register blocks in the
 * admin editor at build time.
 */
interface CodeBlockProDescriptor extends PluginDescriptor {
  portableTextBlocks: PortableTextBlockConfig[];
}

export function codeBlockProPlugin(options?: {
  defaultTheme?: string;
}): CodeBlockProDescriptor {
  // Wire up defaultTheme option if provided
  if (options?.defaultTheme) {
    const themeField = blockFields.find((f) => f.action_id === "theme");
    if (themeField && "initial_value" in themeField) {
      (themeField as { initial_value: string }).initial_value = options.defaultTheme;
    }
  }

  return {
    id: "code-block-pro",
    version: "0.1.0",
    format: "native",
    entrypoint: "emdash-plugin-code-block-pro",
    adminEntry: "emdash-plugin-code-block-pro/admin",
    componentsEntry: "emdash-plugin-code-block-pro/astro",
    options: options ?? {},
    portableTextBlocks: [blockType],
  };
}

/**
 * Native plugins: EmDash's virtual module generator does
 *   `import { createPlugin } from "<entrypoint>"; createPlugin({})`
 * at runtime. This must return a PluginDefinition (not a PluginDescriptor).
 */
export function createPlugin(_options?: { defaultTheme?: string }) {
  return definePlugin({
    id: "code-block-pro",
    version: "0.1.0",
    admin: {
      portableTextBlocks: [blockType],
    },
  });
}
