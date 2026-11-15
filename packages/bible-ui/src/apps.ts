/**
 * The apps in the family and where each one lives. Free of side effects, so an app that keeps
 * its own header and theme (By Heart) can list the others without the rest of bible-ui.
 */

export interface AppEntry {
  /** Stable id, matches `HeaderConfig.appId`. */
  id: string;
  label: string;
  tagline: string;
  /** Path the app is served from in production. */
  path: string;
  /** Port the app's dev server is pinned to (see its vite.config.ts). */
  devPort: number;
  /** The inside of a 24×24 Lucide icon, so this package needs no icon dependency. */
  icon: string;
  /** The app's accent as an `r, g, b` triple; its stylesheet sets the same value as `--accent-rgb`. */
  accent: string;
  /** The same accent deepened for Day's paper. */
  accentLight: string;
}

/** Every app in the ecosystem. Add an entry here to add it to the switcher. */
export const APPS: AppEntry[] = [
  {
    id: "atlas",
    label: "Atlas",
    tagline: "Every cross-reference in the Bible",
    path: "/bible/atlas/",
    devPort: 5173,
    // Lucide "rainbow": three arches, like the arc diagram
    icon: '<path d="M22 17a10 10 0 0 0-20 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M10 17a2 2 0 0 1 4 0"/>',
    // Starlight, and by day a blue-black ink
    accent: "142, 197, 255",
    accentLight: "36, 82, 150",
  },
  {
    id: "lineage",
    label: "Lineage",
    tagline: "Visual history of the Bible",
    path: "/bible/lineage/",
    devPort: 5174,
    // Lucide "git-branch": a family line branching off the main one
    icon: '<path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>',
    // Candlelight, and by day an iron-gall amber
    accent: "242, 196, 107",
    accentLight: "146, 94, 18",
  },
  {
    id: "byheart",
    label: "By Heart",
    tagline: "Memorize Scripture, up to whole books",
    path: "/bible/byheart/",
    devPort: 5175,
    // Lucide "heart"
    icon: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
    // Ember, and by day the rubric red of its printed page
    accent: "255, 138, 122",
    accentLight: "200, 50, 30",
  },
  {
    id: "bread",
    label: "Bread Alone",
    tagline: "Three verses for what you're carrying",
    path: "/bible/bread/",
    devPort: 5176,
    // Lucide "wheat"
    icon:
      '<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>' +
      '<path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>' +
      '<path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>' +
      '<path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/>' +
      '<path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>' +
      '<path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>' +
      '<path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>',
    // Olive, and by day a deep leaf green
    accent: "176, 212, 140",
    accentLight: "66, 104, 38",
  },
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Resolves the URL for an app. In production every app lives on one origin,
 * so the plain path works. In dev each app has its own Vite server, so we
 * cross the port boundary explicitly.
 */
export const appHref = (app: AppEntry): string =>
  LOCAL_HOSTS.has(location.hostname)
    ? `${location.protocol}//${location.hostname}:${app.devPort}${app.path}`
    : app.path;

/**
 * The switcher's link to an app. In production Night or Day is shared through storage on one origin.
 * Dev servers are separate origins with separate storage, so the link carries the saved choice as
 * `?bui-theme=`, which each app's index.html saves and strips before first paint.
 */
export const appSwitchHref = (app: AppEntry): string => {
  const href = appHref(app);
  if (!LOCAL_HOSTS.has(location.hostname)) return href;
  let theme: string | null = null;
  try {
    theme = localStorage.getItem("bui-theme");
  } catch {
    // Storage refused: the next app starts on its own default.
  }
  return theme === "light" || theme === "dark" ? `${href}?bui-theme=${theme}` : href;
};
