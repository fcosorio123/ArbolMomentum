const url = 'https://fcosorio123.github.io/ArbolMomentum/';
const html = await fetch(url).then((r) => r.text());
const m = html.match(/assets\/index-[^"]+\.js/);
console.log('bundle:', m?.[0] ?? 'not found');
if (m) {
  const js = await fetch(url + m[0]).then((r) => r.text());
  const markers = [
    'onNavigateReminders',
    'Alerts',
    'OpsTab',
    'onboardingQueue',
    'goalTaskResolution',
    'DailySummaryModal',
  ];
  for (const marker of markers) {
    console.log(`${marker}:`, js.includes(marker) ? 'YES' : 'no');
  }
  console.log('bundle_bytes:', js.length);
}
