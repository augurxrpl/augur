type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

type NewsPayload = {
  ok: true;
  updatedAt: string;
  items: NewsItem[];
};

const TTL_MS = 10 * 60 * 1000;

let cache: NewsPayload | null = null;
let cacheTime = 0;
let inFlight: Promise<NewsPayload> | null = null;

function decodeHtml(text: string): string {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "...")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function toIsoFromRippleDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const fallback = new Date(Date.parse(value));
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();

  return new Date(0).toISOString();
}

function parseRippleInsights(html: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();

  const re =
    /href="(\/insights\/[^"]+\/?)"[\s\S]{0,1200}?<p class="line-clamp-2">([\s\S]*?)<\/p>[\s\S]{0,400}?<div class="mt-2 md:mt-0">([A-Za-z]+\s+\d{1,2},\s+\d{4})<\/div>/g;

  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const path = match[1];
    const title = decodeHtml(match[2].replace(/<[^>]+>/g, " "));
    const publishedAt = toIsoFromRippleDate(match[3]);
    const link = `https://ripple.com${path}`;

    const key = `${link}::${title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (!title || path === "/insights/") continue;

    items.push({
      title,
      link,
      source: "Ripple",
      publishedAt
    });
  }

  return items;
}

async function refreshNews(): Promise<NewsPayload> {
  const res = await fetch("https://ripple.com/insights/", {
    headers: {
      "user-agent": "AUGUR/1.0 (+https://augurxrpl.com)"
    }
  });

  if (!res.ok) {
    throw new Error(`ripple insights fetch failed ${res.status}`);
  }

  const html = await res.text();
  const items = parseRippleInsights(html)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, 20);

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    items
  };
}

export async function getNewsFeed(force = false): Promise<NewsPayload> {
  const now = Date.now();

  if (!force && cache && now - cacheTime < TTL_MS) {
    return cache;
  }

  if (!force && inFlight) {
    return inFlight;
  }

  inFlight = refreshNews()
    .then((payload) => {
      cache = payload;
      cacheTime = Date.now();
      return payload;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
