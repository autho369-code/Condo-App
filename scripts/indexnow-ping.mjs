// Submits every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver — and
// Bing feeds ChatGPT search + Copilot). Run after each production deploy:
//   node scripts/indexnow-ping.mjs
const HOST = 'portier369.com'
const KEY = '11d6c6528609b3874d201bf3145e294c' // served at https://portier369.com/<key>.txt

const sitemapXml = await (await fetch(`https://${HOST}/sitemap.xml`)).text()
const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
if (urls.length === 0) {
  console.error('No URLs found in sitemap — aborting.')
  process.exit(1)
}

const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls })
const endpoints = ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow']

let ok = false
for (const endpoint of endpoints) {
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
      })
      console.log(`IndexNow (${endpoint}): submitted ${urls.length} URLs — HTTP ${res.status} ${res.statusText}`)
      if (res.ok) ok = true
    } catch (err) {
      console.warn(`IndexNow (${endpoint}) attempt ${attempt} failed: ${err.cause?.code ?? err.message}`)
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  if (ok) break
}
process.exit(ok ? 0 : 1)
