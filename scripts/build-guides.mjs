// Builds the static guide pages, the guide index and sitemap.xml from
// content/guides/*.html. Each content file starts with a JSON header in an
// HTML comment: <!--{"slug": "...", "title": "...", ...}-->
// Usage: node scripts/build-guides.mjs
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://metroloom.net';
const AUTHOR = 'Anna Badanina';
const AUTHOR_NOTE = 'MSc in Metrology and Information-Measuring Technology';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const srcDir = join(root, 'content', 'guides');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function header(prefix, current) {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="${prefix}">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><use href="${prefix}assets/favicon.svg#mark"/></svg>
        <span>Metroloom</span>
      </a>
      <nav class="site-nav" aria-label="Main">
        ${link(prefix, 'Calculator', 'calc')}
        ${link(`${prefix}guides/`, 'Guides', 'guides')}
        <a href="https://github.com/BadaninaAnna/metroloom/blob/main/docs/VALIDATION.md">Validation</a>
      </nav>
    </div>
  </header>`;
}

function footer(prefix) {
  return `  <footer class="site-footer">
    <div class="wrap">
      <p><strong>Disclaimer.</strong> These guides explain published methods for learning purposes. They are not professional metrological advice;
        you remain responsible for your budgets and conformity decisions. See the <a href="${prefix}terms.html">terms of use</a>.</p>
      <p class="muted">© 2026 ${AUTHOR} · <a href="${prefix}privacy.html">Privacy</a> · <a href="${prefix}terms.html">Terms</a> ·
        <a href="https://github.com/BadaninaAnna/metroloom/blob/main/docs/VALIDATION.md">Validation</a> ·
        <a href="https://github.com/BadaninaAnna/metroloom">Source code</a></p>
    </div>
  </footer>`;
}

function head({ title, description, canonical, prefix, type = 'website', ld }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Metroloom">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${prefix}assets/styles.css">
${ld.map((o) => `  <script type="application/ld+json">${json(o)}</script>`).join('\n')}
</head>`;
}

async function loadGuides() {
  const files = (await readdir(srcDir)).filter((f) => f.endsWith('.html')).sort();
  return Promise.all(
    files.map(async (f) => {
      const text = await readFile(join(srcDir, f), 'utf8');
      const m = text.match(/^<!--(\{[\s\S]*?\})-->\s*/);
      if (!m) throw new Error(`${f}: missing JSON header`);
      const meta = JSON.parse(m[1]);
      for (const k of ['slug', 'title', 'h1', 'description', 'summary', 'published', 'example']) {
        if (!meta[k]) throw new Error(`${f}: missing "${k}"`);
      }
      return { ...meta, updated: meta.updated ?? meta.published, body: text.slice(m[0].length).trim() };
    }),
  );
}

function guidePage(g, all) {
  const prefix = '../../';
  const url = `${SITE}/guides/${g.slug}/`;
  const others = all.filter((o) => o.slug !== g.slug);
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.h1,
      description: g.description,
      datePublished: g.published,
      dateModified: g.updated,
      author: { '@type': 'Person', name: AUTHOR, description: AUTHOR_NOTE },
      publisher: { '@type': 'Organization', name: 'Metroloom', url: SITE },
      mainEntityOfPage: url,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Metroloom', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE}/guides/` },
        { '@type': 'ListItem', position: 3, name: g.h1, item: url },
      ],
    },
  ];
  return `${head({ title: g.title, description: g.description, canonical: url, prefix, type: 'article', ld })}
<body>
${header(prefix, 'guides')}

  <main class="wrap doc guide">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix}">Metroloom</a> › <a href="../">Guides</a></nav>
    <article>
      <h1>${esc(g.h1)}</h1>
      <p class="byline">By ${AUTHOR}, ${AUTHOR_NOTE} · ${formatDate(g.updated)}</p>
${indent(g.body, 6)}
    </article>

    <aside class="cta">
      <p><strong>Try it with your own numbers.</strong> The free Metroloom calculator builds the budget, finds k with Welch–Satterthwaite
        and checks conformity with the decision rule you choose. Nothing you type leaves your browser.</p>
      <a class="btn primary" href="${prefix}?example=${encodeURIComponent(g.example)}#budget">Open this example in the calculator</a>
    </aside>

    <nav class="related" aria-label="More guides">
      <h2>More guides</h2>
      <ul>
${others.map((o) => `        <li><a href="../${o.slug}/">${esc(o.h1)}</a></li>`).join('\n')}
      </ul>
    </nav>
  </main>

${footer(prefix)}
</body>
</html>
`;
}

function indexPage(all) {
  const prefix = '../';
  const url = `${SITE}/guides/`;
  const title = 'Measurement uncertainty guides — Metroloom';
  const description =
    'Practical guides to measurement uncertainty: budgets, Type A and Type B evaluation, coverage factor and Welch–Satterthwaite, ILAC G8 decision rules and TUR. With worked examples.';
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Measurement uncertainty guides',
      description,
      url,
      hasPart: all.map((g) => ({ '@type': 'Article', headline: g.h1, url: `${SITE}/guides/${g.slug}/` })),
    },
  ];
  return `${head({ title, description, canonical: url, prefix, ld })}
<body>
${header(prefix, 'guides')}

  <main class="wrap doc">
    <h1>Measurement uncertainty guides</h1>
    <p class="lead">Short, practical explanations of the methods behind the calculator, each with a worked example you can open and change.
      Written by a metrologist, based on JCGM 100:2008 (GUM), EA-4/02 M:2022 and ILAC G8:09/2019.</p>
    <ul class="guide-list">
${all
  .map(
    (g) => `      <li>
        <a href="${g.slug}/"><strong>${esc(g.h1)}</strong></a>
        <span>${esc(g.summary)}</span>
      </li>`,
  )
  .join('\n')}
    </ul>
  </main>

${footer(prefix)}
</body>
</html>
`;
}

function sitemap(all) {
  const today = all.reduce((d, g) => (g.updated > d ? g.updated : d), '2026-11-08');
  const urls = [
    [`${SITE}/`, today],
    [`${SITE}/guides/`, today],
    ...all.map((g) => [`${SITE}/guides/${g.slug}/`, g.updated]),
    [`${SITE}/privacy.html`, '2026-11-08'],
    [`${SITE}/terms.html`, '2026-11-08'],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([loc, mod]) => `  <url><loc>${loc}</loc><lastmod>${mod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function indent(html, n) {
  const pad = ' '.repeat(n);
  return html
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
}

const guides = await loadGuides();
for (const g of guides) {
  const dir = join(root, 'guides', g.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), guidePage(g, guides));
}
await writeFile(join(root, 'guides', 'index.html'), indexPage(guides));
await writeFile(join(root, 'sitemap.xml'), sitemap(guides));
console.log(`Built ${guides.length} guides, guides/index.html and sitemap.xml`);
