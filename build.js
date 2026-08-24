// build.js - Complete static site generator with SEO automation
const fs = require('fs');
const path = require('path');

const SRC = './src';
const OUT = './dist';
const SITE_URL = process.env.SITE_URL || 'https://your-site.netlify.app';

// --- MARKDOWN PARSER (Zero deps) ---
function parseMd(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupbl])/gm, m => m.trim() ? '<p>' + m : m);
}

// --- FRONTMATTER PARSER (Fixed for YAML arrays) ---
function parseFm(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: content };
  const data = {};
  m[1].split('\n').forEach(line => {
    const [k, ...v] = line.split(':');
    if (!k || !v.length) return;
    let val = v.join(':').trim();

    // Handle YAML-style arrays: [Item1, Item2] → ["Item1", "Item2"]
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1);
      data[k.trim()] = inner.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, ''));
    }
    // Handle quoted strings
    else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      data[k.trim()] = val.slice(1, -1);
    }
    // Handle single unquoted values
    else {
      data[k.trim()] = val;
    }
  });
  return { data, body: m[2] };
}

// --- LOAD ALL ARTICLES INTO MEMORY ---
const articles = [];
const authorsMap = {};
const articlesDir = `${SRC}/content/articles`;
const authorsDir = `${SRC}/content/authors`;

if (fs.existsSync(authorsDir)) {
  fs.readdirSync(authorsDir).filter(f=>f.endsWith('.md')).forEach(f => {
    const { data } = parseFm(fs.readFileSync(`${authorsDir}/${f}`,'utf8'));
    authorsMap[f.replace('.md','')] = data;
  });
}

if (fs.existsSync(articlesDir)) {
  fs.readdirSync(articlesDir).filter(f=>f.endsWith('.md')).forEach(f => {
    const raw = fs.readFileSync(`${articlesDir}/${f}`,'utf8');
    const { data, body } = parseFm(raw);
    data.slug = f.replace('.md','');
    data.bodyHtml = parseMd(body);
    data.authorData = authorsMap[data.author] || { name: data.author, credentials: '' };
    data.reviewerData = authorsMap[data.reviewer] || null;
    data.dateObj = new Date(data.date);
    data.reviewedDateObj = new Date(data.reviewedDate || data.date);
    articles.push(data);
  });
}
articles.sort((a,b) => b.dateObj - a.dateObj);

// --- RELATED ARTICLES ENGINE ---
function getRelated(article, count=3) {
  const cats = article.category || [];
  return articles
    .filter(a => a.slug !== article.slug)
    .map(a => ({
      ...a,
      score: (a.category||[]).filter(c => cats.includes(c)).length
    }))
    .sort((a,b) => b.score - a.score || b.dateObj - a.dateObj)
    .slice(0, count);
}

// --- ARTICLE TEMPLATE ---
function renderArticle(a) {
  const related = getRelated(a);
  const dateStr = a.dateObj.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
  const reviewedStr = a.reviewedDateObj.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
  const evidenceClass = `evidence-badge--${a.evidenceGrade||'moderate'}`;

  const relatedHtml = related.length ? `
    <aside class="related-articles" aria-labelledby="related-h">
      <h3 id="related-h">Related Reading</h3>
      <ul>${related.map(r => `<li><a href="/articles/${r.slug}.html">${r.title}</a></li>`).join('')}</ul>
    </aside>` : '';

  const breadcrumbSchema = JSON.stringify({
    "@context":"https://schema.org","@type":"BreadcrumbList",
    "itemListElement":[
      {"@type":"ListItem","position":1,"name":"Home","item":SITE_URL},
      {"@type":"ListItem","position":2,"name":"Articles","item":`${SITE_URL}/articles/`},
      {"@type":"ListItem","position":3,"name":a.title,"item":`${SITE_URL}/articles/${a.slug}.html`}
    ]
  });

  const articleSchema = JSON.stringify({
    "@context":"https://schema.org","@type":"Article",
    "headline":a.title,"description":a.description,
    "datePublished":a.dateObj.toISOString(),
    "dateModified":a.reviewedDateObj.toISOString(),
    "author":{"@type":"Person","name":a.authorData.name,"jobTitle":a.authorData.credentials},
    ...(a.reviewerData && {"reviewedBy":{"@type":"Person","name":a.reviewerData.name,"jobTitle":a.reviewerData.credentials}}),
    "citationCount":parseInt(a.studyCount)||0,
    "medicalAudience":"Patient",
    "image":`${SITE_URL}${a.image}`,
    "publisher":{"@type":"Organization","name":"EvidenceHealth","logo":{"@type":"ImageObject","url":`${SITE_URL}/favicon.svg`}}
  });

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${a.title} | EvidenceHealth</title>
<meta name="description" content="${a.description}">
<link rel="canonical" href="${SITE_URL}/articles/${a.slug}.html">
<meta property="og:title" content="${a.title}"><meta property="og:description" content="${a.description}">
<meta property="og:image" content="${SITE_URL}${a.image}"><meta property="og:type" content="article">
<meta property="article:published_time" content="${a.dateObj.toISOString()}">
<meta property="article:modified_time" content="${a.reviewedDateObj.toISOString()}">
<link rel="stylesheet" href="/styles/main.css">
<script type="application/ld+json">${breadcrumbSchema}</script>
<script type="application/ld+json">${articleSchema}</script>
</head><body>
<a href="#main" class="skip-link">Skip to content</a>
<header class="site-header"><div class="container header__inner">
<a href="/" class="logo">EvidenceHealth</a>
<nav aria-label="Primary"><ul class="nav__list"><li><a href="/articles/">Articles</a></li><li><a href="/tools/">Tools</a></li></ul></nav>
</div></header>
<main id="main" class="container article-page">
<nav aria-label="Breadcrumb" class="breadcrumb"><ol>
<li><a href="/">Home</a></li><li><a href="/articles/">Articles</a></li><li aria-current="page">${a.title}</li>
</ol></nav>
<span class="evidence-badge ${evidenceClass}">Evidence: ${(a.evidenceGrade||'moderate').toUpperCase()}</span>
<h1>${a.title}</h1>
<div class="article__meta">
<strong>${a.authorData.name}${a.authorData.credentials?', '+a.authorData.credentials:''}</strong>
<time datetime="${a.dateObj.toISOString()}">${dateStr}</time>
${a.reviewerData ? `<span>· Reviewed by ${a.reviewerData.name} on <time datetime="${a.reviewedDateObj.toISOString()}">${reviewedStr}</time></span>` : ''}
<span>· 📚 ${a.studyCount||0} studies cited</span>
</div>
<article class="article__body">${a.bodyHtml}</article>
${relatedHtml}
</main>
<footer class="site-footer container"><p>&copy; 2026 EvidenceHealth. Not medical advice.</p></footer>
</body></html>`;
}

// --- BUILD PROCESS ---
fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(`${OUT}/articles`,{recursive:true});
fs.cpSync(`${SRC}/styles`,`${OUT}/styles`,{recursive:true});
fs.cpSync(`${SRC}/scripts`,`${OUT}/scripts`,{recursive:true});
fs.cpSync(`./adminsector`, `${OUT}/adminsector`, { recursive: true });
if(fs.existsSync(`${SRC}/assets`)) fs.cpSync(`${SRC}/assets`,`${OUT}/assets`,{recursive:true});

// Build articles
articles.forEach(a => {
  fs.writeFileSync(`${OUT}/articles/${a.slug}.html`, renderArticle(a));
  console.log(`✓ /articles/${a.slug}.html`);
});

// Build homepage
if(fs.existsSync(`${SRC}/index.html`)) {
  let indexHtml = fs.readFileSync(`${SRC}/index.html`,'utf8');
  const latestCards = articles.slice(0,6).map(a => `
    <li class="news-card" style="--cat-color:var(--color-${(a.category||['health'])[0].toLowerCase().replace(/\s/g,'')})">
      <span class="news-card__category">${(a.category||['Health'])[0]}</span>
      <h3><a href="/articles/${a.slug}.html">${a.title}</a></h3>
      <div class="news-card__footer"><span>${a.authorData.name}</span><span class="news-card__studies">📚 ${a.studyCount||0}</span></div>
    </li>`).join('');
  indexHtml = indexHtml.replace('<!-- DYNAMIC_ARTICLES -->', latestCards);
  fs.writeFileSync(`${OUT}/index.html`, indexHtml);
  console.log('✓ /index.html');
}

// Generate sitemap.xml
const sitemapUrls = ['/', '/articles/', '/tools/'];
articles.forEach(a => sitemapUrls.push(`/articles/${a.slug}.html`));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `<url><loc>${SITE_URL}${u}</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod></url>`).join('\n')}
</urlset>`;
fs.writeFileSync(`${OUT}/sitemap.xml`, sitemap);
console.log('✓ /sitemap.xml');

// Generate RSS feed
const rssItems = articles.slice(0,20).map(a => `
<item>
  <title>${a.title}</title>
  <link>${SITE_URL}/articles/${a.slug}.html</link>
  <description>${a.description}</description>
  <pubDate>${a.dateObj.toUTCString()}</pubDate>
  <guid>${SITE_URL}/articles/${a.slug}.html</guid>
</item>`).join('');
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>EvidenceHealth</title><link>${SITE_URL}</link><description>Evidence-based health research</description>
${rssItems}
</channel></rss>`;
fs.writeFileSync(`${OUT}/feed.xml`, rss);
console.log('✓ /feed.xml');

// Generate search index
const searchIndex = articles.map(a => ({
  slug: a.slug, title: a.title, description: a.description,
  category: a.category, date: a.dateObj.toISOString().split('T')[0]
}));
fs.writeFileSync(`${OUT}/search-index.json`, JSON.stringify(searchIndex));
console.log('✓ /search-index.json');

// Copy 404 page
if(fs.existsSync(`${SRC}/404.html`)) {
  fs.copyFileSync(`${SRC}/404.html`, `${OUT}/404.html`);
  console.log('✓ /404.html');
}

console.log(`\n✅ Built ${articles.length} articles + sitemap + RSS + search index`);
