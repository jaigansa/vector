module.exports = function (eleventyConfig) {
  // Passthrough static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js/vendor");
  eleventyConfig.addPassthroughCopy("src/js/lib");
  eleventyConfig.addPassthroughCopy("src/js/app.js");
  eleventyConfig.addPassthroughCopy("src/js/storage.js");
  eleventyConfig.addPassthroughCopy("src/js/export.js");
  eleventyConfig.addPassthroughCopy("src/js/viewer.js");
  eleventyConfig.addPassthroughCopy("src/js/library.js");

  // Watch the svgs folder so changes trigger a rebuild
  eleventyConfig.addWatchTarget("src/svgs/");

  return {
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html", "11ty.js"],
    htmlTemplateEngine: "njk",
  };
};
