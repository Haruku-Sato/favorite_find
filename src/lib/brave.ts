export interface BraveResult {
  title: string;
  url: string;
  description: string;
}

export async function braveSearch(
  query: string,
  count = 5
): Promise<BraveResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error('BRAVE_SEARCH_API_KEY が設定されていません');

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('country', 'JP');
  url.searchParams.set('search_lang', 'ja');
  url.searchParams.set('ui_lang', 'ja-JP');

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': key,
    },
    // Brave の結果は 1 時間キャッシュ
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Brave Search: HTTP ${res.status}`);

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.web?.results ?? []).map((r: any) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    description: r.description ?? '',
  }));
}
