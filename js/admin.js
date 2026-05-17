const STATUS_OPTIONS = ["new", "contacted", "qualified", "ordered", "closed", "spam"];

const state = {
  leads: [],
  articles: [],
  leadFilter: { status: "", search: "" }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function setMessage(form, text, ok) {
  const node = form.querySelector(".form-message");
  if (!node) return;
  node.textContent = text;
  node.classList.add("is-visible");
  node.dataset.state = ok ? "ok" : "error";
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const err = new Error(payload?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return payload;
}

async function checkSession() {
  try {
    const data = await api("/api/admin/session");
    return Boolean(data?.authenticated);
  } catch {
    return false;
  }
}

function showApp() {
  $("#admin-login")?.classList.add("hidden");
  $("#admin-app")?.classList.remove("hidden");
  $("#admin-logout")?.classList.remove("hidden");
}

function showLogin() {
  $("#admin-app")?.classList.add("hidden");
  $("#admin-login")?.classList.remove("hidden");
  $("#admin-logout")?.classList.add("hidden");
}

function setupLogin() {
  const form = $("#admin-login-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.querySelector("input[name='email']").value.trim();
    const password = form.querySelector("input[name='password']").value;
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setMessage(form, "Signed in. Loading dashboard...", true);
      form.reset();
      showApp();
      await refreshAll();
    } catch (error) {
      setMessage(form, error.message || "Login failed.", false);
    }
  });
}

function setupLogout() {
  const btn = $("#admin-logout");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Signing out...";
    try {
      await api("/api/admin/logout", { method: "POST" });
    } catch {
      // ignore
    }
    window.location.replace("/admin.html");
  });
}

function setupTabs() {
  $$(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-admin-tab");
      $$(".admin-tab").forEach((node) => node.classList.toggle("is-active", node === tab));
      $$(".admin-panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.id === `panel-${target}`);
      });
    });
  });
}

async function loadSummary() {
  const data = await api("/api/admin/summary");
  const totals = data.totals || {};
  const kpis = [
    { label: "Total leads", value: totals.leads ?? 0 },
    { label: "New leads", value: totals.newLeads ?? 0 },
    { label: "Published articles", value: totals.publishedArticles ?? 0 },
    { label: "Draft articles", value: totals.drafts ?? 0 }
  ];
  $("#admin-kpis").innerHTML = kpis
    .map(
      (kpi) =>
        `<div class="admin-kpi"><span>${escapeHtml(kpi.label)}</span><strong>${escapeHtml(
          kpi.value
        )}</strong></div>`
    )
    .join("");

  $("#recent-leads").innerHTML = (data.recentLeads || []).length
    ? `<ul class="admin-recent">${data.recentLeads
        .map(
          (lead) =>
            `<li><strong>${escapeHtml(lead.fullName || "Anonymous")}</strong><span>${escapeHtml(
              lead.subject || lead.projectType || ""
            )}</span><small>${escapeHtml(fmtDate(lead.createdAt))}</small></li>`
        )
        .join("")}</ul>`
    : "<p>No inquiries yet.</p>";

  $("#recent-articles").innerHTML = (data.recentArticles || []).length
    ? `<ul class="admin-recent">${data.recentArticles
        .map(
          (article) =>
            `<li><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(
              article.status
            )} - ${escapeHtml(article.category || "")}</span><small>${escapeHtml(
              fmtDate(article.updatedAt)
            )}</small></li>`
        )
        .join("")}</ul>`
    : "<p>No articles yet.</p>";
}

function renderLeadsTable() {
  const wrap = $("#lead-table-wrap");
  if (!wrap) return;
  const { status, search } = state.leadFilter;
  const term = search.trim().toLowerCase();
  const filtered = state.leads.filter((lead) => {
    if (status && lead.status !== status) return false;
    if (!term) return true;
    return [
      lead.fullName,
      lead.email,
      lead.phone,
      lead.subject,
      lead.projectType,
      lead.school,
      lead.question
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const filterBar = `
    <div class="admin-filter">
      <input id="lead-search" type="search" placeholder="Search name, email, subject..." value="${escapeHtml(search)}">
      <select id="lead-status-filter">
        <option value="">All statuses</option>
        ${STATUS_OPTIONS.map(
          (option) =>
            `<option value="${option}" ${option === status ? "selected" : ""}>${option}</option>`
        ).join("")}
      </select>
      <span class="admin-count">${filtered.length} / ${state.leads.length}</span>
    </div>
  `;

  if (!filtered.length) {
    wrap.innerHTML = `${filterBar}<p class="empty-state">No leads match the current filter.</p>`;
  } else {
    wrap.innerHTML = `${filterBar}
      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Contact</th>
              <th>Project</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                (lead) => `
                <tr data-lead-id="${escapeHtml(lead.id)}">
                  <td>
                    <div>${escapeHtml(fmtDate(lead.createdAt))}</div>
                    <small>${escapeHtml(lead.source || "")}</small>
                  </td>
                  <td>
                    <strong>${escapeHtml(lead.fullName)}</strong><br>
                    <a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a><br>
                    <small>${escapeHtml(lead.phone)}</small>
                  </td>
                  <td>
                    <strong>${escapeHtml(lead.subject || lead.projectType || "")}</strong><br>
                    <small>${escapeHtml(lead.projectType || "")} - ${escapeHtml(lead.academicLevel || "")}</small><br>
                    <small>${escapeHtml(lead.school || "")}</small>
                    <details><summary>Question</summary><p>${escapeHtml(lead.question || "")}</p></details>
                  </td>
                  <td>${escapeHtml(lead.deadline || "")}</td>
                  <td>
                    <select data-lead-status>
                      ${STATUS_OPTIONS.map(
                        (option) =>
                          `<option value="${option}" ${option === lead.status ? "selected" : ""}>${option}</option>`
                      ).join("")}
                    </select>
                  </td>
                  <td><textarea data-lead-notes rows="2" placeholder="Private notes...">${escapeHtml(lead.notes || "")}</textarea></td>
                  <td class="admin-actions">
                    <button class="btn btn-blue btn-sm" type="button" data-save-lead>Save</button>
                    <button class="btn btn-light btn-sm" type="button" data-delete-lead>Delete</button>
                  </td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  $("#lead-search")?.addEventListener("input", (event) => {
    state.leadFilter.search = event.target.value;
    renderLeadsTable();
    requestAnimationFrame(() => $("#lead-search")?.focus());
  });
  $("#lead-status-filter")?.addEventListener("change", (event) => {
    state.leadFilter.status = event.target.value;
    renderLeadsTable();
  });

  wrap.querySelectorAll("[data-save-lead]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const id = row.getAttribute("data-lead-id");
      const status = row.querySelector("[data-lead-status]").value;
      const notes = row.querySelector("[data-lead-notes]").value;
      btn.disabled = true;
      btn.textContent = "Saving...";
      try {
        const { lead } = await api(`/api/admin/leads/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status, notes })
        });
        const index = state.leads.findIndex((item) => item.id === id);
        if (index !== -1) state.leads[index] = lead;
        btn.textContent = "Saved";
        setTimeout(() => {
          btn.textContent = "Save";
          btn.disabled = false;
        }, 1200);
      } catch (error) {
        btn.textContent = "Save";
        btn.disabled = false;
        alert(error.message || "Could not update lead.");
      }
    });
  });

  wrap.querySelectorAll("[data-delete-lead]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const id = row.getAttribute("data-lead-id");
      if (!confirm("Delete this lead permanently?")) return;
      try {
        await api(`/api/admin/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
        state.leads = state.leads.filter((lead) => lead.id !== id);
        renderLeadsTable();
        loadSummary().catch(() => {});
      } catch (error) {
        alert(error.message || "Could not delete lead.");
      }
    });
  });
}

async function loadLeads() {
  const data = await api("/api/admin/leads");
  state.leads = data.leads || [];
  renderLeadsTable();
}

function resetArticleForm() {
  const form = $("#article-form");
  if (!form) return;
  form.reset();
  form.querySelector("input[name='id']").value = "";
  setMessage(form, "", true);
  form.querySelector(".form-message")?.classList.remove("is-visible");
}

function fillArticleForm(article) {
  const form = $("#article-form");
  if (!form) return;
  const fields = [
    "id",
    "title",
    "slug",
    "category",
    "status",
    "excerpt",
    "coverImage",
    "tags",
    "metaTitle",
    "metaDescription",
    "content"
  ];
  fields.forEach((name) => {
    const node = form.querySelector(`[name='${name}']`);
    if (node) node.value = article[name] ?? "";
  });
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderArticleList() {
  const target = $("#article-list");
  if (!target) return;
  if (!state.articles.length) {
    target.innerHTML = "<p>No articles yet. Create your first guide.</p>";
    return;
  }
  target.innerHTML = state.articles
    .map(
      (article) => `
        <article class="admin-article-row" data-article-id="${escapeHtml(article.id)}">
          <header>
            <strong>${escapeHtml(article.title)}</strong>
            <span class="badge badge-${article.status === "published" ? "ok" : "draft"}">${escapeHtml(article.status)}</span>
          </header>
          <p>${escapeHtml(article.excerpt || "")}</p>
          <small>${escapeHtml(article.category || "")} - updated ${escapeHtml(fmtDate(article.updatedAt))}</small>
          <div class="admin-actions">
            <button class="btn btn-blue btn-sm" type="button" data-edit-article>Edit</button>
            <a class="btn btn-light btn-sm" href="/blog/${encodeURIComponent(article.slug)}" target="_blank" rel="noopener">View</a>
            <button class="btn btn-light btn-sm" type="button" data-delete-article>Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  target.querySelectorAll("[data-edit-article]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest("[data-article-id]").getAttribute("data-article-id");
      const article = state.articles.find((item) => item.id === id);
      if (article) fillArticleForm(article);
    });
  });
  target.querySelectorAll("[data-delete-article]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("[data-article-id]").getAttribute("data-article-id");
      if (!confirm("Delete this article permanently?")) return;
      try {
        await api(`/api/admin/articles/${encodeURIComponent(id)}`, { method: "DELETE" });
        state.articles = state.articles.filter((article) => article.id !== id);
        renderArticleList();
        loadSummary().catch(() => {});
      } catch (error) {
        alert(error.message || "Could not delete article.");
      }
    });
  });
}

async function loadArticles() {
  const data = await api("/api/admin/articles");
  state.articles = data.articles || [];
  renderArticleList();
}

function setupArticleForm() {
  const form = $("#article-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const id = data.id;
    delete data.id;
    const submit = form.querySelector("button[type='submit']");
    const originalText = submit?.textContent;
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Saving...";
    }
    try {
      const response = await api(id ? `/api/admin/articles/${encodeURIComponent(id)}` : "/api/admin/articles", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(data)
      });
      const article = response.article;
      const index = state.articles.findIndex((item) => item.id === article.id);
      if (index === -1) state.articles.unshift(article);
      else state.articles[index] = article;
      renderArticleList();
      loadSummary().catch(() => {});
      setMessage(form, id ? "Article updated." : "Article created.", true);
      form.querySelector("input[name='id']").value = article.id;
    } catch (error) {
      setMessage(form, error.message || "Could not save article.", false);
    } finally {
      if (submit) {
        submit.disabled = false;
        if (originalText) submit.textContent = originalText;
      }
    }
  });
  $("#new-article")?.addEventListener("click", () => resetArticleForm());
}

function setupRefresh() {
  $("#admin-refresh")?.addEventListener("click", () => {
    refreshAll().catch((error) => console.error(error));
  });
}

async function refreshAll() {
  try {
    await Promise.all([loadSummary(), loadLeads(), loadArticles()]);
  } catch (error) {
    if (error.status === 403) {
      showLogin();
      return;
    }
    console.error(error);
  }
}

async function init() {
  setupLogin();
  setupLogout();
  setupTabs();
  setupArticleForm();
  setupRefresh();
  const authed = await checkSession();
  if (authed) {
    showApp();
    await refreshAll();
  } else {
    showLogin();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
