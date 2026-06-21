# Publish to Figma Make (`sound-press-69397091.figma.site`)

GitHub is the source of truth. Figma Make **cannot** pull from GitHub automatically.

## Do NOT use "Push to GitHub" in Figma

That sends **old Figma code → GitHub** and removes features. Build in Cursor; deploy via GitHub Pages.

## Restore your Figma URL (2 minutes)

Your Figma Make file has a **Publish** button (top-right). Use it after a one-line fix so the Figma link always shows the latest app:

1. Open your [Figma Make file](https://www.figma.com/design/d8cDh8DPdqXBqJbzLPlWRo/Arbol-Momentum).
2. Open the **Code** panel and edit **`index.html`**.
3. Inside `<head>`, paste this script (or copy the whole `index.html` from GitHub):

```html
<script>
(function () {
  var LEGACY = 'https://sound-press-69397091.figma.site';
  var CANONICAL = 'https://fcosorio123.github.io/ArbolMomentum/';
  if (location.origin === LEGACY) location.replace(CANONICAL + location.search + location.hash);
})();
</script>
```

4. Click **Publish** → **Update** (top-right, not Settings → GitHub).

After that, `https://sound-press-69397091.figma.site` opens the same latest build as GitHub Pages.

## Direct production URL

**https://fcosorio123.github.io/ArbolMomentum/** — always current after every push to `main`.
