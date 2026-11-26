# @jessespencer/bible-ui

Shared design system and UI components for the Bible apps — [Atlas](../../apps/atlas) and [Lineage](../../apps/lineage).

## What's included

### Design tokens (CSS custom properties)
- Deep Night surfaces (`#020611` base), shared with By Heart (`--bg-edge`, `--bg-base`, `--bg-surface`, `--bg-elevated`, plus `--bg-scrim` and `--bg-glass` for overlays). Hairlines are starlight blue
- Fill states (`--fill-subtle` → `--fill-selected`)
- Borders (`--border-faint` → `--border-strong`, opacity-based)
- Parchment text hierarchy (`--text-disabled` → `--text-bright`, 6 levels)
- One accent per app. Each app sets `--accent-rgb`, `--accent-bright` and `--accent-fill` on `html:root`; `--accent-text`, `--accent-border`, `--accent-glow` and `--accent-halo` derive from them. Atlas is Starlight, Lineage Candlelight, By Heart Ember
- Depth from light: `--shadow-raised` is a halo in the app's accent for selected and live states; `--shadow-pop` for menus
- Radius scale (`--radius-sm` → `--radius-lg`)
- `.bui-select`, a dropdown with its own chevron, and the keyboard focus ring
- Typography (`--font-display`: IM Fell Great Primer, `--font-ui`: EB Garamond, `--font-mono`: DM Mono)
- Day, a second set of the same tokens: parchment (`#F3EDE0` base) and ink, under `html[data-theme="light"]`. Each app deepens its accent for paper in an `html[data-theme="light"]:root` rule. Inside Day, `.bui-night` gives one element Night's tokens back, such as Galaxy's sky; set `--night-accent-rgb` on `html:root` so its accent follows

### Components
- `createHeader({ title, subtitle, appId, compact })` — site header with title, subtitle, rainbow gradient bar, and a `controls` slot for app-specific buttons. `appId` adds the app switcher. `compact` gives the one-bar layout, with a `center` slot for search. The compact bar is the same height in every app: its brand and controls each sit in a 36px track, whatever size the controls are
- `APPS`, `appHref(app)`, `appSwitchHref(app)` — the app registry and a URL to each app that works in dev and production. Under `pnpm dev` and in production every app shares one origin, so both give the plain path. On a single app's own dev server they cross to the other app's port, and `appSwitchHref`, for switcher links, adds the saved Night or Day as `?bui-theme=`, since that port has storage of its own. Each entry carries its Lucide icon as SVG markup and its accent, and the switcher draws each icon glowing in its own app's accent. They also come alone from `/apps`, with no theme listener or styles, for an app that draws its own switcher (By Heart)
- `setupSheet(panel, handle, onClose)` (from `/sheet`) — the two-height phone bottom sheet. Give the panel `.bui-sheet` and the handle `.bui-sheet__handle`
- `books`, `bookOffsets`, `totalVerses` (from `/bible`) — the 66 books and KJV verse numbering, 31,102 verses
- `createGuide({ parent, stage, icon })` (from `/guide`) — a Controls button that opens how to explore the current view, with mouse or touch steps and keyboard keys, plus a one-time tip the first time a reader opens each view. Call `show(id, content)` when the view changes; apps pass their own icons
- `loadFonts()` — injects the Google Fonts stylesheet for EB Garamond, IM Fell Great Primer and DM Mono
- `TRANSLATIONS`, `savedTranslation()`, `saveTranslation()` (from `/translations`) — the Bibles on offer, their files and licences, and the reader's pick shared across apps
- `createTranslationPicker({ parent, current, onChange })` (from `/translation-picker`) — the chip and grouped menu for picking a translation
- `loadEsv(verses)`, `heldEsv(verse)`, `createEsvKeyForm(message, onSaved)`, `ESV_NOTICE` (from `/esv`) — the ESV, read live from Crossway with the reader's key and held in memory, never more than 500 verses or half a book (`esvBookLimit`). `ESV_MARK` is the "(ESV)" for each quotation. `appendEsvCredit(parent, onCredits?)` adds the quiet line every page with ESV text carries ("ESV® Bible © Crossway · esv.org · Credits"). Its Credits opens the app's own credits page, or `openEsvCredits()`, a dialog with Crossway's full notice. A translation with `remote: "esv"` has no `file`
- `LINKED_TRANSLATIONS`, `readElsewhereHref(reference, version)` (from `/translations`) — the copyrighted translations a passage links out to on Bible Gateway
- `shareView(title)` (from `/share`) — the system share sheet on touch screens, otherwise the link goes to the clipboard
- `initSelectMenus()` (from `/select-menu`) — call once: with a mouse or trackpad, every `select.bui-select` opens our menu below the control instead of the system's, with arrow keys, type-ahead and Esc. Touch screens keep the native picker
- `initTooltips()` (from `/tooltip`) — call once: styled tips in place of the browser's. An icon-only button or link (or one whose label is hidden on a phone) shows its accessible name; anything with a `title` shows that, following it if it changes while showing. Mouse, pen and keyboard focus only, never touch. Every app calls it; its look is in this stylesheet, except By Heart, which styles `.bui-tip` in its own paper and ink
- `cssToken(name)` (from `/tokens`) — reads a design token for canvas, SVG and WebGL code, which can't use `var()`
- `currentTheme()`, `setTheme(theme)`, `onThemeChange(callback)` (from `/theme`) — Night (`"dark"`, the default) or Day (`"light"`), saved for every app and followed across tabs. The switcher menu has the Night/Day switch. Canvas and WebGL code redraws in `onThemeChange`, which returns a function that stops listening; `cssToken` forgets its old values first

## Usage

Set the theme before first paint, so Day never flashes dark. In each app's `index.html` `<head>`, after the `theme-color` meta. The first script takes Night or Day from a switcher link between single-app dev servers (`appSwitchHref`) and tidies the address:

```html
<script>try { var bp = new URLSearchParams(location.search), bt = bp.get('bui-theme'); if (bt === 'light' || bt === 'dark') { localStorage.setItem('bui-theme', bt); bp.delete('bui-theme'); var bq = bp.toString(); history.replaceState(null, '', location.pathname + (bq ? '?' + bq : '') + location.hash); } } catch (e) {}</script>
<script>try { if (localStorage.getItem('bui-theme') === 'light') { document.documentElement.dataset.theme = 'light'; document.querySelector('meta[name="theme-color"]').content = '#F3EDE0'; } } catch {}</script>
<style>html { background: #020611; color-scheme: dark; } html[data-theme="light"] { background: #F3EDE0; color-scheme: light; }</style>
```

```typescript
import "@jessespencer/bible-ui/style.css";
import { createHeader, loadFonts } from "@jessespencer/bible-ui";

loadFonts();

const { element, controls } = createHeader({
  title: "My App",
  subtitle: "A Bible Visualization",
});

document.getElementById("app")!.appendChild(element);

// Add your own buttons to the controls slot
const btn = document.createElement("button");
btn.textContent = "Zoom";
controls.appendChild(btn);
```
