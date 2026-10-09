// Vercel 서버 함수: 네이버 지역(장소) 검색 대리 호출
// 검색 API 키(Secret)는 브라우저에 노출되면 안 되므로 여기서만 사용합니다.
//
// Vercel → Settings → Environment Variables 에 둘 중 한 쌍을 넣으세요.
//   (A) 네이버 개발자센터(developers.naver.com) 검색 API
//       NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET
//   (B) 네이버 클라우드 NAVER API HUB 지역 검색
//       NCP_SEARCH_KEY_ID / NCP_SEARCH_KEY

const strip = (s = '') =>
  s.replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .trim();

// 네이버 지역 검색 좌표: WGS84 경위도 × 10,000,000 정수로 오는 경우가 많아 보정
const toDeg = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n) > 1000 ? n / 1e7 : n;
};

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || '').trim().slice(0, 60);
  if (!q) return res.status(400).json({ error: 'EMPTY_QUERY', message: '검색어를 입력해 주세요.' });

  const params = new URLSearchParams({
    query: q,
    display: '5', // 네이버 지역 검색은 한 번에 최대 5개
    start: '1',
    sort: req.query.sort === 'comment' ? 'comment' : 'random',
  });

  const { NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET, NCP_SEARCH_KEY_ID, NCP_SEARCH_KEY } = process.env;
  let url, headers;
  if (NAVER_SEARCH_CLIENT_ID && NAVER_SEARCH_CLIENT_SECRET) {
    url = `https://openapi.naver.com/v1/search/local.json?${params}`;
    headers = { 'X-Naver-Client-Id': NAVER_SEARCH_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_SEARCH_CLIENT_SECRET };
  } else if (NCP_SEARCH_KEY_ID && NCP_SEARCH_KEY) {
    url = `https://naverapihub.apigw.ntruss.com/search/v1/local?${params}`;
    headers = { 'X-NCP-APIGW-API-KEY-ID': NCP_SEARCH_KEY_ID, 'X-NCP-APIGW-API-KEY': NCP_SEARCH_KEY };
  } else {
    return res.status(503).json({ error: 'NOT_CONFIGURED', message: '네이버 검색 키가 아직 설정되지 않았어요.' });
  }

  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    if (!r.ok) {
      return res.status(r.status === 429 ? 429 : 502).json({
        error: 'NAVER_ERROR', status: r.status,
        message: r.status === 401 || r.status === 403
          ? '네이버 검색 키가 올바르지 않거나 검색 API 사용 설정이 안 되어 있어요.'
          : r.status === 429 ? '오늘 검색 가능 횟수를 넘었어요.' : '네이버 검색에 실패했어요.',
        detail: text.slice(0, 300),
      });
    }
    const data = JSON.parse(text);
    const items = (data.items || []).map((it) => ({
      name: strip(it.title),
      category: strip(it.category),
      address: strip(it.address),
      roadAddress: strip(it.roadAddress),
      link: it.link || '',
      lat: toDeg(it.mapy),
      lng: toDeg(it.mapx),
    })).filter((it) => it.lat != null && it.lng != null);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ query: q, total: data.total || items.length, items });
  } catch (e) {
    return res.status(502).json({ error: 'FETCH_FAILED', message: '네이버 검색 서버에 연결하지 못했어요.' });
  }
};
