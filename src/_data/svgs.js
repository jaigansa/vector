const fs = require("fs");
const path = require("path");

/**
 * Eleventy global data file.
 * Scans src/svgs/ and returns a catalog of all SVG artworks,
 * organized by category folder.
 */
module.exports = function () {
  const svgDir = path.join(__dirname, "..", "svgs");
  const svgFiles = [];
  const categoriesDict = {};

  if (!fs.existsSync(svgDir)) {
    return { status: "ok", count: 0, categories: [], svgs: [] };
  }

  const entries = fs.readdirSync(svgDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const catSlug = entry.name;
    const catDir = path.join(svgDir, catSlug);
    const catName = catSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace("Cad", "CAD")
      .replace("Scifi", "Sci-Fi")
      .replace("Tech", "Tech");

    const files = fs.readdirSync(catDir).filter((f) => f.toLowerCase().endsWith(".svg"));

    for (const fname of files.sort()) {
      const fpath = path.join(catDir, fname);
      const stat = fs.statSync(fpath);
      const content = fs.readFileSync(fpath, "utf8");

      // Extract display name from <title> tag
      const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
      const dispName = titleMatch
        ? titleMatch[1].trim()
        : path.basename(fname, ".svg").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      const id = path.basename(fname, ".svg");

      // Check if it's a sprite (contains <symbol>)
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
        // Extract each symbol as a separate artwork entry
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

          svgFiles.push({
            name: `${symId}.svg`,
            path: `svgs/${catSlug}/${fname}#${symId}`,
            category: catName,
            categorySlug: catSlug,
            id: itemId,
            displayName: symDispName,
            symbolId: symId,
            isSprite: true,
            spriteFile: fname,
            size: Buffer.byteLength(inner, "utf8"),
            mtime: stat.mtimeMs,
          });
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

  svgFiles.sort((a, b) => a.name.localeCompare(b.name));
  const categories = Object.values(categoriesDict).sort((a, b) => a.name.localeCompare(b.name));

  return {
    status: "ok",
    count: svgFiles.length,
    categories,
    svgs: svgFiles,
  };
};
