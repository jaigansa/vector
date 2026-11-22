#!/usr/bin/env node
/**
 * generate-chunks.js — Split svg-library.js into per-category chunks.
 *
 * Reads src/_data/svgs.js logic (scans src/svgs/) and generates:
 *   src/js/lib/svg-library-core.js   — window.svgLibrary initializer
 *   src/js/lib/<category-slug>.js    — one IIFE per category pushing its SVGs
 *
 * Run before eleventy: node scripts/generate-chunks.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SVG_DIR = path.join(ROOT, "src", "svgs");
const LIB_DIR = path.join(ROOT, "src", "js", "lib");

function slugToCategory(slug) {
  const map = {
    "tech-software": "Tech & Software",
    "business-marketing": "Business & Marketing",
    "engineering-cad": "Engineering & CAD",
    "nature-scenery": "Nature & Scenery",
    "abstract-3d": "Abstract & 3D",
    "art-creative": "Art & Creative",
  };
  if (map[slug]) return map[slug];
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Cad", "CAD")
    .replace("Scifi", "Sci-Fi")
    .replace("Tech", "Tech");
}

// Clean and recreate lib dir
if (fs.existsSync(LIB_DIR)) {
  for (const f of fs.readdirSync(LIB_DIR)) {
    fs.unlinkSync(path.join(LIB_DIR, f));
  }
} else {
  fs.mkdirSync(LIB_DIR, { recursive: true });
}

const svgFiles = [];
const categoriesDict = {};

if (fs.existsSync(SVG_DIR)) {
  const entries = fs.readdirSync(SVG_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const catSlug = entry.name;
    const catDir = path.join(SVG_DIR, catSlug);
    const catName = slugToCategory(catSlug);

    const files = fs
      .readdirSync(catDir)
      .filter((f) => f.toLowerCase().endsWith(".svg"));

    for (const fname of files.sort()) {
      const fpath = path.join(catDir, fname);
      const stat = fs.statSync(fpath);
      const content = fs.readFileSync(fpath, "utf8");

      const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
      const dispName = titleMatch
        ? titleMatch[1].trim()
        : path.basename(fname, ".svg").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      const id = path.basename(fname, ".svg");
      const isSprite = /<symbol\b/i.test(content);
      const symbolMatches = content.match(/<symbol\s+[^>]*id=["']([^"']+)["'][^>]*>/gi);
      const symbolIds = symbolMatches
        ? symbolMatches.map((m) => {
            const idMatch = m.match(/id=["']([^"']+)["']/);
            return idMatch ? idMatch[1] : null;
          })
          .filter(Boolean)
        : [];

      if (isSprite && symbolIds.length > 0) {
        for (const symId of symbolIds) {
          const itemId = `${id}-${symId}`;
          const symMatch = content.match(
            new RegExp(`<symbol\\b[^>]*id=["']${symId}["'][^>]*>(.*?)</symbol>`, "is")
          );
          const inner = symMatch ? symMatch[1] : "";
          const vbMatch = content.match(/viewBox=["']([^"']+)["']/i);
          const viewBox = vbMatch ? vbMatch[1] : "0 0 24 24";
          const symTitleMatch = inner.match(/<title[^>]*>(.*?)<\/title>/is);
          const symDispName = symTitleMatch
            ? symTitleMatch[1].trim()
            : symId.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

          const svgItem = {
            name: `${symId}.svg`,
            path: `svgs/${catSlug}/${fname}#${symId}`,
            category: catName,
            categorySlug: catSlug,
            id: itemId,
            displayName: symDispName,
            symbolId: symId,
            isSprite: true,
            spriteFile: fname,
            content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`,
            size: Buffer.byteLength(inner, "utf8"),
            mtime: stat.mtimeMs,
          };
          svgFiles.push(svgItem);
        }
      } else {
        svgFiles.push({
          name: fname,
          path: `svgs/${catSlug}/${fname}`,
          category: catName,
          categorySlug: catSlug,
          id,
          displayName: dispName,
          size: stat.size,
          mtime: stat.mtimeMs,
          content,
        });
      }
    }

    categoriesDict[catSlug] = { slug: catSlug, name: catName };
  }
}

svgFiles.sort((a, b) => a.name.localeCompare(b.name));
const categories = Object.values(categoriesDict).sort((a, b) => a.name.localeCompare(b.name));

// Write core initializer
fs.writeFileSync(
  path.join(LIB_DIR, "svg-library-core.js"),
  "window.svgLibrary = { categories: [], svgs: [] };\n"
);

// Write one chunk per category
for (const cat of categories) {
  const catSvgs = svgFiles.filter((s) => s.categorySlug === cat.slug);

  let content = "(function() {\n";
  content += "  window.svgLibrary = window.svgLibrary || { categories: [], svgs: [] };\n";
  content += `  window.svgLibrary.categories.push(${JSON.stringify(cat)});\n`;

  for (const svg of catSvgs) {
    content += `  window.svgLibrary.svgs.push(${JSON.stringify(svg)});\n`;
  }

  content += "})();\n";

  fs.writeFileSync(path.join(LIB_DIR, `${cat.slug}.js`), content);
}

console.log(
  `✓ Generated ${categories.length} category chunks + core in ${LIB_DIR}`
);
console.log(`  Categories: ${categories.map((c) => c.slug).join(", ")}`);
console.log(`  Total SVGs: ${svgFiles.length}`);
