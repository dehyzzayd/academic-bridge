import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const LEADS_PATH = path.join(DATA_DIR, "leads.json");
const ARTICLES_PATH = path.join(DATA_DIR, "articles.json");
const ADMIN_EMAIL = (process.env.ACADEMIC_ADMIN_EMAIL || "dehyinbox@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ACADEMIC_ADMIN_PASSWORD || "password123";
const ADMIN_KEY = process.env.ACADEMIC_ADMIN_KEY || ADMIN_PASSWORD;
const SESSION_SECRET = process.env.ACADEMIC_SESSION_SECRET || `${ADMIN_EMAIL}:${ADMIN_PASSWORD}`;
const FIVERR_URL = process.env.FIVERR_URL || "https://www.fiverr.com/s/bdR74lX";
const SITE_URL = (process.env.SITE_URL || "https://example.com").replace(/\/$/, "");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".csv": "text/csv; charset=utf-8"
};

const defaultArticles = [
  {
    id: "article_pfe_structure",
    title: "How to Structure a PFE Report Step by Step",
    slug: "how-to-structure-pfe-report",
    excerpt: "A clear outline for introduction, literature review, methodology, results, conclusion, formatting, and appendices.",
    category: "PFE Guide",
    tags: "PFE, final year project, report structure",
    coverImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80",
    metaTitle: "How to Structure a PFE Report Step by Step",
    metaDescription: "Learn how to structure a PFE report with introduction, literature review, methodology, findings, conclusion, formatting tips, and ethical support guidance.",
    status: "published",
    content: "A strong PFE report starts with a clear project purpose. Explain the context, problem, objectives, research questions, scope, and expected contribution.\n\nUse a logical chapter sequence:\n- Introduction: context, problem, objectives, research questions, scope\n- Literature review: concepts, theories, previous studies, and research gap\n- Methodology: approach, tools, sampling, data collection, and limitations\n- Results or implementation: findings, analysis, prototype, case study, or applied work\n- Conclusion: outcomes, recommendations, limits, and future work\n\nBefore final review, check headings, table of contents, page numbers, figures, captions, references, appendices, margins, and university template rules.\n\nEthical academic support can help you improve structure, formatting, citations, proofreading, and presentation clarity. It should not replace your own research, analysis, or institutional responsibilities.",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  },
  {
    id: "article_apa_basics",
    title: "APA Citation Basics for Academic Reports",
    slug: "apa-citation-basics-academic-reports",
    excerpt: "Understand in-text citations, reference lists, online sources, citation consistency, and common APA mistakes.",
    category: "APA Citation",
    tags: "APA, citations, references",
    coverImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80",
    metaTitle: "APA Citation Basics for Academic Reports",
    metaDescription: "Learn the basics of APA in-text citations, reference lists, online sources, citation consistency, and common mistakes in academic reports.",
    status: "published",
    content: "APA citations help readers identify where ideas, data, and quotations come from. A complete academic report usually needs both in-text citations and a reference list.\n\nIn-text citations usually include the author's name and year. Direct quotations also need page or paragraph information where available.\n\nReference list checklist:\n- Every cited source should appear in the reference list\n- Every reference list entry should be cited in the text\n- Author names, years, titles, journal names, links, and formatting should stay consistent\n\nCommon mistakes include mixing citation styles, forgetting retrieval information, citing sources not listed in references, or listing references that never appear in the report.",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  },
  {
    id: "article_methodology_guide",
    title: "Research Methodology Guide for Students",
    slug: "research-methodology-guide-students",
    excerpt: "Connect research questions, design, sampling, tools, data collection, limitations, and ethical considerations.",
    category: "Research Methodology",
    tags: "methodology, research design, sampling",
    coverImage: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
    metaTitle: "Research Methodology Guide for Students",
    metaDescription: "Learn how to explain research methodology, design, sampling, data collection tools, limitations, and alignment with research questions.",
    status: "published",
    content: "Your methodology should explain how your method helps answer the research question. If the question asks about experiences, qualitative methods may fit. If it asks about measurement or comparison, quantitative methods may fit.\n\nDescribe whether the study is qualitative, quantitative, mixed, descriptive, exploratory, experimental, or case-based. Then explain why that design makes sense.\n\nYour methodology section should cover:\n- Who or what is studied\n- How participants, documents, or cases were selected\n- What tools are used, such as questionnaires, interviews, observations, datasets, or document analysis\n- What limitations affect scope, access, time, sample size, or data quality\n\nLimitations do not ruin a project. They show that you understand your research realistically.",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z"
  }
];

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function createId(prefix = "item") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function cleanText(value, max = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanLongText(value, max = 20000) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugify(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || `article-${Date.now()}`;
}

function normalizeLead(body, existing = {}) {
  return {
    id: existing.id || createId("lead"),
    createdAt: existing.createdAt || new Date().toISOString(),
    fullName: cleanText(body.fullName, 140),
    email: cleanEmail(body.email),
    phone: cleanText(body.phone, 80),
    projectType: cleanText(body.projectType, 80),
    academicLevel: cleanText(body.academicLevel, 120),
    school: cleanText(body.school, 160),
    subject: cleanText(body.subject, 220),
    deadline: cleanText(body.deadline, 80),
    language: cleanText(body.language, 80),
    question: cleanLongText(body.question, 2200).replace(/\n/g, " "),
    source: cleanText(body.source || existing.source || "website-form", 120),
    consent: Boolean(body.consent ?? existing.consent),
    status: cleanText(body.status || existing.status || "new", 40),
    notes: cleanLongText(body.notes ?? existing.notes ?? "", 2000),
    updatedAt: new Date().toISOString()
  };
}

function normalizeArticle(body, existing = {}) {
  const now = new Date().toISOString();
  const title = cleanText(body.title || existing.title, 180);
  return {
    id: existing.id || createId("article"),
    title,
    slug: slugify(body.slug || existing.slug || title),
    excerpt: cleanText(body.excerpt || existing.excerpt, 320),
    category: cleanText(body.category || existing.category || "Academic Writing", 80),
    tags: cleanText(body.tags || existing.tags, 240),
    coverImage: cleanText(body.coverImage || existing.coverImage, 500),
    metaTitle: cleanText(body.metaTitle || existing.metaTitle || title, 180),
    metaDescription: cleanText(body.metaDescription || existing.metaDescription || body.excerpt || existing.excerpt, 260),
    status: ["draft", "published"].includes(body.status) ? body.status : (existing.status || "draft"),
    content: cleanLongText(body.content || existing.content, 20000),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

async function ensureJson(file, initialValue) {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(file)) {
    await writeFile(file, `${JSON.stringify(initialValue, null, 2)}\n`, "utf8");
  }
}

async function ensureStore() {
  await ensureJson(LEADS_PATH, []);
  await ensureJson(ARTICLES_PATH, defaultArticles);
}

async function readJson(file, initialValue) {
  await ensureJson(file, initialValue);
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw || JSON.stringify(initialValue));
}

async function writeJson(file, value) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const readLeads = () => readJson(LEADS_PATH, []);
const writeLeads = (leads) => writeJson(LEADS_PATH, leads);
const readArticles = () => readJson(ARTICLES_PATH, defaultArticles);
const writeArticles = (articles) => writeJson(ARTICLES_PATH, articles);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function parseCookies(req) {
  const cookie = req.headers.cookie || "";
  return Object.fromEntries(
    cookie
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key]) => key)
      .map(([key, ...value]) => [decodeURIComponent(key), decodeURIComponent(value.join("="))])
  );
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function createAdminSessionCookie() {
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload = `admin:${expires}`;
  const token = `${payload}:${sign(payload)}`;
  return `academic_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`;
}

function clearAdminCookie() {
  return "academic_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function hasValidAdminCookie(req) {
  const token = parseCookies(req).academic_admin;
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [role, expires, signature] = parts;
  if (role !== "admin" || Number(expires) < Date.now()) return false;
  const expected = sign(`${role}:${expires}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireAdmin(req, url) {
  const providedKey = req.headers["x-admin-key"] || url.searchParams.get("key");
  return providedKey === ADMIN_KEY || hasValidAdminCookie(req);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function leadsToCsv(leads) {
  const columns = ["createdAt", "fullName", "email", "phone", "projectType", "academicLevel", "school", "subject", "deadline", "language", "question", "source", "status", "notes"];
  const rows = leads.map((lead) => columns.map((column) => csvEscape(lead[column])).join(","));
  return `${columns.join(",")}\n${rows.join("\n")}\n`;
}

function publicArticle(article) {
  return {
    ...article,
    isPublished: article.status === "published"
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderArticleContent(content) {
  return String(content || "")
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      if (lines.every((line) => line.trim().startsWith("- "))) {
        return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^\s*-\s*/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.length === 1 && lines[0].startsWith("## ")) {
        return `<h2>${escapeHtml(lines[0].replace(/^##\s*/, ""))}</h2>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

function renderArticleHtml(article) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(article.metaTitle || article.title)} - Academic Bridge</title>
    <meta name="description" content="${escapeHtml(article.metaDescription || article.excerpt)}">
    <link rel="canonical" href="${SITE_URL}/blog/${escapeHtml(article.slug)}">
    <meta property="og:title" content="${escapeHtml(article.title)}">
    <meta property="og:description" content="${escapeHtml(article.excerpt)}">
    <meta property="og:type" content="article">
    ${article.coverImage ? `<meta property="og:image" content="${escapeHtml(article.coverImage)}">` : ""}
    <link rel="stylesheet" href="/css/styles.css">
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: article.excerpt,
      datePublished: article.createdAt,
      dateModified: article.updatedAt,
      image: article.coverImage || undefined,
      author: { "@type": "Organization", name: "Academic Bridge" },
      publisher: { "@type": "Organization", name: "Academic Bridge" },
      mainEntityOfPage: `${SITE_URL}/blog/${article.slug}`
    })}</script>
  </head>
  <body>
    <header class="site-header"><div class="nav-shell"><a class="brand" href="/index.html"><img class="brand-logo" src="/assets/logo.svg" alt="Academic Bridge"></a><button class="nav-toggle" type="button" aria-expanded="false" aria-label="Open menu">Menu</button><nav class="site-nav"><a href="/index.html">Home</a><a href="/services.html">Services</a><a href="/portfolio.html">Portfolio</a><a class="is-active" href="/blog.html">Blog</a><a href="/faq.html">FAQ</a><a href="/about.html">About</a><a href="/contact.html">Contact</a></nav><div class="nav-actions"><a class="btn btn-gold" href="#" data-fiverr-link data-campaign="server_article_header">Contact Me on Fiverr</a></div></div></header>
    <main>
      <section class="page-hero"><div class="container"><p class="eyebrow">${escapeHtml(article.category)}</p><h1>${escapeHtml(article.title)}</h1><p class="lead">${escapeHtml(article.excerpt)}</p></div></section>
      <section class="section"><div class="container article-layout"><article class="article-body">${article.coverImage ? `<img src="${escapeHtml(article.coverImage)}" alt="${escapeHtml(article.title)}">` : ""}<div class="policy-box">This guide is educational. For paid support, all communication, payment, delivery, and revisions are handled through Fiverr.</div>${renderArticleContent(article.content)}</article><aside class="sidebar-cta card"><div class="card-body"><span class="kicker">Ethical support</span><h3>Need help applying this to your project?</h3><p>Discuss formatting, citations, proofreading, structure, or methodology guidance safely through Fiverr.</p><a class="btn btn-gold" href="#" data-fiverr-link data-campaign="server_article_sidebar">Discuss on Fiverr</a></div></aside></div></section>
    </main>
    <footer class="site-footer"><div class="container footer-bottom"><span>Copyright <span data-year></span> Academic Bridge.</span><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/disclaimer.html">Disclaimer</a><a href="/cookie-policy.html">Cookies</a><a href="/editorial-policy.html">Editorial</a><a href="/advertising-policy.html">Advertising</a><a href="/accessibility.html">Accessibility</a></div></footer>
    <a class="sticky-cta" href="#" data-fiverr-link data-campaign="server_article_sticky"><span class="btn btn-gold">Discuss on Fiverr</span></a>
    <script src="/js/main.js" type="module"></script>
  </body>
</html>`;
}

async function renderSitemap() {
  const staticPages = [
    "",
    "services.html",
    "portfolio.html",
    "blog.html",
    "about.html",
    "contact.html",
    "faq.html",
    "privacy.html",
    "terms.html",
    "disclaimer.html",
    "cookie-policy.html",
    "editorial-policy.html",
    "advertising-policy.html",
    "accessibility.html"
  ];
  const articles = (await readArticles()).filter((article) => article.status === "published");
  const urls = [
    ...staticPages.map((page) => `${SITE_URL}/${page}`),
    ...articles.map((article) => `${SITE_URL}/blog/${article.slug}`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((loc) => `  <url><loc>${escapeHtml(loc)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "Academic Fiverr Funnel" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, { fiverrUrl: FIVERR_URL });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/articles") {
    const articles = (await readArticles())
      .filter((article) => article.status === "published")
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    sendJson(res, 200, { articles: articles.map(publicArticle), total: articles.length });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/articles/")) {
    const slug = decodeURIComponent(url.pathname.replace("/api/articles/", ""));
    const article = (await readArticles()).find((item) => item.slug === slug && item.status === "published");
    if (!article) {
      sendJson(res, 404, { error: "Article not found." });
      return;
    }
    sendJson(res, 200, { article: publicArticle(article) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/leads") {
    const body = await readBody(req);
    const lead = normalizeLead(body);
    if (!lead.fullName || !isEmail(lead.email) || !lead.phone || !lead.subject || !lead.deadline || !lead.question) {
      sendJson(res, 422, { error: "Please provide your name, email, phone number, subject, deadline, and project question." });
      return;
    }
    if (!lead.consent) {
      sendJson(res, 422, { error: "Please accept the privacy notice before submitting." });
      return;
    }
    const leads = await readLeads();
    leads.push(lead);
    await writeLeads(leads);
    sendJson(res, 201, {
      message: "Your inquiry was saved. Please continue to Fiverr for secure communication and ordering.",
      leadId: lead.id,
      fiverrUrl: FIVERR_URL
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readBody(req);
    const email = cleanEmail(body.email);
    const password = cleanText(body.password, 300);
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: "Invalid email or password." });
      return;
    }
    sendJson(res, 200, { ok: true, message: "Signed in." }, { "Set-Cookie": createAdminSessionCookie() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearAdminCookie() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/session") {
    sendJson(res, 200, { authenticated: hasValidAdminCookie(req) });
    return;
  }

  if (url.pathname.startsWith("/api/admin/") && !requireAdmin(req, url)) {
    sendJson(res, 403, { error: "Admin login required." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/summary") {
    const leads = await readLeads();
    const articles = await readArticles();
    sendJson(res, 200, {
      totals: {
        leads: leads.length,
        newLeads: leads.filter((lead) => lead.status === "new").length,
        articles: articles.length,
        publishedArticles: articles.filter((article) => article.status === "published").length,
        drafts: articles.filter((article) => article.status === "draft").length
      },
      recentLeads: leads.slice(-5).reverse(),
      recentArticles: articles.slice(-5).reverse()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/leads") {
    const leads = await readLeads();
    sendJson(res, 200, { leads: leads.slice().reverse(), total: leads.length });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/leads/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/admin/leads/", ""));
    const body = await readBody(req);
    const leads = await readLeads();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Lead not found." });
      return;
    }
    leads[index] = normalizeLead({ ...leads[index], ...body, consent: leads[index].consent }, leads[index]);
    await writeLeads(leads);
    sendJson(res, 200, { lead: leads[index], message: "Lead updated." });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/leads/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/admin/leads/", ""));
    const leads = await readLeads();
    const nextLeads = leads.filter((lead) => lead.id !== id);
    await writeLeads(nextLeads);
    sendJson(res, 200, { ok: true, message: "Lead deleted." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/leads.csv") {
    const leads = await readLeads();
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=academic-leads.csv",
      "Cache-Control": "no-store"
    });
    res.end(leadsToCsv(leads));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/articles") {
    const articles = (await readArticles()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    sendJson(res, 200, { articles, total: articles.length });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/articles") {
    const body = await readBody(req);
    const article = normalizeArticle(body);
    if (!article.title || !article.excerpt || !article.content) {
      sendJson(res, 422, { error: "Article title, excerpt, and content are required." });
      return;
    }
    const articles = await readArticles();
    if (articles.some((item) => item.slug === article.slug)) {
      article.slug = `${article.slug}-${crypto.randomInt(100, 999)}`;
    }
    articles.push(article);
    await writeArticles(articles);
    sendJson(res, 201, { article, message: "Article created." });
    return;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/admin/articles/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/admin/articles/", ""));
    const body = await readBody(req);
    const articles = await readArticles();
    const index = articles.findIndex((article) => article.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Article not found." });
      return;
    }
    const updated = normalizeArticle(body, articles[index]);
    const duplicate = articles.find((article) => article.id !== id && article.slug === updated.slug);
    if (duplicate) {
      sendJson(res, 409, { error: "Another article already uses that slug." });
      return;
    }
    articles[index] = updated;
    await writeArticles(articles);
    sendJson(res, 200, { article: updated, message: "Article updated." });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/articles/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/admin/articles/", ""));
    const articles = await readArticles();
    const nextArticles = articles.filter((article) => article.id !== id);
    await writeArticles(nextArticles);
    sendJson(res, 200, { ok: true, message: "Article deleted." });
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

function resolveStaticPath(url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  if (!path.extname(pathname)) pathname += ".html";
  return path.normalize(path.join(__dirname, pathname));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/sitemap.xml") {
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(await renderSitemap());
    return;
  }
  if (url.pathname.startsWith("/blog/")) {
    const slug = decodeURIComponent(url.pathname.replace(/^\/blog\//, "").replace(/\/$/, ""));
    const article = (await readArticles()).find((item) => item.slug === slug && item.status === "published");
    if (article) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(renderArticleHtml(article));
      return;
    }
  }
  const target = resolveStaticPath(url);
  if (!target.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const file = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    const cacheControl = [".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? "public, max-age=604800" : "no-cache";
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    res.end(file);
  } catch {
    const fallback = await readFile(path.join(__dirname, "404.html"), "utf8").catch(() => "Page not found");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fallback);
  }
}

let storeReady = ensureStore().catch((error) => {
  console.error("Failed to initialize data store", error);
});

export async function handler(req, res) {
  try {
    await storeReady;
    if (req.url?.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const server = createServer(handler);
  server.listen(PORT, () => {
    console.info(`Academic Fiverr funnel running at http://localhost:${PORT}`);
  });
}
