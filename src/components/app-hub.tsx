import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  Github,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  GitCommitHorizontal,
  Clock3,
  Code2,
  Globe2,
  Lock,
  AlertCircle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  CATEGORY_LABEL,
  GITHUB_USER,
  STATUS_LABEL,
  type AppCategory,
  type AppStatus,
} from "@/lib/catalog";
import {
  fetchGithubUser,
  fetchPublicRepos,
  fetchRepoCommits,
  mergeCatalogWithRepos,
  type AppCardModel,
  type GhCommit,
  type GhUser,
} from "@/lib/github";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";

type FilterKey = "all" | AppCategory;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "suite", label: "Suite" },
  { key: "backend", label: "Services" },
  { key: "local", label: "Local" },
  { key: "archive", label: "Archive" },
];

function statusVariant(
  status: AppStatus,
): "success" | "accent" | "warn" | "secondary" | "outline" {
  switch (status) {
    case "live":
      return "success";
    case "api":
      return "accent";
    case "local":
      return "warn";
    case "scaffold":
      return "secondary";
    default:
      return "outline";
  }
}

function AppIcon({ status }: { status: AppStatus }) {
  if (status === "live") return <Globe2 className="size-4" />;
  if (status === "api") return <Code2 className="size-4" />;
  if (status === "local") return <Lock className="size-4" />;
  return <LayoutGrid className="size-4" />;
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function AppHub() {
  const [user, setUser] = useState<GhUser | null>(null);
  const [apps, setApps] = useState<AppCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showHidden, setShowHidden] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commits, setCommits] = useState<GhCommit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [ghUser, repos] = await Promise.all([
          fetchGithubUser(),
          fetchPublicRepos(),
        ]);
        setUser(ghUser);
        setApps(mergeCatalogWithRepos(repos, { showHidden }));
        setSyncedAt(new Date());
      } catch (e) {
        // Offline / rate-limit: still show curated catalog so launch works.
        setApps(mergeCatalogWithRepos([], { showHidden }));
        setError(e instanceof Error ? e.message : "Failed to sync with GitHub");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showHidden],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  // Auto-refresh every 5 minutes so the hub tracks latest pushes without redeploy.
  useEffect(() => {
    const id = window.setInterval(() => {
      void load("refresh");
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [load]);

  const selected = useMemo(
    () => apps.find((a) => a.catalog.id === selectedId) ?? null,
    [apps, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setCommits([]);
      setCommitsError(null);
      return;
    }
    let cancelled = false;
    setCommitsLoading(true);
    setCommitsError(null);
    fetchRepoCommits(selected.catalog.repo, 6)
      .then((c) => {
        if (!cancelled) setCommits(c);
      })
      .catch((e) => {
        if (!cancelled)
          setCommitsError(
            e instanceof Error ? e.message : "Could not load commits",
          );
      })
      .finally(() => {
        if (!cancelled) setCommitsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (filter !== "all" && app.catalog.category !== filter) return false;
      if (!q) return true;
      const hay = [
        app.catalog.title,
        app.catalog.repo,
        app.description,
        app.language ?? "",
        ...(app.catalog.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [apps, filter, query]);

  const stats = useMemo(() => {
    const live = apps.filter((a) => a.catalog.status === "live").length;
    const total = apps.length;
    const recent = apps.filter((a) => {
      if (!a.pushedAt) return false;
      return Date.now() - new Date(a.pushedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { live, total, recent };
  }, [apps]);

  return (
    <div className="hub-atmosphere min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="size-12 rounded-xl border border-border object-cover"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card">
                  <LayoutGrid className="size-5 text-primary" />
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Application hub
                </p>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {user?.name || "Alec Mazo"}
                </h1>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              One place to launch every project. Metadata and recent activity
              refresh live from GitHub — open any live app and you get the
              latest deployed build.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load("refresh")}
              disabled={loading || refreshing}
              aria-label="Refresh from GitHub"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync GitHub
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExternal(`https://github.com/${GITHUB_USER}`)}
            >
              <Github className="size-4" />
              Profile
            </Button>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Apps tracked"
            value={loading ? "—" : String(stats.total)}
            hint="Catalog + public repos"
          />
          <StatCard
            label="Live launch"
            value={loading ? "—" : String(stats.live)}
            hint="One-click open"
          />
          <StatCard
            label="Active (7d)"
            value={loading ? "—" : String(stats.recent)}
            hint="Pushed this week"
          />
          <StatCard
            label="Last sync"
            value={
              syncedAt
                ? syncedAt.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"
            }
            hint={syncedAt ? "Auto every 5 min" : "Waiting…"}
          />
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps, languages, tags…"
              className="pl-9"
              aria-label="Search applications"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="size-3.5" />
              Filter
            </span>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className={cn(
                "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
                showHidden
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              Include archive
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <p className="font-medium">GitHub sync issue</p>
              <p className="text-muted-foreground">{error}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing curated catalog. Rate limits clear on their own — try
                Sync again shortly.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-5">
                    <Skeleton className="mb-3 h-5 w-1/2" />
                    <Skeleton className="mb-2 h-4 w-full" />
                    <Skeleton className="mb-4 h-4 w-3/4" />
                    <Skeleton className="h-9 w-24" />
                  </Card>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
                <Sparkles className="size-6 text-muted-foreground" />
                <p className="font-medium">No apps match</p>
                <p className="text-sm text-muted-foreground">
                  Try another filter or clear the search.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filtered.map((app) => (
                  <AppTile
                    key={app.catalog.id}
                    app={app}
                    selected={selectedId === app.catalog.id}
                    onSelect={() => setSelectedId(app.catalog.id)}
                    onLaunch={() => {
                      if (app.launchUrl) openExternal(app.launchUrl);
                      else openExternal(app.htmlUrl);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card className="overflow-hidden">
              {!selected ? (
                <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                  <LayoutGrid className="size-7 text-muted-foreground" />
                  <p className="font-medium">Select an application</p>
                  <p className="text-sm text-muted-foreground">
                    Click a card to inspect live GitHub activity and launch
                    options.
                  </p>
                </div>
              ) : (
                <>
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(selected.catalog.status)}>
                            {STATUS_LABEL[selected.catalog.status]}
                          </Badge>
                          <Badge variant="outline">
                            {CATEGORY_LABEL[selected.catalog.category]}
                          </Badge>
                        </div>
                        <CardTitle className="font-display text-xl">
                          {selected.catalog.title}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {GITHUB_USER}/{selected.catalog.repo}
                        </CardDescription>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {selected.description}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <Meta
                        label="Language"
                        value={selected.language ?? "—"}
                      />
                      <Meta
                        label="Last push"
                        value={formatRelativeTime(selected.pushedAt)}
                        title={formatDateTime(selected.pushedAt)}
                      />
                      <Meta
                        label="Updated"
                        value={formatRelativeTime(selected.updatedAt)}
                        title={formatDateTime(selected.updatedAt)}
                      />
                      <Meta
                        label="Visibility"
                        value={
                          selected.repo
                            ? selected.repo.private
                              ? "Private"
                              : "Public"
                            : selected.catalog.alwaysShow
                              ? "Private / local"
                              : "—"
                        }
                      />
                    </dl>

                    {selected.catalog.tags && selected.catalog.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selected.catalog.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Separator />

                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <GitCommitHorizontal className="size-3.5" />
                        Recent commits
                      </div>
                      {commitsLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : commitsError ? (
                        <p className="text-sm text-muted-foreground">
                          {commitsError.includes("404") ||
                          commitsError.includes("Not Found")
                            ? "Commits unavailable (private repo or empty history)."
                            : commitsError}
                        </p>
                      ) : commits.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No public commits to show.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {commits.map((c) => {
                            const msg = c.commit.message.split("\n")[0];
                            const date =
                              c.commit.author?.date ??
                              c.commit.committer?.date ??
                              null;
                            return (
                              <li key={c.sha}>
                                <a
                                  href={c.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group block rounded-lg border border-border bg-bg-elevated/40 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/40"
                                >
                                  <p className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary">
                                    {msg}
                                  </p>
                                  <p className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                                    <span>{c.sha.slice(0, 7)}</span>
                                    <span aria-hidden>·</span>
                                    <span className="inline-flex items-center gap-1">
                                      <Clock3 className="size-3" />
                                      {formatRelativeTime(date)}
                                    </span>
                                  </p>
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2 sm:flex-row">
                    {selected.launchUrl ? (
                      <Button
                        className="w-full sm:flex-1"
                        onClick={() => openExternal(selected.launchUrl!)}
                      >
                        Launch app
                        <ArrowUpRight className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      className="w-full sm:flex-1"
                      onClick={() => openExternal(selected.htmlUrl)}
                    >
                      <Github className="size-4" />
                      Source
                    </Button>
                  </CardFooter>
                  {selected.catalog.surfaces &&
                    selected.catalog.surfaces.length > 0 && (
                      <div className="border-t border-border px-5 py-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Surfaces
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {selected.catalog.surfaces.map((s) => (
                            <button
                              key={s.url + s.label}
                              type="button"
                              onClick={() => openExternal(s.url)}
                              className="flex h-9 items-center justify-between rounded-md border border-border bg-card px-3 text-left text-sm transition-colors hover:border-primary/30 hover:bg-muted"
                            >
                              <span>{s.label}</span>
                              <ExternalLink className="size-3.5 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </Card>
          </aside>
        </div>

        <footer className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Live data from{" "}
            <a
              className="text-primary underline-offset-2 hover:underline"
              href={`https://github.com/${GITHUB_USER}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/{GITHUB_USER}
            </a>
            . New public repos appear automatically on the next sync.
          </p>
          <p className="font-mono-num">
            Hub · GitHub Pages ready · auto-sync 5m
          </p>
        </footer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight font-mono-num">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function Meta({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated/30 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium" title={title}>
        {value}
      </dd>
    </div>
  );
}

function AppTile({
  app,
  selected,
  onSelect,
  onLaunch,
}: {
  app: AppCardModel;
  selected: boolean;
  onSelect: () => void;
  onLaunch: () => void;
}) {
  return (
    <Card
      className={cn(
        "app-tile flex flex-col",
        selected && "border-primary/45 ring-1 ring-primary/25",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col text-left"
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-bg-elevated text-primary">
                <AppIcon status={app.catalog.status} />
              </span>
              <div>
                <CardTitle>{app.catalog.title}</CardTitle>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {app.catalog.repo}
                </p>
              </div>
            </div>
            <Badge variant={statusVariant(app.catalog.status)}>
              {STATUS_LABEL[app.catalog.status]}
            </Badge>
          </div>
          <CardDescription className="line-clamp-3 pt-1">
            {app.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-auto">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {app.language && (
              <span className="inline-flex items-center gap-1">
                <Code2 className="size-3" />
                {app.language}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" />
              {formatRelativeTime(app.pushedAt)}
            </span>
            {app.repo?.has_pages && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Globe2 className="size-3" />
                Pages
              </span>
            )}
          </div>
        </CardContent>
      </button>
      <CardFooter className="gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onLaunch();
          }}
        >
          {app.launchUrl ? "Launch" : "Open repo"}
          <ArrowUpRight className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          Details
        </Button>
      </CardFooter>
    </Card>
  );
}
