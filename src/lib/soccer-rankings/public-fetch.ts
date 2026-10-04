/**
 * Client fetches for official CA tables.
 *
 * Local `vite` / `vite preview` expose same-origin proxies (`/athleteone-api`,
 * `/mls-next-api`) that attach Referer https://theecnl.com. GitHub Pages is a
 * static host: those paths 404, the browser cannot set Referer/Origin, MLS
 * League Viewer sends no CORS header, and AthleteOne only allows
 * https://theecnl.com. The Jina reader (`https://r.jina.ai/<url>`) is the
 * browser-capable path: it reflects the page Origin and forwards `X-Referer`
 * so AthleteOne returns the real table.
 *
 * Academy's schedule JSON is ~13 MB. A single Jina GET of that URL resets
 * (503) while Homegrown's ~7 MB schedule succeeds. Jina POST `customHeader`
 * forwards `Range`, so the Academy schedule is stitched from ~3.5 MB pieces
 * and cached for a few minutes so the next age/conference does not download
 * it again. Nothing here invents scores.
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

/** Academy schedule is past the size a single Jina GET will return. */
const RANGED_SCHEDULE_FILES = new Set(["mls-next-2-academy-division-26-27.json"]);
const RANGE_CHUNK_BYTES = 3_500_000;
const RANGE_TIMEOUT_MS = 55_000;
const MLS_DOC_CACHE_MS = 4 * 60 * 1000;

const mlsDocCache = new Map<string, { text: string; at: number }>();
const mlsDocInflight = new Map<string, Promise<string | null>>();

function isRangeError(bytes: Uint8Array): boolean {
  if (bytes.length > 500) return false;
  const text = new TextDecoder().decode(bytes);
  return /upstream connect error|ParamValidationError|No URL provided|Forbidden/i.test(text);
}

async function fetchJinaRange(
  canonical: string,
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  const body = JSON.stringify({
    url: canonical,
    customHeader: { Range: `bytes=${start}-${end}` },
  });
  try {
    const resp = await fetch(JINA_READER_PREFIX, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/plain, application/json, */*",
        "X-Return-Format": "text",
        "X-No-Cache": "true",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(RANGE_TIMEOUT_MS),
    });
    if (resp.status === 429) {
      await delay(1600);
      const retry = await fetch(JINA_READER_PREFIX, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/plain, application/json, */*",
          "X-Return-Format": "text",
          "X-No-Cache": "true",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(RANGE_TIMEOUT_MS),
      });
      if (!retry.ok) return null;
      return new Uint8Array(await retry.arrayBuffer());
    }
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

async function fetchJinaRangeRetry(
  canonical: string,
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  const first = await fetchJinaRange(canonical, start, end);
  if (first && !isRangeError(first)) return first;
  return fetchJinaRange(canonical, start, end);
}

/** Stitch a League Viewer JSON file that is too large for one Jina GET. */
async function fetchMlsByRanges(canonical: string, tried: string[]): Promise<string | null> {
  tried.push(`${JINA_READER_PREFIX} (ranged) ${canonical}`);
  const parts: Uint8Array[] = [];
  let start = 0;
  for (let wave = 0; wave < 6; wave += 1) {
    const spans = [0, 1, 2, 3].map((i) => start + i * RANGE_CHUNK_BYTES);
    const batches = await Promise.all(
      spans.map((offset) =>
        fetchJinaRangeRetry(canonical, offset, offset + RANGE_CHUNK_BYTES - 1),
      ),
    );
    let finished = false;
    for (const part of batches) {
      if (!part || part.length === 0 || isRangeError(part)) {
        finished = true;
        break;
      }
      parts.push(part);
      if (part.length !== RANGE_CHUNK_BYTES) {
        finished = true;
        break;
      }
    }
    if (finished) break;
    start += 4 * RANGE_CHUNK_BYTES;
  }
  if (!parts.length) return null;
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const all = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  const text = new TextDecoder().decode(all);
  if (!isMlsJson(text)) return null;
  try {
    JSON.parse(text);
  } catch {
    return null;
  }
  return text;
}

/**
 * League Viewer JSON that works on GitHub Pages.
 * Dev proxy first, then one Jina GET, then ranged POST for the Academy schedule.
 * A successful body is reused for a few minutes (the origin cache is ~4 min).
 */
export async function fetchMlsDocument(
  canonical: string,
  file: string,
  kind: "standings" | "schedule",
  tried: string[],
): Promise<string | null> {
  const cached = mlsDocCache.get(canonical);
  if (cached && Date.now() - cached.at < MLS_DOC_CACHE_MS) {
    tried.push(`${canonical} (session cache)`);
    return cached.text;
  }
  const pending = mlsDocInflight.get(canonical);
  if (pending) return pending;

  const job = (async () => {
    const attempts = mlsJsonAttempts(canonical, file, kind);
    const proxy = attempts[0];
    const useRanges = kind === "schedule" && RANGED_SCHEDULE_FILES.has(file);
    if (useRanges && proxy) {
      proxy.timeoutMs = 4_000;
    }
    const proxied = proxy ? await fetchFirstText([proxy], tried) : null;
    if (proxied) return proxied;
    if (useRanges) {
      const ranged = await fetchMlsByRanges(canonical, tried);
      if (ranged) return ranged;
    }
    const reader = attempts[1];
    if (reader) {
      const text = await fetchFirstText([reader], tried);
      if (text) return text;
    }
    if (kind === "schedule" && !useRanges) {
      return fetchMlsByRanges(canonical, tried);
    }
    return null;
  })();

  mlsDocInflight.set(canonical, job);
  try {
    const text = await job;
    if (text) mlsDocCache.set(canonical, { text, at: Date.now() });
    return text;
  } finally {
    mlsDocInflight.delete(canonical);
  }
}
