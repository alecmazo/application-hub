/**
 * One-tap Delete for Marin FC report pages on GitHub Pages.
 * Validates the passcode and slug, then dispatches delete-report.yml.
 * Secrets: DELETE_PASSCODE_HASH (SHA-256 hex of the passcode), DELETE_GITHUB_TOKEN.
 * Never log their values.
 */

export const PROTECTED_SLUGS = new Set([
  "assets",
  "season-trend-ab0e5977a9e9",
  "player-cards-4333cd65c796",
  "player-cards-season-cc2378ad382d",
  "player-cards-latest-d2130e467695",
  "player-cards-newark-7cee276873b1",
  "pro-analytics-6feface8946d",
]);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function isAllowedSlug(slug) {
  return typeof slug === "string" && SLUG_RE.test(slug) && !PROTECTED_SLUGS.has(slug);
}

export async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s ?? "")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashesMatch(submitted, storedHashHex) {
  const got = await sha256hex(submitted);
  const want = String(storedHashHex ?? "").trim().toLowerCase();
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

function corsHeaders(origin, allowed) {
  const allow = origin === allowed ? origin : "";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    vary: "Origin",
  };
  if (allow) {
    headers["access-control-allow-origin"] = allow;
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-max-age"] = "86400";
  }
  return headers;
}

function json(body, status, origin, allowed) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin, allowed),
  });
}

async function reportExists(token, repo, slug) {
  const url = `https://api.github.com/repos/${repo}/contents/public/MarinFC-reports/${slug}/index.html`;
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "marin-fc-delete",
    },
  });
  return res.status === 200;
}

async function dispatchDelete(token, repo, workflow, slug) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
  return fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "marin-fc-delete",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { slug } }),
  });
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || "https://alecmazo.github.io";
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin !== allowed) {
        return new Response(null, { status: 403, headers: corsHeaders(origin, allowed) });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, origin, allowed);
    }
    if (origin !== allowed) {
      return json({ error: "Forbidden." }, 403, origin, allowed);
    }
    if (!env.DELETE_PASSCODE_HASH || !env.DELETE_GITHUB_TOKEN) {
      return json({ error: "Delete service is not configured." }, 503, origin, allowed);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request." }, 400, origin, allowed);
    }
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const passcode = typeof body.passcode === "string" ? body.passcode : "";

    if (!(await hashesMatch(passcode, env.DELETE_PASSCODE_HASH))) {
      return json({ error: "Incorrect passcode." }, 401, origin, allowed);
    }
    if (!isAllowedSlug(slug)) {
      return json({ error: "That page cannot be deleted." }, 400, origin, allowed);
    }

    const repo = env.REPO || "alecmazo/application-hub";
    const workflow = env.WORKFLOW_FILE || "delete-report.yml";
    try {
      if (!(await reportExists(env.DELETE_GITHUB_TOKEN, repo, slug))) {
        return json({ error: "Report not found." }, 404, origin, allowed);
      }
      const res = await dispatchDelete(env.DELETE_GITHUB_TOKEN, repo, workflow, slug);
      if (res.status !== 204) {
        return json({ error: "Could not start the delete." }, 502, origin, allowed);
      }
    } catch {
      return json({ error: "Could not start the delete." }, 502, origin, allowed);
    }
    return json({ ok: true, slug }, 200, origin, allowed);
  },
};
