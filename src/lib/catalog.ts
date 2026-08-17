/**
 * Curated catalog for known apps under alecmazo.
 * Live GitHub metadata (description, updated_at, language, commits) overlays this.
 * Launch URLs always point at the live deploy so you get the latest shipped code.
 */

export type AppCategory =
  | "live"
  | "suite"
  | "backend"
  | "local"
  | "archive";

export type AppStatus = "live" | "api" | "local" | "scaffold" | "archive";

export type CatalogEntry = {
  /** Unique id — usually the GitHub repo name */
  id: string;
  repo: string;
  title: string;
  tagline: string;
  category: AppCategory;
  status: AppStatus;
  /** Primary one-click launch URL when available */
  launchUrl?: string;
  /** Secondary deep links (sub-apps inside a monorepo) */
  surfaces?: { label: string; url: string }[];
  /** Force-include even if private / missing from public API */
  alwaysShow?: boolean;
  /** Hide empty / non-product repos by default */
  hidden?: boolean;
  languageHint?: string;
  tags?: string[];
};

export const GITHUB_USER = "alecmazo";

export const CATALOG: CatalogEntry[] = [
  {
    id: "sliwinska",
    repo: "sliwinska",
    title: "Edyta Śliwińska",
    tagline:
      "Edyta Śliwińska digital home — Bay Area DWTS pro marketing site, wedding first-dance storefront, corporate packages, and Sliw desk.",
    category: "live",
    status: "live",
    launchUrl: "https://edytasliwinska.com",
    surfaces: [
      {
        label: "Marketing site",
        url: "https://edytasliwinska.com",
      },
      {
        label: "Vercel preview",
        url: "https://sliwinska.vercel.app",
      },
      {
        label: "Weddings booking",
        url: "https://weddings.edytasliwinska.com",
      },
      {
        label: "Corporate packages",
        url: "https://corporate.edytasliwinska.com",
      },
      {
        label: "Sliw desk",
        url: "https://sliw.edytasliwinska.com",
      },
      {
        label: "GitHub repo",
        url: "https://github.com/alecmazo/sliwinska",
      },
    ],
    languageHint: "Python",
    tags: [
      "edytasliwinska",
      "dance",
      "weddings",
      "DWTS",
      "marketing",
      "Vercel",
      "Railway",
    ],
  },
  {
    id: "stem-spark",
    repo: "stem-spark",
    title: "Stem Spark",
    tagline:
      "Family STEM tutor for Leia & Michael — math-first mastery paths with gymnastics and soccer themes, interactive lessons, and progress tracking.",
    category: "live",
    status: "live",
    launchUrl: "https://alecmazo.github.io/stem-spark/",
    surfaces: [
      {
        label: "Live site",
        url: "https://alecmazo.github.io/stem-spark/",
      },
      {
        label: "GitHub repo",
        url: "https://github.com/alecmazo/stem-spark",
      },
    ],
    languageHint: "TypeScript",
    tags: ["education", "STEM", "kids", "math", "GitHub Pages", "React"],
  },
  {
    id: "turf-pad-builder",
    repo: "turf-pad-builder",
    title: "Turf Pad Builder",
    tagline:
      "Interactive hillside turf pad and Fern tennis / multi-sport court planner with cut-fill, drainage, and BOM.",
    category: "live",
    status: "live",
    launchUrl: "https://alecmazo.github.io/turf-pad-builder/",
    languageHint: "TypeScript",
    tags: ["GitHub Pages", "construction", "React"],
  },
  {
    id: "soccer-capture",
    repo: "soccer-capture",
    title: "Soccer Capture",
    tagline:
      "DGA Sports field kit: two phones film left/right halves, a third monitors both and syncs record start. Clips hand off to Soccer Analyzer (split_half L/R → raw/).",
    category: "live",
    status: "live",
    launchUrl: "https://alecmazo.github.io/soccer-capture/",
    surfaces: [
      {
        label: "Live site",
        url: "https://alecmazo.github.io/soccer-capture/",
      },
      {
        label: "GitHub repo",
        url: "https://github.com/alecmazo/soccer-capture",
      },
      {
        label: "Soccer Analyzer (ingest)",
        url: "https://github.com/alecmazo/soccer-analyzer",
      },
    ],
    languageHint: "TypeScript",
    tags: ["DGA", "mobile", "GitHub Pages", "capture", "soccer"],
  },
  {
    id: "Soccer-Activate",
    repo: "Soccer-Activate",
    title: "Soccer Activate",
    tagline:
      "Elite soccer activation for a 13-year-old path — timed drills, check-offs, development tracker, and an X locker for bookmarked instruction videos you tap mid-session.",
    category: "live",
    status: "live",
    launchUrl: "https://soccer-activate.vercel.app",
    alwaysShow: true,
    surfaces: [
      {
        label: "Live app",
        url: "https://soccer-activate.vercel.app",
      },
      {
        label: "X video locker",
        url: "https://soccer-activate.vercel.app/videos",
      },
      {
        label: "GitHub repo",
        url: "https://github.com/alecmazo/Soccer-Activate",
      },
    ],
    languageHint: "TypeScript",
    tags: ["soccer", "training", "youth", "X", "React", "Vercel"],
  },
  {
    id: "claude-research-analyst",
    repo: "claude-research-analyst",
    title: "DGA Capital Research",
    tagline:
      "Institutional equity research pipeline: SEC EDGAR XBRL → Excel → Grok reasoning → Word / Gamma decks. GP terminal, LP portal, mobile research PWA.",
    category: "suite",
    status: "live",
    launchUrl: "https://portfolio.dgacapital.com",
    surfaces: [
      {
        label: "GP Terminal",
        url: "https://portfolio.dgacapital.com",
      },
      {
        label: "GitHub monorepo",
        url: "https://github.com/alecmazo/claude-research-analyst",
      },
    ],
    languageHint: "Python",
    tags: ["DGA", "research", "Railway", "FastAPI"],
  },
  {
    id: "soccer-analyzer",
    repo: "soccer-analyzer",
    title: "Soccer Analyzer",
    tagline:
      "Single-PC soccer video analysis: multi-cam fusion, DGA_Balls detection, studio / film / teamstats dashboards. Ingests Soccer Capture L/R clips from raw/.",
    category: "local",
    status: "local",
    alwaysShow: true,
    languageHint: "Python",
    tags: ["CV", "YOLO", "private", "FastAPI"],
  },
  {
    id: "dga-backend",
    repo: "dga-backend",
    title: "DGA Capital Backend",
    tagline: "API backend for the DGA Capital widget suite.",
    category: "backend",
    status: "api",
    launchUrl: "https://dga-backend.vercel.app",
    languageHint: "Python",
    tags: ["Vercel", "API"],
  },
  {
    id: "DanceFusion",
    repo: "DanceFusion",
    title: "DanceFusion",
    tagline: "DanceFusion interface (placeholder repo).",
    category: "archive",
    status: "scaffold",
    languageHint: undefined,
    tags: ["interface"],
    hidden: true,
  },
  {
    id: "technical-discussion",
    repo: "technical-discussion",
    title: "Technical Discussion",
    tagline: "Early Jupyter notes and technical discussion material.",
    category: "archive",
    status: "archive",
    languageHint: "Jupyter Notebook",
    tags: ["notes"],
    hidden: true,
  },
];

export const CATEGORY_LABEL: Record<AppCategory, string> = {
  live: "Live apps",
  suite: "Product suite",
  backend: "Services",
  local: "Local / private",
  archive: "Archive",
};

export const STATUS_LABEL: Record<AppStatus, string> = {
  live: "Live",
  api: "API",
  local: "Local only",
  scaffold: "Scaffold",
  archive: "Archive",
};
