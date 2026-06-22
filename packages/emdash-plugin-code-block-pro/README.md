# EmDash Plugin: Code Block Pro

A professional, feature-rich syntax highlighting plugin for [EmDash CMS](https://emdashcms.com). Powered by Shiki and optimized for edge rendering environments (e.g. Cloudflare Workers) by running on a pure JavaScript regex engine without WebAssembly.

![Premium Code Block Design](https://raw.githubusercontent.com/jimiryquai/emdash-plugin-code-block-pro/main/docs/assets/preview.png)

## Features

- ⚡ **Zero Client Overhead**: Renders static HTML on the server. No framework runtimes or heavy libraries are shipped to the client browser.
- 🎨 **VS Code Quality Syntax Highlighting**: Powered by Shiki with 20+ preloaded premium themes (Tokyo Night, Rosé Pine, Synthwave '84, Monokai, Ayu, Dracula, and more).
- ⚙️ **Cloudflare Workers Compatible**: Uses `@shikijs/engine-javascript` to perform syntax highlighting entirely in JavaScript. Avoids `WebAssembly.instantiate()`, which is prohibited in Cloudflare Worker environments.
- 📋 **Integrated Header Toolbar**: Automatically displays the code language badge and filename on the left, and a sleek copy-to-clipboard button on the right (keeping code text completely unobstructed).
- 🔢 **Custom Line Numbers & Gutters**: Clean, customizable line numbers that support specifying any custom starting line offset (e.g., starting at line 10).
- 🏷️ **Accent Line Highlights**: Highlight specific line ranges (e.g., `1`, `3-5`) with a soft indigo backdrop and a solid left border indicator.
- 🖱️ **Micro-interactions**: Subtle hover state background glows and line-number focus transitions for a premium interactive feel.

---

## Installation

Install the package and its required peer dependencies in your Astro site project:

```bash
npm install emdash-plugin-code-block-pro shiki @shikijs/engine-javascript
# or
pnpm add emdash-plugin-code-block-pro shiki @shikijs/engine-javascript
```

---

## Usage

### 1. Register the Plugin (CMS Side)

In your `emdash.config.ts` (or wherever your EmDash plugin registry is configured), import and register the plugin:

```typescript
import { defineConfig } from "emdash";
import { codeBlockProPlugin } from "emdash-plugin-code-block-pro";

export default defineConfig({
  // ... other configs
  plugins: [
    codeBlockProPlugin({
      defaultTheme: "github-dark", // Optional: specify a fallback theme
    }),
  ],
});
```

This registers the block type in the EmDash editor layout under **Code Block Pro** with custom options for themes, languages, filenames, starting line numbers, line highlights, and copy controls.

### 2. Render the Block (Site Side)

Import the Astro rendering components from the plugin's `astro` export and pass them to the Portable Text renderer:

```astro
---
// src/components/MyPortableText.astro
import { PortableText } from "astro-portabletext";
import { blockComponents } from "emdash-plugin-code-block-pro/astro";

interface Props {
  value: any[];
}
const { value } = Astro.props;
---

<PortableText value={value} components={blockComponents} />
```

---

## Configuration Options

When initializing the plugin, you can provide an options object:

```typescript
codeBlockProPlugin({
  defaultTheme: "one-dark-pro", // Theme applied if the block does not specify one
})
```

---

## Development

```bash
# Clone the repository
git clone https://github.com/jimiryquai/emdash-plugin-code-block-pro.git
cd emdash-plugin-code-block-pro

# Install dependencies
pnpm install

# Run the Vitest test suite
npm test
```

## Credits

This plugin is heavily inspired by the excellent [Code Block Pro](https://github.com/kevinbatdorf/code-block-pro) WordPress Gutenberg block created by [Kevin Batdorf](https://github.com/kevinbatdorf).

## License

MIT License. See [LICENSE](LICENSE) for details.
