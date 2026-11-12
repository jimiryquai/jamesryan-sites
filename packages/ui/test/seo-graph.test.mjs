import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleGraph } from "@jdevalk/seo-graph-core";
import { buildSiteGraph } from "../src/utils/seo-graph.ts";

test("canonical site graph normalizes the origin and links the Person, image, Blog and WebSite", () => {
  const { pieces } = buildSiteGraph("https://example.com///", "Example", "Description");
  const graph = assembleGraph(pieces)["@graph"];
  const person = graph.find(node => node["@type"] === "Person");
  const image = graph.find(node => node["@type"] === "ImageObject");
  const blog = graph.find(node => node["@type"] === "Blog");
  const website = graph.find(node => node["@type"] === "WebSite");
  assert.deepEqual(person.sameAs, ["https://www.linkedin.com/in/jimiryquai/", "https://www.x.com/jimiryquai"]);
  assert.equal(person.url, "https://example.com/about");
  assert.equal(person.image["@id"], image["@id"]);
  assert.equal(image.url, "https://example.com/images/avatar.webp");
  assert.equal(blog["@id"], "https://example.com/posts/#blog");
  assert.equal(blog.url, "https://example.com/posts/");
  assert.equal(blog.publisher["@id"], person["@id"]);
  assert.equal(website.publisher["@id"], person["@id"]);
  assert.equal(website.name, "Example");
  assert.equal(website.description, "Description");
});
