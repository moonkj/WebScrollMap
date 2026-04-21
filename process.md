# WebScrollMap — Process Log

> Architect가 각 구현 단계 진행 시마다 갱신하고 git commit.

## 2026-04-20

### [00] 프로젝트 킥오프
- 제품명: **WebScrollMap** 확정
- 팀 에이전트 역할 메모리 등록 (`team_agent_roles.md`)
- `Tasklist.md`, `process.md` 스켈레톤 작성

### [01] 병렬 팀 리뷰 (UX / Debugger / Performance / Test)
- 4명 Teammate가 단일 메시지 병렬 디스패치로 동시 분석
- 산출:
  - UX: MZ 스타일 제안 중 **Pin Drop, Progress Trail, 마이크로 햅틱** 채택 / Streak·글래스·소셜 공유 기각
  - Debugger: 가설 H1~H12 + 🧪 D1~D4 + Defer 8건
  - Performance: 예산 Lock + 런타임 분기 기준 제시
  - Test: 12 시나리오 (Sev1 7) + 회귀 안전망 + 리뷰어 기준

### [02] Architect 과학적 토론 조율 → 설계 v1
- D1 Canvas vs DOM → 하이브리드 (앵커 600 임계)
- D2 Mutation → 의미 컨테이너 + debounce 500ms
- D3 엣지 스와이프 → Pull Handle + margin 16px (Two-Finger 기각)
- D5 Trail 채택, D6 스크럽 smooth 금지
- `design.md` v1 작성

### [03] Coder 모듈 설계 + 타입 API
- `/src` 13모듈 트리, TypeScript strict, DI 시그니처
- 팩토리 6종: `createScanner / createRenderer / createScrubber / createObserverBus / mountShadowHost / detectTheme`
- DEV-only `__TEST__` 버스 (import.meta.env.DEV 가드, tree-shake)

### [04] Reviewer 최종 검토 → 🔁 R2 트리거
- Sev1 1건: **`MinimapRenderer` 인터페이스 계약 부재**
- Sev2 3건: 히스테리시스 없음 / PlatformCapabilities 산재 / 성능 예산 검증 자동화 불명
- Sev3 1건: Mutation debounce 매직넘버

### [05] Architect R2 개선 반영 → 설계 v2
- R2-1: `MinimapRenderer { mount, update, highlight, destroy }` 계약 승격
- R2-2: 히스테리시스 진입 600 / 이탈 550 + 1s 쿨다운
- R2-3: `PlatformCapabilities` 어댑터 신설
- R2-4: `perf-budget.json` 커밋 + Playwright 연동
- R2-5: `/src/config/tuning.ts` 격리

### [06] 최종 산출물
- `README.md` / `docs/SPEC.md` / `docs/USAGE.md` / `perf-budget.json` / `design.md` v2
- `Tasklist.md` 업데이트 (과학적 토론 6개, 교차 레이어 7개 기록)

### [07] 2차 설계 리뷰 라운드 (R2+)
- 팀 4명 병렬 재디스패치 — 각자 1차에서 얕게 다룬 영역 담당
  - UX: 온보딩·Popup·Pro 페이월·App Store·i18n
  - Debugger: S1~S15 보안·프라이버시·권한·공급망 — 🚨 App Store 블로커 6건
  - Performance: 에너지 벤치마크·Playwright 게이트·3단계 quality mode·사이트 프로파일
  - Test: 릴리스 게이트·비공개 베타 20명·Sentry·킬 스위치
- 과학적 토론 9건 추가 (D7~D15)
- 설계 v3 확정 (design.md §12~14)

### [08] MVP Phase 1 구현 착수
- Safari Web Extension 스캐폴딩: `manifest.json` v3, Vite + TS strict, Vitest, happy-dom
- `package.json` 의존성 설치, `tsconfig.json` 경로 alias (`@core/`, `@ui/`, `@platform/`, `@config/`, `@test/`)
- Vite 빌드: 단일 IIFE `extension/dist/content.js` (14.19KB, gzip 5.17KB)

### [09] 핵심 모듈 구현 (Sev1 블로커 해소)
- `MinimapRenderer` 인터페이스 계약 확립 (R2-1 Sev1 ✅)
- `pickRenderMode` 히스테리시스 600/550 + 1s 쿨다운 (R2-2 ✅)
- `PlatformCapabilities` 어댑터 (R2-3 ✅)
- `config/tuning.ts` 매직넘버 격리 (R2-5 ✅)
- `shadowHost.ts` 랜덤 태그명으로 S5 변조 방지

### [10] 테스트 + Debugger 패스
- Vitest 21/21 통과 (snap, renderMode, scanner, hash, shouldActivate)
- Debugger가 Sev1 3건(pointer-events 이중설정, pushState 체인 복원, offsetParent detached) + Sev2 3건(rect 캐시, sentinel 혼동, canvas clip) 식별
- 전부 즉시 수정, 재테스트 21/21 통과, 빌드 통과

### [11] Phase 2 순수 코딩 배치 — H5/S6 블로커 해소 + 차별화 기능
Architect 판단: Xcode 래퍼는 GUI 딜레이 리스크, 코드만으로 끝나는 고임팩트 블로커부터 처리.

- `platform/container.ts` — window → 내부 element 휴리스틱 감지 (Gmail/Slack/Notion/Discord 대응, H5 ✅)
- `core/storage.ts` — djb2 기반 HMAC-like 서명, tampered payload 파기, private-mode silent fail (S6 ✅)
- `core/pins.ts` — pathname-scoped Pin CRUD, 최대 3개
- `core/trail.ts` — 세그먼트 merge-on-write (48px gap), 256 cap, 1s debounced flush
- `ui/scrubber.ts` 확장 — 롱프레스 Pin Drop (500ms, 6px tolerance, hypot), 탭-점프 모드
- `content/entry.ts` 통합 — 컨테이너 감지 → 스캔 루트/스크롤 타겟 분기, Trail 250ms 샘플링

### [12] Debugger R2 패스 + Sev 수정
- Sev1: 롱프레스 중 scroll 보류 게이트 (pin 찍기 직전 화면 점프 방지)
- Sev2: storage now() 중복 호출 → HMAC 불일치 해소
- Sev2: trail mergeInto가 첫 매칭 이후 후속 segment 흡수 못 하는 버그 → 한 번 훑는 루프
- Sev2: 롱프레스 취소 판정에 x축 이동도 포함 (hypot)

### [13] 테스트/빌드
- 9 파일 44/44 통과 (신규: storage 6, pins 6, trail 6, container 5)
- Vite 빌드 18.24KB (gzip 6.62KB)

### [14] Phase 3 순수 코딩 배치 — UI/i18n/심사 대비
Architect 판단: 실기기 불필요한 영역 집중 처리.

- `core/messages.ts` — content/popup/background 메시지 프로토콜 (discriminated union)
- `core/settings.ts` + `platform/browserApi.ts` — storage 어댑터 + sanitize
- `background/entry.ts` — MV3 service_worker 상태 허브
- `popup/` — 320px HTML/CSS/JS, 토글/위치/여백/핀·트레일 지우기
- `_locales/ko,en,ja` — i18n 메시지
- `platform/manualPicker.ts` — Alt+클릭 수동 컨테이너 피커 (H5 보조)
- `PrivacyInfo.xcprivacy` — App Store 심사 대비 선언
- `manifest.json` MV3 `service_worker`/`action`/`default_locale`
- Vite 다중 엔트리 빌드 (`ENTRY=<name>` 3회, IIFE 유지)

### [15] Phase 3 Debugger R3 패스 + Sev 수정
- Sev1: manifest MV3 `background.scripts` → `service_worker` 전환
- Sev1: popup.html 스크립트 경로를 `/dist/popup.js` 절대 경로로
- Sev2: enabled 토글 왕복 시 teardown 대신 host display 전환
- Sev2: manualPicker 10s 자동 취소 + blur 취소
- Sev2: settings-changed 핸들러 응답 즉시 반환 (동기)

### [16] 테스트/빌드
- 11 파일 53/53 통과 (신규: settings 5, messages 4)
- Vite 3엔트리: content 21.91KB / background 2.39KB / popup 3.00KB

### [17] Phase 4 순수 코딩 배치 — 차별화 기능 + S7 블로커 + perf CI
- `core/telemetry.ts` — opt-in 링 버퍼 (100 cap, off 즉시 파기)
- `ui/magnifier.ts` — 스크럽 중 플로팅 프리뷰
- `core/searchIndex.ts` + `ui/searchPanel.ts` — 자체 검색 (S7 해소)
  - Cmd/Ctrl+Shift+F, editable 포커스 중 스킵
  - 외부 클릭 자동 닫힘
- `ui/renderer` 계약 확장: `setSearchHits` + 양 구현 glow 마커
- Playwright WebKit perf 게이트 (`tests/perf/` + long-article fixture)

### [18] Phase 4 Debugger 패스
- Sev1: Cmd+Shift+F가 input/textarea/contentEditable에서 타이핑 방해 → isEditableTarget 가드
- Sev1: searchIndex 5000 cap + 부모 offsetTop 미캐시 → 2000 cap + WeakMap 캐시
- Sev2: SPA nav 시 magnifier 잔상 → hide() 호출
- Sev2: searchPanel 외부 클릭 닫힘 누락 → composedPath pointerdown 리스너
- Sev2: renderer.mount() 전 setSearchHits 호출 시 유실 → mount에서 재적용

### [19] 테스트/빌드
- 13 파일 64/64 통과 (신규 telemetry 5, searchIndex 5)
- Vite 3엔트리: content 28.5KB / background 2.39KB / popup 3.00KB
- Playwright perf 스펙 (WebKit) 스캐폴드 준비

### [20] Phase 5 — iOS 실기기 설치 준비
- `xcrun safari-web-extension-converter` 로 네이티브 iOS 래퍼 자동 생성 (`native/WebScrollMap/`)
- `scripts/gen-icons.py` (Pillow) — AppIcon(1024 light/dark/tinted) + LargeIcon(256) + 웹 확장(16/32/48/64/128)
- `manifest.json`에 `icons` + `action.default_icon` 선언
- iOS Simulator (iPhone 15 Pro) 빌드 **BUILD SUCCEEDED**
- `docs/INSTALL_IOS.md` — Apple ID Free 계정으로 Xcode ⌘R 설치하는 가이드
- `.gitignore`에 Xcode DerivedData/xcuserdata 제외

### [21] Phase 6 — iOS 실기기 설치 + 즉시 UX 픽스
- `xcrun devicectl`로 iPhone 자동 설치 파이프라인 구축
- Closed shadow DOM → Open shadow 전환 (composedPath가 floatingPins/searchPanel 이벤트 차단하던 critical 버그)
- 중복 주입 가드 (`__WEB_SCROLL_MAP_LOADED__`) + `[data-wsm="1"]` 정리
- 스크럽 좌표계 통일: `mapEventToY`(scroll) vs `mapEventToDocY`(doc) 분리 → 핀이 누른 자리 위에 찍히던 버그 해소
- EMA 저역필터 (`EMA_ALPHA=0.35`) → "따닥따닥" jitter 해소
- 바 두께 CSS var (`--wsm-visible`) + 4/10/20px 옵션 (한글 라벨)

### [22] Free/Pro Tier + StoreKit 2 + 호스트 앱 온보딩
- `core/featureGate.ts` — 16개 Pro 기능 게이트, `applyTierConstraints`
- `core/adminConfig.ts` — 5-click unlock / force-free/pro override / 월간 통계 rollover
- `platform/iapBridge.ts` + Swift `EntitlementManager` — StoreKit 2 + djb2 서명
- Swift `HapticsManager` — CHHapticEngine pin/snap/edge 패턴
- 호스트 앱 (Scrolly 패턴 참고): 3단계 온보딩 + 7개 피처 카드 + Privacy/Terms/Support 서브뷰
- 네이비 테마 아이콘 (`scripts/gen-icons.py`) — Light/Dark/Tinted 1024
- 구매 실패 분류 (`product-not-available` / `user-cancelled` 등) → 팝업 status 표시

### [23] 2차 팀 리뷰 — Group A/B/C 보안·성능·배터리
**Group A (즉시 적용):**
- Page Visibility API — `document.hidden` 시 scroll/trail/mutation 스킵 (iOS 6시간 독서 15~20% 배터리 절감)
- Device ID: `Math.random` 36bit → `crypto.getRandomValues` 128bit (S4)
- Pin `aria-label` 익명화 (snippet 페이지 JS 노출 차단) (S7)
- Bootstrap `Promise.all` 병렬화 (30ms → 12ms)

**Group B (중간 위험):**
- MutationObserver adaptive debounce (hidden 시 1000ms)
- Swift `HapticsManager` 8초 idle → engine stop
- `isWsmMessage` payload 엄격 검증 (S6)
- clip-path `prefers-reduced-motion` 지원
- S5 closed shadow 보류: floatingPins/searchPanel 재앙 방지

**Group C (아키텍처):**
- `sign64` = djb2+fnv1a 64bit hex 합성 (JS+Swift 동기화) — 위조 비용 2^32배 상승
- storage SignedRecord v1→v2 자동 파기

### [24] 6개 언어 i18n 확장
- ko / en / ja + **zh_CN / fr / hi** 추가
- Main.html I18N: zh/fr/hi 엔트리 + 언어 감지 체인 (LEGAL은 영문 fallback)
- Extension `_locales/*/messages.json` 37키 동기화

### [25] 커버리지 90%+ 달성 — 팀원 4명 병렬 테스트 작성
- A(Easy): palette/theme/browserApi/platform — 49 tests
- B(UI render): upgradeToast/sectionBadge/shadowHost/magnifier/rendererDom — 63 tests
- C(UI state): scrubber/floatingPins/searchPanel/renderer.canvas — 41 tests
- D(Platform + core boost): observerBus/iapBridge/manualPicker + 기존 4파일 보강 — 84 tests
- Architect(통합): renderer/telemetrySender + sectionBadge 실제 버그 발굴·수정 — 11 tests
- **최종: 97개 → 344개 테스트, 커버리지 33.6% → 96.96% stmts / 86.60% branches**

### [26] 3차 팀 리뷰 — P0~P3 17건 일괄 수정
**재리뷰 발견:**
- Debugger: Sev2 5 / Sev3 5 (applyTierRefresh 예외 누락, observerBus hidden→visible 영구 미동기화 등)
- Security: sign64 padding 누락 (길이 가변), S2 근본 취약점 (Apple receipt 필요)
- UX/Reviewer: `purchaseErrorMessage` 한국어 하드코딩, reduced-motion 미지원, aria-label 영어 고정

**수정 17건 일괄:**
- **P0×5**: 구매 에러 6개 언어화(12 키 추가) / sign64 8-char padding / zh-CN 전용 감지 / Promise.all 전수 .catch / applyTierRefresh .catch 응답 보장
- **P1×6**: onVisibilityChange 재스캔 / observerBus pendingSuppressed 재발화 / sectionBadge dedup 순서 / isWsmMessage entitlement 필수 필드 검증 / wsm-shake reduced-motion / 팝업 aria-label 자동 i18n 바인딩
- **P2×5**: Admin 5-click 진행도 `(N/5)` / searchIndex `requestIdleCallback` 선빌드 / 토스트 동적 duration (2400~5000ms) / HapticsManager DispatchQueue 직렬화 / (Tab selective broadcast 재평가 후 all-tabs 유지)
- **P3×1**: storage v1→v2 migration 주석

**검증:** Typecheck 통과, **345/345 tests**, 번들 content 54.5KB / background 6.6KB / popup 10.8KB

### 잔존 장기 과제
- S2: Apple receipt validation (서버 인프라 $200/월) — Pro 우회 근본 해결
- Swift XCTest 추가 (Native IAP/Haptic 검증)
- Playwright E2E (happy-dom 한계: Canvas / TreeWalker / history.pushState)
- LEGAL 정책 ja/zh/fr/hi 번역 (현재 영문 fallback)

## 2026-04-21

### [27] 비즈니스 모델 전환 — Free/Pro → App Store 단일 0.99$ 구매
- 유/무료 tier 제거. App Store 다운로드 = 전체 기능 사용. 인앱 구매 없음.
- `featureGate.ts` 항상 true 반환, `applyTierConstraints` 패스스루로 단순화
- 메시지 타입 제거: `purchase-pro`, `restore-purchases`, `entitlement-changed`, `set-admin-override`, `reset-admin-stats`
- `get-entitlement`은 레거시 호환으로 `{tier: 'pro'}` 항상 반환
- Main.html(호스트 앱 설명)에서 Pro/StoreKit/grace period/월 구독 문구 제거
- 지원 섹션에서 GitHub 링크 + Gmail/Slack Q&A 삭제

### [28] 팝업 UX 개편
- **기본값 변경**: side=right, marginPx=0, barWidthPx=10(보통), floatingOpacity=70%, theme=default(첫째 색)
- 하단 버전 표기 `v1.0.0`
- 관리자 모드 기능 일시 도입(5-click unlock, 비번 1639, 누적 사용자 수 표시) → 최종 **전체 삭제**
  - `adminConfig.ts`, `config/secrets.ts`, `config/secrets.example.ts`, `tests/unit/adminConfig.test.ts` 제거
  - 관련 메시지(`get-admin-config`, `set-admin-enabled`) + CSS + i18n 키 정리

### [29] 핀 UX 수정 — 꾹 누른 위치에 핀
- iOS Safari에서 `window.prompt` 차단 → 인라인 비밀번호 폼으로 대체 후 관리자 모드와 함께 삭제
- `onLongPress` 동작: 현재 뷰포트 중앙 → 손가락 doc Y(`barDocY`)로 변경
- 화면 이동(`container.setScrollY`) 제거 — 꾹 눌러도 페이지 스크롤 없음

### [30] 스크럽 인디케이터-손가락 정합 — 팀 4명 병렬 디버깅
**증상**: 바 스와이프 시 손가락이 인디케이터 하단에 위치(중앙이어야 함), 핀이 인디케이터 중간에 찍혀 불일치.

**Coder**: 빌드 최신 / 소스 일치 확인
**Debugger**: long-press 취소 직후 첫 move에서 `onScrubMove` 호출 누락 → indicator가 stale scrollY로 렌더
**Performance Engineer**: `onScroll` premature clear(100px tolerance) + visualViewport 미스매치 가설
**Test Engineer**: 6개 시나리오 수학적 계산 모두 `finger=visualCenter` 일치 — 로직 정확 확인

**수정 (scrubber.ts + indicator.ts + content/entry.ts)**:
- `mapEventToY`: `pct * docH - vpH/2` (unclamped) — 브라우저가 scrollTop 자연 clamp
- `computeIndicatorStyle`: 대칭 shrink로 바 경계에서도 중심 보존 (기존엔 top shift로 중심 이동)
- `onPointerDown`에서 즉시 `onScrubMove` 호출 → 초기 터치부터 indicator가 손가락 따라감
- long-press 취소 직후 첫 move에서 `onScrubMove` + `schedule` 호출 + early return
- `onLongPress` 콜백 끝에서 `scrubCommandY = null` 리셋해 stuck 방지
- `onScroll` clear 조건: scrubCommandY를 `[0, docH-vpH]`로 clamp 후 비교

**인디케이터 테스트 재작성** (`indicator.test.ts`): 대칭 shrink 동작 반영 — `symmetric shrink at doc start/end preserves center`

### [31] 1.0.0 릴리스 준비
- `extension/manifest.json`: 0.2.0 → **1.0.0**
- `pbxproj`: `MARKETING_VERSION = 1.0` → **1.0.0**
- `extension/dist/*` + `popup.html` + `manifest.json` → 네이티브 Extension Resources로 동기화
- **검증**: Typecheck / 321 tests / build OK (content 49.87KB / background 3.66KB / popup 5.62KB)

### [32] GitHub Pages 개인정보/지원 페이지 + Apple 스타일 랜딩
- `docs/index.html` + `privacy.html` + `support.html` — Apple 제품 페이지 톤(SF Pro / #fbfbfd / blur nav)
- 6개 언어 기준 "수집/전송 없음, 로컬 저장만" 개인정보 처리방침
- Support: 설치/사용법/FAQ + `mailto:imurmkj@naver.com`
- App Store Connect 입력용 URL: `https://moonkj.github.io/WebScrollMap/privacy.html` / `support.html`

### [33] 스크럽 라벨 접두어 제거
- Magnifier/SectionBadge에서 `H1 · `, `H2 · `, `B · `, `IMG · ` 등 type prefix 제거 → snippet만 표시
- 관련 테스트 재작성 (`'Intro'`, `'Beta'`, `'Details'` 등 순수 snippet 기대)

### [34] iPad 설치 + floatingPins 반응형 + 테마 컬러
- xcrun devicectl로 무선 아이패드 설치 경로 확립 (Team ID `QN975MTM7H`)
- `FloatingPins` iPad 대응: 패널 180→280px, 최대높이 260→400px, 폰트 12→15px, 버블 44→56px, 삭제 버튼 48×48
- **테마 accent 15% 블렌딩 배경** — default 오렌지 크림, sunset 핑크, ocean 블루, forest 그린, mono 그레이 (light/dark 양쪽)
- `setPalette` 런타임 업데이트 지원 — 테마 변경 시 패널·보더·버블 즉시 반영

### [35] 핀-스크럽 정합 근본 수정 — 팀 에이전트 병렬 디버깅
**증상**: 핀 찍은 후 다음 스크럽에서 손가락이 인디케이터 하단에, 바 맨 아래 터치하면 핀이 위쪽에 찍힘.

**팀 분석 (4명 병렬 2라운드)**:
- Debugger H5: 핀 엘리먼트 `pointer-events:auto + width:100% + height:12px` 오버레이 → 이벤트 flow 교란 가능성
- Coder: 상태 전환 로직 정확 — scrubCommandY null→initialY 동기
- Test Engineer: 수학적으로 모든 시나리오 통과 → iOS Safari 런타임 이슈
- Architect: 핀 hit area와 track clip-path 불일치 지적
- **결정적 발견**: **호스트가 `position:fixed; top:0; bottom:0`으로 layout viewport 전체(예 844px)를 채우지만, 사용자 visual viewport는 URL바 제외 더 작음(예 700px)**
  - 바가 visual 아래로 연장되어 높은 pct 인디케이터가 보이지 않는 영역에 렌더
  - clientY는 visual 기준 → pct = clientY/layoutH가 실제 visual pct보다 작음
  - 인디케이터가 finger보다 위쪽, 핀도 위쪽에 배치

**수정 5곳**:
- `content/entry.ts applyVisualHeight()`: 호스트를 `visualViewport.height`로 고정, `offsetTop`으로 top 보정
- `visualViewport.resize`/`scroll` 이벤트에 동기화 + 매 `onStateChange('scrubbing')`에서 강제 재적용
- `container.getHeight()`: `visualViewport.height` 우선
- `scrubber.refreshRect`를 외부 호출 가능하게 공개 (ScrubberController)
- 핀 DOM wrapper `pointer-events: none` + width 8px로 이벤트 오버레이 제거

### [36] 햅틱 기능 완전 제거 + 파도 리플 피드백
**결정 배경**: iOS Safari Extension 프로세스가 CoreHaptics/UIKit FeedbackGenerator/AudioServicesPlayAlertSound 모두 실제 진동 트리거하지 못함 확인 (4중 시도 실패). 사용자 요구대로 햅틱 제거 + 시각 피드백 대체.

**제거**:
- `src/platform/iapBridge.ts` `playHaptic` 함수 삭제
- `src/ui/scrubber.ts` `onHaptic` 콜백 제거
- `src/background/entry.ts` `case 'haptic'` 핸들러 제거
- `src/core/messages.ts` `'haptic'` 메시지 타입/검증 제거
- `SafariWebExtensionHandler.swift` HapticsManager 전체 + UIKit/CoreHaptics/AudioToolbox import 삭제
- `Main.html` 햅틱 feature 카드 + 6개 언어 i18n 삭제
- 관련 단위 테스트 7건 정리

**추가 — 파도 리플**:
- 핀 고정 시 바 위 `spawnRipple(barDocY)` 호출
- 24×24px 원형 border → `scale 0.1 → 8`로 8배 확산, opacity 0.9→0, border 2px→0.5px
- 720ms cubic-bezier 애니메이션 후 자동 제거
- 테마 accent 색(`palette.pin`) 사용 — 테마에 따라 주황/핑크/블루/그린/그레이 파도

**검증**: Typecheck / 314 tests / 빌드 (content 49.19KB / background 3.33KB / popup 5.62KB)

