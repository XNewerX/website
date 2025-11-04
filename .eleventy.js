// .eleventy.js
const { DateTime } = require('luxon');
const readingTime = require('eleventy-plugin-reading-time');
const pluginRss = require('@11ty/eleventy-plugin-rss');
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

// Umgebung
const env = process.env.ELEVENTY_ENV || 'development';
const isDev = env === 'development';
const isProd = env === 'production';

// Manifest-Pfad (nur relevant, wenn du bundlest)
const manifestPath = path.resolve(__dirname, 'public', 'assets', 'manifest.json');
const manifestExists = fs.existsSync(manifestPath);

// ⚠️ Wir bleiben bei deinen Ordnern css/js, KEIN assets/
// (Wenn du später bundlest, kannst du das Manifest nutzen.)
const manifest = isDev || !manifestExists
  ? { 'main.js': 'js/main.js', 'main.css': 'css/main.css' }
  : JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

module.exports = function (eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(readingTime);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(syntaxHighlight);

  // Markdown-Engine + Filter
  const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
  eleventyConfig.setLibrary('md', md);
  eleventyConfig.addFilter('markdownify', (str) => md.render(str || ''));

  // Mermaid-Highlighter (als Codeblocksprache ` ```mermaid `)
  const highlighter = eleventyConfig.markdownHighlighter;
  eleventyConfig.addMarkdownHighlighter((str, language) => {
    if (language === 'mermaid') return `<pre class="mermaid">${str}</pre>`;
    return highlighter(str, language);
  });

  eleventyConfig.setDataDeepMerge(true);

  // Passthroughs
  eleventyConfig.addPassthroughCopy({ 'src/images': 'images' });
  eleventyConfig.addPassthroughCopy({ 'src/css': 'css' });
  eleventyConfig.addPassthroughCopy({ 'src/js':  'js'  });

  // Live-Reload auf manifest.json (stört nicht, wenn nicht vorhanden)
  eleventyConfig.setBrowserSyncConfig({ files: [manifestPath] });

  // Shortcodes: CSS/JS einbinden (über |url und führenden Slash)
  const urlFilter = eleventyConfig.getFilter('url');

  eleventyConfig.addShortcode('bundledcss', function () {
    const p = manifest['main.css'];
    if (!p) return '';
    const href = urlFilter(p.startsWith('/') ? p : '/' + p);
    return `<link rel="stylesheet" href="${href}">`;
  });

  eleventyConfig.addShortcode('bundledjs', function () {
    const p = manifest['main.js'];
    if (!p) return '';
    const src = urlFilter(p.startsWith('/') ? p : '/' + p);
    return `<script src="${src}"></script>`;
  });

  // Filter
  eleventyConfig.addFilter('excerpt', (post) => {
    const content = (post || '').replace(/(<([^>]+)>)/gi, '');
    const cut = content.lastIndexOf(' ', 200);
    return (cut > 0 ? content.substr(0, cut) : content.substr(0, 200)) + '…';
  });

  eleventyConfig.addFilter('readableDate', (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('dd LLL yyyy')
  );

  eleventyConfig.addFilter('htmlDateString', (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('yyyy-LL-dd')
  );

  eleventyConfig.addFilter('dateToIso', (dateString) =>
    new Date(dateString).toISOString()
  );

  eleventyConfig.addFilter('head', (array, n) => {
    if (!Array.isArray(array)) return array;
    return n < 0 ? array.slice(n) : array.slice(0, n);
  });

  // Collections & Tag-Filter
  eleventyConfig.addCollection('tagList', (collection) => {
    const tagSet = new Set();
    collection.getAll().forEach((item) => {
      if ('tags' in item.data) {
        (item.data.tags || [])
          .filter((t) => !['all', 'nav', 'post', 'posts'].includes(t))
          .forEach((t) => tagSet.add(t));
      }
    });
    return [...tagSet];
  });

  eleventyConfig.addFilter('pageTags', (tags) => {
    const general = ['all', 'nav', 'post', 'posts'];
    return (tags || []).toString().split(',').filter((t) => !general.includes(t));
  });

  // Finale Eleventy-Konfiguration
  return {
    dir: {
      input: 'src',
      output: 'public',
      includes: 'includes',
      data: 'data',
      layouts: 'layouts',
    },
    passthroughFileCopy: true,
    templateFormats: ['html', 'njk', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    // Falls GitHub Pages unter /website/ läuft, dann aktivieren:
    // pathPrefix: isProd ? '/website/' : '/',
  };
};
