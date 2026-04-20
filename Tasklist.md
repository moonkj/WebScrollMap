# WebScrollMap — Tasklist

> 팀 리더(Architect) + Teammate 1~4가 **동일 파일**을 갱신한다. 체크박스는 각자 자기 작업분 업데이트.
> 과학적 토론 발생은 🧪, 교차 레이어 영향은 🔁, 블로커는 🚨 태깅.

## 0. Phase: 기획/설계 ✅ 완료

### Architect (팀 리더)
- [x] 팀 에이전트 역할 메모리 저장
- [x] Tasklist.md / process.md 스켈레톤
- [x] 요구사항 분석 & 설계 요약 v1
- [x] 팀원 리뷰 취합 → 과학적 토론 조율 (D1~D6)
- [x] 🔁 R2 개선 반영 → 설계 v2 확정
- [x] README / SPEC / USAGE / perf-budget 생성
- [x] process.md 업데이트
- [ ] git 초기화 + 베이스라인 커밋

### Teammate 1 — Coder
- [x] 모듈 트리 제안 (core/content/ui/platform/config/test)
- [x] 기술 스택 검증 (TypeScript strict + Vite + Safari WE)
- [x] 핵심 타입 정의 (AnchorPoint, DensityBlock, MinimapRenderer 인터페이스)
- [x] DI 시그니처 (`createScanner({now, random, observer})`)

### Teammate 2 — Debugger
- [x] H1~H12 리스크 가설 (iOS 엣지, Shadow DOM 누수, Mutation 폭주, SPA, iframe, 가상 스크롤, sticky, CSP, zoom, 다크, RTL, 누수)
- [x] 🧪 D1~D4 가설 분기

### Teammate 3 — Test Engineer / Reviewer
- [x] 12개 핵심 시나리오 (Sev1 7개)
- [x] 접근성 체크리스트
- [x] Reviewer 최종 리뷰 → 🔁 R2 트리거 (Sev1 1, Sev2 3, Sev3 1)

### Teammate 4 — Performance / Doc Writer
- [x] 성능 예산 정의 (첫 렌더 150ms / 스크럽 58~60fps / iOS 15MB)
- [x] Hot path 최적화 가이드 (RAF, MutationObserver 스코프, dirty region)
- [x] 🧪 Canvas vs DOM, Mutation 스코프 가설
- [x] README/SPEC/USAGE 초안

## 0.5 Phase: 2차 설계 리뷰 ✅ 완료 (R2+ 라운드)

### UX R2 — 온보딩/설정/페이월/마켓
- [x] 3-step 온보딩, popup UI, App Store subtitle/키워드/i18n

### Debugger R2 — 보안·프라이버시·권한
- [x] S1~S15 리스크 + 🚨 App Store 심사 블로커 6건 식별

### Performance R2 — 에너지/계측
- [x] Playwright perf 게이트 + 5지표 + canary + quality mode 3단계

### Test R2 — 릴리스 운영
- [x] 릴리스 게이트 매트릭스, 초대 20명 비공개 베타, Sentry scrubbing

## 1. Phase: MVP 구현 (다음 사이클)

### 블로커 해소 필수 (R2 + R2+ 반영)
- [ ] 🚨 `MinimapRenderer` 인터페이스 계약 확립 (Sev1)
- [ ] 히스테리시스 구현 (600/550 + 1s 쿨다운)
- [ ] `PlatformCapabilities` 어댑터 (iOS vs macOS 단일 관문)
- [ ] `config/tuning.ts` 격리
- [ ] Playwright perf 스모크 + `perf-budget.json` CI 연동
- [ ] 🚨 Privacy Manifest `PrivacyInfo.xcprivacy` 작성 (S3/S9)
- [ ] 🚨 `sessionStorage` HMAC 검증 레이어 (S6)
- [ ] 🚨 Pin URL same-origin 검증 (S6)
- [ ] 🚨 Private 탭 감지 + 기능 축소 (S12)
- [ ] 🚨 외부 CDN 금지 + 폰트 번들 내재화 (S13)
- [ ] 커스텀 검색 패널 (S7 — Cmd+F 가로채기 금지)

### 핵심 모듈
- [x] Safari Web Extension 스캐폴딩 (manifest v3, Vite, TS strict)
- [x] `core/scanner.ts` (offsetTop 누적, detached 가드)
- [x] `core/renderMode.ts` (히스테리시스 600/550, 쿨다운 1s) ✅ R2-2
- [x] `core/snap.ts` (±12px binary-search)
- [x] `core/hash.ts` (djb2)
- [x] `ui/shadowHost.ts` (closed + all:initial, 랜덤 태그명 — S5 방어)
- [x] `ui/renderer.ts` (하이브리드 파사드, MinimapRenderer 계약) ✅ R2-1 Sev1
- [x] `ui/renderer.dom.ts` / `ui/renderer.canvas.ts`
- [x] `ui/scrubber.ts` (RAF throttle, passive touch, scrollTo 즉시, rect 캐시, 엣지존 양보)
- [x] `platform/observerBus.ts` (Mutation 500ms, SPA patch 체인 안전 복원, visualViewport)
- [x] `platform/platform.ts` (PlatformCapabilities 단일 관문) ✅ R2-3
- [x] `config/tuning.ts` (매직넘버 격리) ✅ R2-5
- [x] `content/entry.ts` + `shouldActivate.ts` (bootstrap + RAF scroll)
- [x] 단위 테스트 21건 (snap/renderMode/scanner/hash/shouldActivate)
- [x] Debugger Sev1 3건 + Sev2 3건 수정 완료
- [x] `platform/container.ts` (내부 스크롤 컨테이너 자동 감지, window 폴백) — H5 해소 ✅
- [x] `core/storage.ts` (HMAC 서명 sessionStorage 래퍼) — S6 블로커 해소 ✅
- [x] `core/pins.ts` + `core/trail.ts` — 차별화 기능 (pathname-scoped) ✅
- [x] `ui/scrubber.ts` 롱프레스 Pin Drop + 탭 점프 + x/y 합성 거리 취소
- [x] Sev1 1건 (scroll gate) + Sev2 3건 (now() 중복, merge 체이닝, hypot) 수정
- [x] 단위 테스트 9 파일 44건 통과 (신규: storage/pins/trail/container 23건)
- [x] `platform/manualPicker.ts` — Alt+클릭 수동 피커 (10s 자동 취소, blur 취소)
- [x] `core/messages.ts` — content/popup/background 메시지 프로토콜
- [x] `core/settings.ts` — `browser.storage.local` 로드/저장 + sanitize
- [x] `background/entry.ts` — service_worker 기반 상태 관리 + broadcast
- [x] `popup/` — HTML/CSS/JS (320px, prefers-color-scheme 대응)
- [x] `_locales/ko,en,ja` — i18n `__MSG_*__` 메시지
- [x] `PrivacyInfo.xcprivacy` — 심사 대비 선언
- [x] `manifest.json` MV3 `service_worker` + `action` + `default_locale`
- [x] 다중 엔트리 Vite 빌드 (content/background/popup 3회)
- [x] Phase 3 Debugger: Sev1 2건 + Sev2 3건 수정
- [x] `core/telemetry.ts` — opt-in 링 버퍼, off 전환 시 즉시 파기 (D9)
- [x] `ui/magnifier.ts` — 스크럽 중 플로팅 프리뷰 (blur 금지, transform/opacity)
- [x] `core/searchIndex.ts` + `ui/searchPanel.ts` — 자체 검색 패널 (S7 해소)
  - Cmd/Ctrl+Shift+F 단축키, editable 포커스 중 스킵
  - 외부 클릭 시 닫힘
  - 2000 entry cap + 부모 offsetTop 캐시
- [x] `ui/renderer` — `setSearchHits` 계약 확장 + Canvas/DOM 양 구현 glow 마커
- [x] Playwright WebKit perf 게이트 스캐폴드 (`tests/perf/`) + long-article fixture
- [x] Phase 4 Debugger: Sev1 2건 + Sev2 3건 수정
- [x] Xcode Safari App Extension 래퍼 (`safari-web-extension-converter` iOS-only)
- [x] 아이콘 에셋 생성 파이프라인 (`scripts/gen-icons.py`, Pillow 기반, light/dark/tinted)
- [x] iOS Simulator 빌드 검증 (BUILD SUCCEEDED, iPhone 15 Pro)
- [x] 아이폰 설치 가이드 [`docs/INSTALL_IOS.md`](docs/INSTALL_IOS.md)
- [ ] 실기기 설치 (사용자 Xcode GUI 단계)
- [ ] 실기기 검증: iOS Safari 엣지 스와이프, 스크럽 60fps, 다크모드 전환
- [ ] 아이콘 디자인 확정 (현재 placeholder)

## 2. Phase: 차별화 기능
- [ ] Anchor Snap (±12px)
- [ ] Magnifier Preview (transform:scale + opacity, blur 금지)
- [ ] Search Glow (chrome.runtime message)
- [ ] Pin Drop (sessionStorage, max 3)
- [ ] Progress Trail (1px 라인, dirty region)
- [ ] Micro Haptics (iOS, reduce-motion 존중)

## 3. Phase: Pro 수익화
- [ ] Smart Tag Filter
- [ ] Theme Store
- [ ] Layout Customization (좌/우 반전, margin 프리셋)

## 과학적 토론 로그 🧪

| ID | 주제 | 결론 |
|---|---|---|
| D1 | Canvas vs DOM 렌더링 | 하이브리드 (진입 600 / 이탈 550, 1s 쿨다운) |
| D2 | MutationObserver 스코프 | 의미 컨테이너 우선 + body 폴백 + 500ms debounce |
| D3 | 엣지 스와이프 회피 | Pull Handle + margin 16px (Two-Finger 기각) |
| D4 | Rescan 트리거 | Mutation 단독, 앵커 <1500 + 가상 스크롤 의심 시 IO 보조 |
| D5 | Progress Trail 구현 | 채택, 단순 1px 라인 (shadowBlur 금지) |
| D6 | 스크럽 중 smooth scroll | 금지, 즉시 모드 + 종료 시 RAF easing |
| D7 | 튜토리얼 스킵 vs 강제 | 스킵 허용 (리텐션 보호) |
| D8 | 14일 trial vs 기능 제한 | 기능 제한 (1인 CS) |
| D9 | 텔레메트리 off vs opt-out | opt-in + 로컬 링 버퍼 |
| D10 | activeTab vs `<all_urls>` | `<all_urls>` + optional host 토글 |
| D11 | sessionStorage vs storage.session | 하이브리드 (HMAC 키는 후자) |
| D12 | perf 게이트 p50 vs p95 | p95 채택 |
| D13 | 실기기 vs 합성 | 합성 PR + 주 1회 실기기 canary |
| D14 | 공개 vs 비공개 베타 | 초대 20명 비공개 |
| D15 | Sentry vs 자가 엔드포인트 | Sentry + scrubbing |

## 교차 레이어 변경 로그 🔁

| From → To | 조정 내용 |
|---|---|
| UX → Performance | 60fps 하한 Lock, RAF 4ms budget 합의 |
| UX → Performance | Magnifier는 transform/opacity only, blur 불가 |
| UX → Coder | Progress Trail 1px 라인 (shadowBlur 금지) |
| Debugger → UX | H5/H6 자동 감지 실패 시 수동 피커 + 배지 |
| Test → Coder | DI `createScanner`, `__TEST__` 이벤트 버스 |
| UX ↔ Test | 스냅 threshold ±12px 확정 |
| Reviewer → Architect (R2) | MinimapRenderer 계약, 히스테리시스, PlatformCapabilities, perf-budget.json, tuning.ts |
| Debugger R2 → UX | 권한 요청 타이밍(맥락 모달), Private 배너, 텔레메트리 opt-in UI |
| Debugger R2 → Performance | Private 탭 캐시 포기 목록, 링 버퍼 크기 |
| UX R2 → Coder | 저장 스키마(version/side/margin/proStatus/perSiteOverrides), 권한 S2 시점 요청 |
| Performance R2 → UX | quality mode 전환은 무고지 + 배지 표시만 |
| Test R2 → UX | 온보딩 3번째 스텝 옵트인 카드 스펙 |
