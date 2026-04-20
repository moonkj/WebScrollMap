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

## 1. Phase: MVP 구현 (다음 사이클)

### 블로커 해소 필수 (R2 반영)
- [ ] 🚨 `MinimapRenderer` 인터페이스 계약 확립 (Sev1)
- [ ] 히스테리시스 구현 (600/550 + 1s 쿨다운)
- [ ] `PlatformCapabilities` 어댑터
- [ ] `config/tuning.ts` 격리
- [ ] Playwright perf 스모크 + `perf-budget.json` CI 연동

### 핵심 모듈
- [ ] Safari Web Extension 스캐폴딩 (macOS+iOS 공용)
- [ ] `core/scanner.ts` (offsetTop + offsetParent 누적, getBoundingClientRect 금지)
- [ ] `ui/shadowHost.ts` (closed + all:initial)
- [ ] `ui/renderer.dom.ts` / `ui/renderer.canvas.ts`
- [ ] `ui/scrubber.ts` (RAF throttle, passive touch, scrollTo 즉시 모드)
- [ ] `platform/container.ts` (내부 스크롤 컨테이너 자동 감지 + 수동 피커)
- [ ] `platform/observerBus.ts` (Mutation 500ms debounce, SPA pushState monkey-patch)
- [ ] `platform/edgeSwipe.ts` (Pull Handle, margin 16px)

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
