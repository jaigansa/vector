module.exports = function (eleventyConfig) {
  // Passthrough static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js/vendor");
  eleventyConfig.addPassthroughCopy("src/svgs");
  eleventyConfig.addPassthroughCopy("src/js/*.js");

  // Watch the svgs folder so changes trigger a rebuild
  eleventyConfig.addWatchTarget("src/svgs/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
  };
};
