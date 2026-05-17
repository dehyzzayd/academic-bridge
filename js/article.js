function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderContent(content) {
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

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setHtml(id, value) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = value;
}

async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (!slug) {
    setText("article-title", "Article not found");
    setText("article-excerpt", "No article slug was provided in the URL.");
    setHtml(
      "article-content",
      '<p>Please return to the <a href="blog.html">blog index</a> and pick an article.</p>'
    );
    return;
  }
  try {
    const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      setText("article-title", "Article not found");
      setText("article-excerpt", "We could not load that article. It may have been moved or unpublished.");
      setHtml(
        "article-content",
        '<p>Browse the <a href="blog.html">blog</a> for current guides.</p>'
      );
      return;
    }
    const { article } = await res.json();
    document.title = `${article.metaTitle || article.title} - Academic Bridge`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", article.metaDescription || article.excerpt || "");
    setText("article-category", article.category || "Academic guide");
    setText("article-title", article.title);
    setText("article-excerpt", article.excerpt || "");
    const cover = article.coverImage
      ? `<img src="${escapeHtml(article.coverImage)}" alt="${escapeHtml(article.title)}" loading="lazy">`
      : "";
    const disclaimer = `<div class="policy-box">This guide is educational. For paid support, all communication, payment, delivery, and revisions are handled through Fiverr.</div>`;
    setHtml("article-content", `${cover}${disclaimer}${renderContent(article.content)}`);
  } catch {
    setText("article-title", "Article not available");
    setText("article-excerpt", "Network error while loading the article.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadArticle, { once: true });
} else {
  loadArticle();
}
