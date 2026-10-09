// Vercel 서버 함수: 네이버 검색 대리 호출 (장소 검색 + 사진 검색)
// 검색 API 키(Secret)는 브라우저에 노출되면 안 되므로 여기서만 사용합니다.
//
//   /api/search?q=세종 애견카페            → 장소(지역) 검색, 최대 5곳
//   /api/search?type=image&q=세종 비숑카페  → 사진(이미지) 검색, 최대 8장
//
// Vercel 환경변수에 둘 중 한 쌍을 넣으세요.
//   (A) 네이버 클라우드 NAVER API HUB  NCP_SEARCH_KEY_ID / NCP_SEARCH_KEY
//       → Application에 '지역'과 '이미지' API를 둘 다 선택해 두세요.
//   (B) 네이버 개발자센터 검색 API     NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET

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

const https = (u = '') => (u.startsWith('http://') ? 'https://' + u.slice(7) : u);

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || '').trim().slice(0, 60);
  const type = req.query.type === 'image' ? 'image' : 'local';
  if (!q) return res.status(400).json({ error: 'EMPTY_QUERY', message: '검색어를 입력해 주세요.' });

  const params = type === 'image'
    ? new URLSearchParams({ query: q, display: '8', start: '1', sort: 'sim', filter: 'large' })
    : new URLSearchParams({ query: q, display: '5', start: '1', sort: req.query.sort === 'comment' ? 'comment' : 'random' });

  const { NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET, NCP_SEARCH_KEY_ID, NCP_SEARCH_KEY } = process.env;
  let url, headers;
  if (NCP_SEARCH_KEY_ID && NCP_SEARCH_KEY) {
    url = `https://naverapihub.apigw.ntruss.com/search/v1/${type}?${params}`;
    headers = { 'X-NCP-APIGW-API-KEY-ID': NCP_SEARCH_KEY_ID, 'X-NCP-APIGW-API-KEY': NCP_SEARCH_KEY };
  } else if (NAVER_SEARCH_CLIENT_ID && NAVER_SEARCH_CLIENT_SECRET) {
    url = `https://openapi.naver.com/v1/search/${type}.json?${params}`;
    headers = { 'X-Naver-Client-Id': NAVER_SEARCH_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_SEARCH_CLIENT_SECRET };
  } else {
    return res.status(503).json({ error: 'NOT_CONFIGURED', message: '네이버 검색 키가 아직 설정되지 않았어요.' });
  }

  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    if (!r.ok) {
      const what = type === 'image' ? '사진(이미지)' : '장소(지역)';
      return res.status(r.status === 429 ? 429 : 502).json({
        error: 'NAVER_ERROR', status: r.status,
        message: r.status === 401 || r.status === 403
          ? `네이버 ${what} 검색 권한이 없어요. API HUB Application에 '${type === 'image' ? '이미지' : '지역'}' API가 선택돼 있는지 확인해 주세요.`
          : r.status === 429 ? '오늘 검색 가능 횟수를 넘었어요.' : `네이버 ${what} 검색에 실패했어요.`,
        detail: text.slice(0, 300),
      });
    }
    const data = JSON.parse(text);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

    if (type === 'image') {
      const items = (data.items || []).map((it) => ({
        url: https(it.link || ''),
        thumb: https(it.thumbnail || ''),
        w: Number(it.sizewidth) || 0,
        h: Number(it.sizeheight) || 0,
      })).filter((it) => it.url || it.thumb);
      return res.status(200).json({ query: q, items });
    }

    const items = (data.items || []).map((it) => ({
      name: strip(it.title),
      category: strip(it.category),
      address: strip(it.address),
      roadAddress: strip(it.roadAddress),
      link: it.link || '',
      lat: toDeg(it.mapy),
      lng: toDeg(it.mapx),
    })).filter((it) => it.lat != null && it.lng != null);
    return res.status(200).json({ query: q, total: data.total || items.length, items });
  } catch (e) {
    return res.status(502).json({ error: 'FETCH_FAILED', message: '네이버 검색 서버에 연결하지 못했어요.' });
  }
};
