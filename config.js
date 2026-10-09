// Vercel 서버 함수: 앱이 쓸 공개 설정값을 내려줍니다.
// NAVER_MAP_KEY_ID 는 네이버 지도(Dynamic Map) Client ID — 브라우저에 공개돼도 되는 값이고,
// 네이버 클라우드 콘솔에 등록한 웹 서비스 URL(내 vercel 주소)에서만 동작합니다.
module.exports = (req, res) => {
  const { NAVER_MAP_KEY_ID, NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET, NCP_SEARCH_KEY_ID, NCP_SEARCH_KEY } = process.env;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    naverMapKeyId: NAVER_MAP_KEY_ID || '',
    searchEnabled: Boolean((NAVER_SEARCH_CLIENT_ID && NAVER_SEARCH_CLIENT_SECRET) || (NCP_SEARCH_KEY_ID && NCP_SEARCH_KEY)),
  });
};
