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

### 다음 단계
- design v3 커밋 + GitHub push
- MVP 구현 사이클 진입 — 블로커 11건 (🚨 Sev1 6건 + R2 5건) 우선 해소
