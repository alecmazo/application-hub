/**
 * Client fetches for official CA tables.
 *
 * Local `vite` / `vite preview` expose same-origin proxies (`/athleteone-api`,
 * `/mls-next-api`) that attach Referer https://theecnl.com. GitHub Pages is a
 * static host: those paths 404, the browser cannot set Referer/Origin, MLS
 * League Viewer sends no CORS header, and AthleteOne only allows
 * https://theecnl.com. The Jina reader (`https://r.jina.ai/<url>`) is the
 * browser-capable path: it reflects the page Origin and forwards `X-Referer`
 * so AthleteOne returns the real table. Nothing here invents scores.
 */
const JINA_READER_PREFIX = "https://r.jina.ai/";
const PROXY_TIMEOUT_MS = 12_000;
const JINA_TIMEOUT_MS = 25_000;
const SCHEDULE_TIMEOUT_MS = 40_000;

export type FetchAttempt = {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  accept: (text: string) => boolean;
};

function blockedPayload(text: string): boolean {
  return /"status"\s*:\s*99|"title"\s*:\s*"Forbidden"|AuthenticationRequiredError|corsfix_error|keyless_legacy_url/i.test(
    text.slice(0, 800),
  );
}

export function isAthleteOneStandings(text: string): boolean {
  if (!text || text.length < 80 || blockedPayload(text)) return false;
  return text.includes("data-team-id") && /<h3\b/i.test(text);
}

export function isAthleteOneTeamInfo(text: string): boolean {
  if (!text || text.length < 80 || blockedPayload(text)) return false;
  return text.includes("schedules-table-content");
}

export function isAthleteOneMarkup(text: string): boolean {
  if (!text || text.length < 80 || blockedPayload(text)) return false;
  return text.includes("data-team-id") || text.includes("schedules-table-content");
}

export function isMlsJson(text: string): boolean {
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false;
  if (blockedPayload(trimmed)) return false;
  return trimmed.includes('"competition_season"') || trimmed.includes('"events"');
}

function jinaHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: "text/html, application/json, text/plain, */*",
    "X-Return-Format": "html",
    "X-No-Cache": "true",
    "X-Referer": "https://theecnl.com/",
    ...extra,
  };
}

export function athleteOneAttempts(
  scriptPath: string,
  kind: "standings" | "team-info" | "markup",
): FetchAttempt[] {
  const path = scriptPath.startsWith("/") ? scriptPath : `/${scriptPath}`;
  const canonical = `https://api.athleteone.com${path}`;
  const accept =
    kind === "standings"
      ? isAthleteOneStandings
      : kind === "team-info"
        ? isAthleteOneTeamInfo
        : isAthleteOneMarkup;
  const headers =
    kind === "team-info"
      ? jinaHeaders({ "X-Target-Selector": "#schedules-table-content" })
      : kind === "standings"
        ? jinaHeaders({ "X-Return-Format": "html" })
        : jinaHeaders();
  return [
    {
      url: `/athleteone-api${path}`,
      headers: { Accept: "text/html,application/json,*/*" },
      timeoutMs: PROXY_TIMEOUT_MS,
      accept,
    },
    {
      url: `${JINA_READER_PREFIX}${canonical}`,
      headers,
      timeoutMs: JINA_TIMEOUT_MS,
      accept,
    },
  ];
}

export function mlsJsonAttempts(
  canonical: string,
  file: string,
  kind: "standings" | "schedule",
): FetchAttempt[] {
  const accept = isMlsJson;
  return [
    {
      url: `/mls-next-api/data/${kind}/${file}`,
      headers: { Accept: "application/json" },
      timeoutMs: kind === "schedule" ? SCHEDULE_TIMEOUT_MS : PROXY_TIMEOUT_MS,
      accept,
    },
    {
      url: `${JINA_READER_PREFIX}${canonical}`,
      headers: {
        Accept: "application/json, text/plain, */*",
        "X-Return-Format": "text",
        "X-No-Cache": "true",
      },
      timeoutMs: kind === "schedule" ? SCHEDULE_TIMEOUT_MS : JINA_TIMEOUT_MS,
      accept,
    },
  ];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readAttempt(attempt: FetchAttempt, allow429Retry: boolean): Promise<string | null> {
  try {
    const resp = await fetch(attempt.url, {
      headers: attempt.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(attempt.timeoutMs ?? JINA_TIMEOUT_MS),
    });
    if (resp.status === 429 && allow429Retry) {
      await delay(1600);
      return readAttempt(attempt, false);
    }
    if (!resp.ok) return null;
    const text = await resp.text();
    return attempt.accept(text) ? text : null;
  } catch {
    return null;
  }
}

/** First response that passes `accept`. Rejects SPA shells, 403 JSON, and empty bodies. */
export async function fetchFirstText(
  attempts: FetchAttempt[],
  tried: string[],
): Promise<string | null> {
  for (const attempt of attempts) {
    tried.push(attempt.url);
    const text = await readAttempt(attempt, true);
    if (text) return text;
  }
  return null;
}
