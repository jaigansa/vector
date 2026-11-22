#!/usr/bin/env node
/**
 * generate-chunks.js — Split svg-library.js into per-category chunks.
 *
 * Scans src/svgs/ and generates:
 *   src/js/lib/svg-library-core.js   — window.svgLibrary initializer
 *   src/js/lib/<category-slug>.js    — one IIFE per category pushing its SVGs
 *
 * Also writes directly to docs/js/lib/ if docs/ exists.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SVG_DIR = path.join(ROOT, "src", "svgs");
const LIB_DIR = path.join(ROOT, "src", "js", "lib");
const DOCS_LIB_DIR = path.join(ROOT, "docs", "js", "lib");

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

function extractSpriteSymbols(content, fname, catSlug, catName, stat) {
  const items = [];
  const baseFileId = path.basename(fname, ".svg");

  const symbolRegex = new RegExp(
    "<symbol\\s+([^>]*id=[\"']([^\"']+)[\"'][^>]*)>([\\s\\S]*?)<\\/symbol>",
    "gi"
  );
  let match;

  const rootVbMatch = content.match(/<svg\b[^>]*\bviewBox=["']([^"']+)["']/i);
  const rootVb = rootVbMatch ? rootVbMatch[1] : "0 0 24 24";

  // Shared styles and defs from sprite
  const styles = [...content.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)]
    .map((m) => m[0])
    .join("\n");
  const defsMatch = [...content.matchAll(/<defs\b[^>]*>([\s\S]*?)<\/defs>/gi)]
    .map((m) => m[1].replace(/<symbol\b[\s\S]*?<\/symbol>/gi, "").trim())
    .filter(Boolean)
    .join("\n");
  const sharedDefs =
    styles || defsMatch ? `<defs>${styles}${defsMatch}</defs>` : "";

  while ((match = symbolRegex.exec(content)) !== null) {
    const rawAttrs = match[1];
    const symId = match[2];
    const inner = match[3];

    const itemId = symId.startsWith(baseFileId) ? symId : `${baseFileId}-${symId}`;
    const symVbMatch = rawAttrs.match(/viewBox=["']([^"']+)["']/i);
    const vb = symVbMatch ? symVbMatch[1] : rootVb;

    const titleMatch = inner.match(/<title[^>]*>(.*?)<\/title>/is);
    const dispName = titleMatch
      ? titleMatch[1].trim()
      : symId.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const cleanAttrs = rawAttrs
      .replace(/\bid=["'][^"']*["']/i, "")
      .replace(/\bviewBox=["'][^"']*["']/i, "")
      .trim();
    const attrsStr = cleanAttrs ? ` ${cleanAttrs}` : "";

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${attrsStr}>\n  ${sharedDefs}${inner.trim()}\n</svg>`;

    items.push({
      name: `${symId}.svg`,
      path: `svgs/${catSlug}/${fname}#${symId}`,
      category: catName,
      categorySlug: catSlug,
      id: itemId,
      displayName: dispName,
      symbolId: symId,
      isSprite: true,
      spriteFile: fname,
      content: svgContent,
      rawSpriteContent: content,
      size: Buffer.byteLength(svgContent, "utf8"),
      mtime: stat.mtimeMs,
    });
  }

  return items;
}

function collectSvgFiles() {
  const svgFiles = [];
  const categoriesDict = {};

  if (!fs.existsSync(SVG_DIR)) {
    return { svgFiles: [], categories: [] };
  }

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

      const isSprite = /<symbol\b/i.test(content);
      const hasSymbols = /<symbol\s+[^>]*id=/i.test(content);

      if (isSprite && hasSymbols) {
        const spriteItems = extractSpriteSymbols(
          content,
          fname,
          catSlug,
          catName,
          stat
        );
        if (spriteItems.length > 0) {
          svgFiles.push(...spriteItems);
          categoriesDict[catSlug] = { slug: catSlug, name: catName };
          continue;
        }
      }

      const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
      const dispName = titleMatch
        ? titleMatch[1].trim()
        : path
            .basename(fname, ".svg")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

      const id = path.basename(fname, ".svg");

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

      categoriesDict[catSlug] = { slug: catSlug, name: catName };
    }
  }

  svgFiles.sort((a, b) => a.name.localeCompare(b.name));
  const categories = Object.values(categoriesDict).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return { svgFiles, categories };
}

function getCategories() {
  return collectSvgFiles().categories;
}

function writeChunksToDir(targetDir, svgFiles, categories) {
  if (fs.existsSync(targetDir)) {
    for (const f of fs.readdirSync(targetDir)) {
      if (f.endsWith(".js")) {
        fs.unlinkSync(path.join(targetDir, f));
      }
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write core initializer
  fs.writeFileSync(
    path.join(targetDir, "svg-library-core.js"),
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

    fs.writeFileSync(path.join(targetDir, `${cat.slug}.js`), content);
  }
}

function generateChunks() {
  const { svgFiles, categories } = collectSvgFiles();

  // Write to src/js/lib
  writeChunksToDir(LIB_DIR, svgFiles, categories);

  // Also write to docs/js/lib if docs exists
  if (fs.existsSync(path.join(ROOT, "docs"))) {
    writeChunksToDir(DOCS_LIB_DIR, svgFiles, categories);
  }

  console.log(
    `✓ Generated ${categories.length} category chunks + core in ${LIB_DIR}`
  );
  console.log(`  Categories: ${categories.map((c) => c.slug).join(", ")}`);
  console.log(`  Total SVGs: ${svgFiles.length}`);

  return { svgFiles, categories };
}

module.exports = {
  slugToCategory,
  collectSvgFiles,
  getCategories,
  generateChunks,
};

if (require.main === module) {
  generateChunks();
}
