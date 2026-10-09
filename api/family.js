// Vercel 서버 함수: 가족 공유 (같은 가족 코드를 쓰는 폰끼리 기록을 맞춰 줌)
//
// 저장소: Upstash Redis (Vercel → Storage / Marketplace 에서 연결하면 아래 환경변수가 자동으로 생겨요)
//   KV_REST_API_URL, KV_REST_API_TOKEN   (또는 UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
//
//   GET  /api/family?code=ABCD-1234                → 가족 기록 가져오기
//   POST /api/family {action:'create', cafes}      → 새 가족 코드 만들기 (내 기록을 처음 내용으로)
//   POST /api/family {action:'sync', code, cafes}  → 내 기록과 가족 기록 합치기 → 합친 결과 돌려줌

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = (code) => `famcafe:family:${code}`;
const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외
const TOMBSTONE_DAYS = 90;

async function redis(cmd) {
  const r = await fetch(RURL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RTOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `redis ${r.status}`);
  return j.result;
}

const newCode = () => {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
};

// 기록 정리: 너무 큰 값(폰 사진 원본 등) 제거, 필수 값 확인
function clean(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c.id === 'string' && c.id.length < 60)
    .slice(0, 2000)
    .map((c) => {
      const x = { ...c, updatedAt: Number(c.updatedAt) || 1 };
      if (typeof x.photo === 'string' && x.photo.startsWith('data:')) x.photo = '';
      return x;
    });
}

// 같은 기록(id)은 더 최근에 고친 쪽(updatedAt)을 남김. 삭제 표시도 같은 규칙.
function merge(a, b) {
  const m = new Map();
  [...a, ...b].forEach((c) => {
    const prev = m.get(c.id);
    if (!prev || (c.updatedAt || 0) >= (prev.updatedAt || 0)) m.set(c.id, c);
  });
  const cutoff = Date.now() - TOMBSTONE_DAYS * 864e5;
  return [...m.values()].filter((c) => !(c.deleted && c.updatedAt < cutoff));
}

async function load(code) {
  const raw = await redis(['GET', KEY(code)]);
  return raw ? JSON.parse(raw) : null;
}
async function save(code, data) {
  await redis(['SET', KEY(code), JSON.stringify(data)]);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!RURL || !RTOKEN) {
    return res.status(503).json({ error: 'NOT_CONFIGURED', message: '가족 공유 저장소(Upstash Redis)가 아직 연결되지 않았어요.' });
  }
  try {
    if (req.method === 'GET') {
      const code = String(req.query.code || '').toUpperCase().trim();
      if (!CODE_RE.test(code)) return res.status(400).json({ error: 'BAD_CODE', message: '가족 코드 형식이 맞지 않아요. (예: ABCD-2345)' });
      const data = await load(code);
      if (!data) return res.status(404).json({ error: 'NO_FAMILY', message: '그 코드의 가족을 찾지 못했어요.' });
      return res.status(200).json({ code, cafes: data.cafes || [], updatedAt: data.updatedAt });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const mine = clean(body.cafes);

    if (body.action === 'create') {
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const data = { cafes: merge([], mine), createdAt: Date.now(), updatedAt: Date.now() };
        // NX: 이미 있는 코드면 덮어쓰지 않음
        const ok = await redis(['SET', KEY(code), JSON.stringify(data), 'NX']);
        if (ok) return res.status(200).json({ code, cafes: data.cafes, updatedAt: data.updatedAt });
      }
      return res.status(500).json({ error: 'CODE_FAILED', message: '가족 코드를 만들지 못했어요. 다시 시도해 주세요.' });
    }

    if (body.action === 'sync') {
      const code = String(body.code || '').toUpperCase().trim();
      if (!CODE_RE.test(code)) return res.status(400).json({ error: 'BAD_CODE', message: '가족 코드 형식이 맞지 않아요.' });
      const data = await load(code);
      if (!data) return res.status(404).json({ error: 'NO_FAMILY', message: '그 코드의 가족을 찾지 못했어요.' });
      const merged = merge(clean(data.cafes), mine);
      const next = { ...data, cafes: merged, updatedAt: Date.now() };
      await save(code, next);
      return res.status(200).json({ code, cafes: merged, updatedAt: next.updatedAt });
    }

    return res.status(400).json({ error: 'BAD_ACTION' });
  } catch (e) {
    return res.status(502).json({ error: 'STORE_FAILED', message: '가족 공유 저장소에 연결하지 못했어요.', detail: String(e.message || e).slice(0, 200) });
  }
};
