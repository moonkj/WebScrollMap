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

### 다음 단계 (Phase 3 배치)
- 수동 피커 UI (컨테이너 감지 실패 시)
- 커스텀 검색 패널 (S7 — Cmd+F 가로채기 금지)
- Popup UI + i18n `_locales/`
- Privacy Manifest `PrivacyInfo.xcprivacy`
- Xcode Safari App Extension 래퍼 (실기기)
