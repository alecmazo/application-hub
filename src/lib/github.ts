import { CATALOG, GITHUB_USER, type CatalogEntry } from "@/lib/catalog";

export type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  has_pages: boolean;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  updated_at: string;
  created_at: string;
  default_branch: string;
  topics?: string[];
};

export type GhCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
    committer: { name: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
};

export type GhUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  blog: string | null;
  location: string | null;
};

export type AppCardModel = {
  catalog: CatalogEntry;
  repo: GhRepo | null;
  /** Effective description: live GitHub description or curated tagline */
  description: string;
  language: string | null;
  updatedAt: string | null;
  pushedAt: string | null;
  htmlUrl: string;
  launchUrl: string | null;
  isLive: boolean;
  commits?: GhCommit[];
};

async function ghFetch<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 160) || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchGithubUser(): Promise<GhUser> {
  return ghFetch<GhUser>(`/users/${GITHUB_USER}`);
}

export async function fetchPublicRepos(): Promise<GhRepo[]> {
  const repos = await ghFetch<GhRepo[]>(
    `/users/${GITHUB_USER}/repos?per_page=100&sort=updated&type=owner`,
  );
  return repos.filter((r) => !r.fork);
}

export async function fetchRepoCommits(
  repo: string,
  count = 5,
): Promise<GhCommit[]> {
  return ghFetch<GhCommit[]>(
    `/repos/${GITHUB_USER}/${repo}/commits?per_page=${count}`,
  );
}

/** Guess a GitHub Pages URL when has_pages is true and no curated launch URL. */
function guessPagesUrl(repo: GhRepo): string | null {
  if (!repo.has_pages) return null;
  return `https://${GITHUB_USER}.github.io/${repo.name}/`;
}

export function mergeCatalogWithRepos(
  repos: GhRepo[],
  opts?: { showHidden?: boolean },
): AppCardModel[] {
  const byName = new Map(repos.map((r) => [r.name, r]));
  const showHidden = opts?.showHidden ?? false;

  const fromCatalog: AppCardModel[] = CATALOG.filter(
    (c) => showHidden || !c.hidden,
  ).map((catalog) => {
    const repo = byName.get(catalog.repo) ?? null;
    const launch =
      catalog.launchUrl ??
      (repo ? guessPagesUrl(repo) : null) ??
      (repo?.homepage && /^https?:\/\//.test(repo.homepage)
        ? repo.homepage
        : null);

    return {
      catalog,
      repo,
      description: repo?.description?.trim() || catalog.tagline,
      language: repo?.language ?? catalog.languageHint ?? null,
      updatedAt: repo?.updated_at ?? null,
      pushedAt: repo?.pushed_at ?? null,
      htmlUrl: repo?.html_url ?? `https://github.com/${GITHUB_USER}/${catalog.repo}`,
      launchUrl: launch,
      isLive: catalog.status === "live" && Boolean(launch),
    };
  });

  // Any public repo not yet in the catalog still appears so the hub stays current.
  const catalogRepos = new Set(CATALOG.map((c) => c.repo));
  const extras: AppCardModel[] = repos
    .filter((r) => !catalogRepos.has(r.name) && !r.archived)
    .map((repo) => {
      const launch =
        guessPagesUrl(repo) ??
        (repo.homepage && /^https?:\/\//.test(repo.homepage)
          ? repo.homepage
          : null);
      return {
        catalog: {
          id: repo.name,
          repo: repo.name,
          title: repo.name,
          tagline: repo.description || "Repository discovered from GitHub.",
          category: launch ? "live" : "archive",
          status: launch ? "live" : "scaffold",
          launchUrl: launch ?? undefined,
          languageHint: repo.language ?? undefined,
        },
        repo,
        description: repo.description || "Repository discovered from GitHub.",
        language: repo.language,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        htmlUrl: repo.html_url,
        launchUrl: launch,
        isLive: Boolean(launch),
      };
    });

  // Always-show curated entries that may be private (no public API hit)
  const privateCurated = CATALOG.filter(
    (c) => c.alwaysShow && !byName.has(c.repo) && (showHidden || !c.hidden),
  ).map((catalog) => ({
    catalog,
    repo: null,
    description: catalog.tagline,
    language: catalog.languageHint ?? null,
    updatedAt: null,
    pushedAt: null,
    htmlUrl: `https://github.com/${GITHUB_USER}/${catalog.repo}`,
    launchUrl: catalog.launchUrl ?? null,
    isLive: catalog.status === "live" && Boolean(catalog.launchUrl),
  }));

  const seen = new Set(fromCatalog.map((a) => a.catalog.id));
  for (const p of privateCurated) {
    if (!seen.has(p.catalog.id)) {
      fromCatalog.push(p);
      seen.add(p.catalog.id);
    }
  }

  const all = [...fromCatalog, ...extras];
  all.sort((a, b) => {
    const ta = a.pushedAt ? new Date(a.pushedAt).getTime() : 0;
    const tb = b.pushedAt ? new Date(b.pushedAt).getTime() : 0;
    return tb - ta;
  });
  return all;
}
