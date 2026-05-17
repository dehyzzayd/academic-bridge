const DEFAULT_FIVERR_URL = "https://www.fiverr.com/s/bdR74lX";

const state = {
  fiverrUrl: DEFAULT_FIVERR_URL
};

async function loadConfig() {
  try {
    const res = await fetch("/api/config", { headers: { Accept: "application/json" } });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.fiverrUrl) state.fiverrUrl = data.fiverrUrl;
  } catch {
    // Static hosting (e.g. GitHub Pages) — keep the default Fiverr URL.
  }
}

function applyFiverrLinks() {
  document.querySelectorAll("[data-fiverr-link]").forEach((node) => {
    const campaign = node.getAttribute("data-campaign") || "site";
    const url = new URL(state.fiverrUrl);
    url.searchParams.set("utm_source", "academic-bridge");
    url.searchParams.set("utm_medium", "website");
    url.searchParams.set("utm_campaign", campaign);
    node.setAttribute("href", url.toString());
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener");
    }
  });
}

function stampYear() {
  const year = new Date().getFullYear();
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(year);
  });
}

function setupNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupPopup() {
  const popup = document.querySelector(".popup-backdrop");
  if (!popup) return;

  const open = () => {
    popup.classList.add("is-open");
    popup.setAttribute("aria-hidden", "false");
    const firstInput = popup.querySelector("input, textarea, select");
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  };
  const close = () => {
    popup.classList.remove("is-open");
    popup.setAttribute("aria-hidden", "true");
  };

  popup.querySelectorAll("[data-close-popup]").forEach((node) => {
    node.addEventListener("click", close);
  });
  popup.addEventListener("click", (event) => {
    if (event.target === popup) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && popup.classList.contains("is-open")) close();
  });

  const openFromTrigger = (event) => {
    event.preventDefault();
    open();
  };

  document.querySelectorAll("[data-popup-trigger]").forEach((node) => {
    node.addEventListener("click", openFromTrigger);
  });

  document.querySelectorAll('.site-nav a[href$="contact.html"]').forEach((node) => {
    node.addEventListener("click", openFromTrigger);
  });
}

function setMessage(form, text, ok) {
  const node = form.querySelector(".form-message");
  if (!node) return;
  node.textContent = text;
  node.classList.add("is-visible");
  node.dataset.state = ok ? "ok" : "error";
}

function setupLeadForms() {
  document.querySelectorAll("form[data-lead-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.consent = form.querySelector('input[name="consent"]')?.checked ?? false;
      data.source = form.getAttribute("data-source") || "website-form";
      const submit = form.querySelector('button[type="submit"]');
      const originalText = submit?.textContent;
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Saving...";
      }
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(form, payload.error || "Could not save inquiry. Please try again.", false);
          return;
        }
        setMessage(form, "Thanks! Redirecting you to Fiverr to continue securely...", true);
        form.reset();
        const fiverrUrl = payload.fiverrUrl || state.fiverrUrl;
        const url = new URL(fiverrUrl);
        url.searchParams.set("utm_source", "academic-bridge");
        url.searchParams.set("utm_medium", "lead-form");
        url.searchParams.set("utm_campaign", data.source);
        setTimeout(() => window.open(url.toString(), "_blank", "noopener"), 800);
      } catch (error) {
        setMessage(form, "Network error. Please try again or open Fiverr directly.", false);
      } finally {
        if (submit) {
          submit.disabled = false;
          if (originalText) submit.textContent = originalText;
        }
      }
    });
  });
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#") return;
    link.addEventListener("click", (event) => {
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function init() {
  stampYear();
  setupNavToggle();
  setupPopup();
  setupSmoothScroll();
  setupLeadForms();
  await loadConfig();
  applyFiverrLinks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

export { state, applyFiverrLinks };
