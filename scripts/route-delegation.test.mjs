import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('both apps delegate every discovery handler and both taxonomy archives to shared modules', () => {
  for (const app of ['marketing-site', 'digital-garden']) {
    const prefix = `apps/${app}/src/pages`;
    for (const [path, name] of [['robots.txt.ts', 'robots'], ['rss.xml.ts', 'rss'], ['schemamap.xml.ts', 'schemaMap'], ['.well-known/api-catalog.ts', 'apiCatalog']]) {
      assert.equal(read(`${prefix}/${path}`).trim(), `export { ${name} as GET } from "@jamesryan/cms-helpers/discovery";`);
    }
    for (const taxonomy of ['category', 'tag']) {
      const source = read(`${prefix}/${taxonomy}/[slug].astro`);
      assert.match(source, /import TaxonomyArchive from "@jamesryan\/ui\/components\/TaxonomyArchive\.astro"/);
      assert.match(source, /import \{ getTaxonomyArchive \} from "@jamesryan\/cms-helpers\/taxonomy-archive"/);
      assert.ok(source.includes(`getTaxonomyArchive("${taxonomy}", Astro.params.slug, Astro.cache)`));
      assert.match(source, /if \(!archive\) return Astro.rewrite\("\/404"\)/);
      assert.ok(source.includes(`<TaxonomyArchive taxonomy="${taxonomy}" layout={Base} archive={archive} />`));
      assert.doesNotMatch(source, /getEmDashCollection|getTerm\(/);
    }
  }
});
