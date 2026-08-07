/**
 * Redirect legacy Figma Make hosting to GitHub Pages (canonical production).
 * Figma Make cannot auto-deploy from GitHub; this keeps the old URL working.
 * Append ?stay=1 to skip redirect (debug only).
 */
(function () {
  var LEGACY = 'https://sound-press-69397091.figma.site';
  var CANONICAL = 'https://fcosorio123.github.io/ArbolMomentum/';
  try {
    if (location.origin !== LEGACY) return;
    if (/[?&]stay=1(?:&|$)/.test(location.search)) return;
    location.replace(CANONICAL + location.search + location.hash);
  } catch (e) { /* ignore */ }
})();
