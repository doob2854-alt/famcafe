# 우리가족 카페 & 나들이 지도 (PWA · v2 네이버 연동)

아기 + 비숑 가족을 위한 카페 기록 지도. GitHub에 올리고 Vercel로 배포하는 구조입니다.

## 파일 구성 (저장소 맨 위에 이대로 있어야 해요)
```
index.html        ← 앱 전체 (React)
manifest.json     ← 홈 화면 앱 설정
sw.js             ← 오프라인 실행용 서비스 워커
vercel.json       ← Vercel 설정 (서비스 워커 캐시 등)
api/search.js     ← 네이버 장소 검색 (키를 숨겨서 대신 호출)
api/config.js     ← 네이버 지도 키 전달
icons/            ← 비숑 앱 아이콘
```

## v2에서 바뀐 것
- **네이버 지도**로 표시 (키 설정 전에는 기본 지도로 자동 대체)
- **네이버 장소 검색**: 위쪽 검색창에서 "성수 애견동반 카페"처럼 검색하면 결과가 지도 번호 핀 + 목록으로 뜸
  - `＋ 우리 지도에 기록` → 이름·주소·위치가 자동으로 채워진 기록 폼
  - 이미 기록한 곳은 `★ 기록함` 표시
  - 검색창을 누르면 지금 지도 동네 이름이 붙은 추천 검색어(애견동반 카페, 키즈카페…)가 나옴
- 기록 폼에서도 네이버로 가게를 찾아 바로 선택 (검색이 안 되면 직접 입력 + 지도 탭)
- 상세 화면에 **네이버지도에서 보기 · 리뷰 · 길찾기** 버튼
- 반려견 아이콘을 **흰 비숑 얼굴**로 교체 (지도 핀, 배지, 필터, 앱 아이콘)

---

## 🔑 네이버 연동 설정 (한 번만)

키는 2종류예요. 둘 다 Vercel 환경변수로 넣고, 코드는 고칠 필요 없어요.

| 용도 | 어디서 받나 | Vercel 환경변수 이름 |
|---|---|---|
| 지도 표시 | 네이버 클라우드 플랫폼 (Maps) | `NAVER_MAP_KEY_ID` |
| 장소 검색 | 네이버 개발자센터 (검색 API) | `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET` |

### 1) 지도 키 — 네이버 클라우드 플랫폼
1. https://www.ncloud.com 가입 (결제수단 등록이 필요할 수 있어요)
2. 콘솔 → Services → **Application Services → Maps** → 이용 신청
3. Maps의 **Application** 메뉴 → **Application 등록**
   - 이름: `가족나들이`
   - API 선택: **Dynamic Map** 체크 (+ **Reverse Geocoding** 체크하면 동네 이름 추천 검색어가 켜져요)
   - **Web 서비스 URL**: `http://내프로젝트.vercel.app` (http로 적어도 https에서 동작, 끝에 / 없이)
4. 등록된 Application → **인증 정보** → **Client ID** 복사 → `NAVER_MAP_KEY_ID`

> 💰 무료 이용량은 **대표 계정**에만 있어요. 가족 둘이 쓰는 정도는 무료 범위지만, 콘솔에서 **일/월 사용량 한도**를 걸어 두면 안심이에요.

### 2) 검색 키 — 네이버 개발자센터
1. https://developers.naver.com → **Application → 애플리케이션 등록**
2. 사용 API: **검색**
3. 환경 추가: **WEB 설정** → 서비스 URL에 `https://내프로젝트.vercel.app`
4. 등록 후 보이는 **Client ID** → `NAVER_SEARCH_CLIENT_ID`, **Client Secret** → `NAVER_SEARCH_CLIENT_SECRET`
   - 하루 25,000회까지 사용 가능

> 개발자센터에서 검색 API 발급이 안 되면(네이버 클라우드 'NAVER API HUB'로 이전 중), 네이버 클라우드 콘솔의 **NAVER API HUB**에서 검색 API를 신청하고
> 받은 키를 `NCP_SEARCH_KEY_ID`, `NCP_SEARCH_KEY` 이름으로 넣으면 똑같이 동작해요.

### 3) Vercel에 넣기
1. Vercel 프로젝트 → **Settings → Environment Variables**
2. 위 이름(Key)과 값(Value)을 하나씩 추가 → Save
3. **Deployments → 최근 배포 ⋯ → Redeploy** (환경변수는 다시 배포해야 반영돼요)

### 4) 확인
- `https://내프로젝트.vercel.app/api/config` 를 열었을 때 `"naverMapKeyId":"..."`, `"searchEnabled":true` 이면 성공
- 앱 지도 왼쪽 위에 "기본 지도 · 네이버 지도 설정 전" 표시가 사라지면 네이버 지도가 켜진 거예요
- "네이버 지도 인증 실패" 알림이 뜨면 → 3단계의 **Web 서비스 URL**이 실제 주소와 같은지 확인

---

## 📱 홈 화면에 추가
- **아이폰**: Safari로 접속 → 공유 ⬆︎ → 홈 화면에 추가
- **안드로이드**: Chrome → 앱 안의 '지금 설치하기' 또는 ⋮ → 홈 화면에 추가
- 이미 v1을 설치했다면: 홈 화면 아이콘을 지우고 다시 추가해야 **비숑 아이콘**으로 바뀌어요

## 알아 둘 점
- 네이버 검색은 **한 번에 최대 5곳**만 줘요(네이버 정책). 더 보려면 검색 결과의 `더 보기 →`로 네이버지도에서 열려요.
- 네이버 가게의 사진·리뷰·영업시간은 API로 가져올 수 없어서, 상세 화면의 네이버지도 버튼으로 연결했어요.
- 기록은 각자 폰에만 저장돼요(부부 공유는 아직). 예시 카페 3곳은 가상의 장소라 지우고 쓰시면 돼요.
- 코드를 고친 뒤 폰에 반영이 안 되면 `sw.js`의 `VERSION` 값을 올려 주세요.
