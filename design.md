# WebScrollMap — 설계 요약 (Architect v2, 개선 R2)

> v1 대비 변경: Reviewer R2 지적 5건 전부 반영 (Sev1 1건, Sev2 3건, Sev3 1건).
> **R2 변경 로그는 §10 참조.**


> 팀 리더(Architect) 최종 통합안. UX · Debugger · Performance · Test 4팀의 병렬 리뷰를 바탕으로 과학적 토론을 조율하고 교차 레이어 충돌을 해소.

---

## 0. 한 줄 정의
**긴 웹 페이지를 "지도처럼" 탐색하게 해주는 Safari 확장** — 우측 초슬림 미니맵 + 스켈레톤 렌더 + 스크럽/핀/발광.

## 1. 타깃 & 차별점

| 항목 | 결정 |
|---|---|
| 플랫폼 | Safari Web Extension (iOS + macOS 공용) |
| 기본 사용자 | 긴 블로그/뉴스/문서를 자주 읽는 MZ 독자 |
| 코어 루프 | **탭 점프 → 드래그 스크럽 → 검색 발광 → Pin Drop** |
| 기각한 MZ 과잉 | 글래스모피즘, Streak 게이지, 소셜 공유, 이모지 앵커 (UX 판단 수용) |

---

## 2. 과학적 토론 결론 🧪

### D1. Canvas vs DOM 렌더링
- **결론: 하이브리드(런타임 분기)**
  - 앵커 수 < 600 → **DOM + Shadow DOM** (접근성·유연성 우위, Performance 벤치마크 동률)
  - 앵커 수 ≥ 600 → **Canvas** (GPU·메모리 우위)
  - 경계에선 페이지 전환 없이 동적 전환 가능해야 함.
- **근거**: Performance가 제시한 "<600에서 DOM 무승부, >1500에서 Canvas 2~3배 승" 가설 + Debugger의 "접근성·CSP tainted 회피" 근거 모두 수용.
- **추가 제약**: DOM 모드에서도 Shadow DOM 내부에 `all: initial` 리셋 레이어 필수(H2).

### D2. MutationObserver 스코프
- **결론: 의미 컨테이너 우선, body 폴백 + 강한 debounce**
  - 1차: `main, article, [role=main]` 중 `scrollHeight` 최대 후보
  - 2차: 없으면 `document.body` + debounce 500ms
  - 모든 모드에서 `attributes/characterData:false`, `childList+subtree:true`
- **자기 자신 observe 금지**: 우리 Canvas/Shadow host는 observer에서 제외.

### D3. iOS 엣지 스와이프 충돌
- **결론: Pull Handle 메타포 + margin 16px 기본**
  - 우측 엣지 0~8px은 iOS 제스처 존으로 "양보"
  - 미니맵 본체는 8~24px (hover/touch 시 24px 확장)
  - 외곽 2px에 수직 핸들 힌트
  - 설정에 "좌/우 반전 + margin 0/16/24" 3프리셋 제공 (Debugger 제안 수용)
  - Two-Finger Scrub은 **기각**: 한 손 사용 시나리오 (출근길 모바일) 핵심 UX 훼손

### D4. Rescan 트리거
- **결론: MutationObserver 단독, 단 앵커 > 1500일 때만 IntersectionObserver 보조 off**
  - IO observe 5000개는 자체 비용이 크므로 임계값(1500) 기준 분기
  - 앵커 < 1500 + 가상 스크롤 의심 → IO로 정밀화

### D5. Progress Trail (MZ 제안)
- **결론: 채택하되 단순 구현**
  - 지나간 스크롤 구간을 미니맵 좌측 1px 라인으로 누적
  - Performance 경고 수용: `shadowBlur` 금지, CSS `opacity` transition만 사용
  - `sessionStorage` 탭별 저장, pathname 키

### D6. 스크럽 중 `scrollTo({behavior:'smooth'})` 사용
- **결론: 금지** (Performance 판단 그대로)
  - 드래그 중에는 즉시 `scrollTo(0, y)`
  - 드래그 종료 후 **최종 스냅 보정**에서만 자체 RAF easing (3~4 프레임)

---

## 3. 최종 기능 스펙 (MVP + 차별화)

### MVP (1차 출시)
1. 우측 고정 미니맵 (3px 슬림 → 24px 확장)
2. Viewport Indicator (반투명 박스)
3. 탭/드래그 스크럽
4. 스켈레톤 렌더 (h1~h3 · img · video · strong · a 밀집)
5. 다크모드 자동 (`prefers-color-scheme` + body 배경 휘도 YIQ 이중 판정)
6. 짧은 페이지 자동 비활성 (viewport × 1.5 미만)

### 차별화 (2차)
7. **앵커 오토스냅** — threshold ±12px (Test 제안 확정)
8. **매그니파이 프리뷰** — 터치 지점 ±15% 확대 + h1 텍스트 40자
9. **검색어 발광** — Cmd+F 연동, 시안 펄스 1.5Hz × 3회
10. **Pin Drop** — 롱프레스로 위치 고정, 최대 3개, `sessionStorage` (탭별)
11. **Progress Trail** — 읽은 구간 트레일 (재방문 시 흐릿하게 복원)
12. **마이크로 햅틱 (iOS)** — 스냅/섹션 진입 시 20ms 탁, 시스템 설정 팔로우

### Pro (유료, 3차)
13. 스마트 태그 필터 (이미지만/제목만)
14. 테마 스토어 (커스텀 색상, 단 `shadowBlur`는 제한)
15. 위치·여백·두께 커스텀

---

## 4. 화면/상태 매트릭스

| 상태 | 폭/불투명 | 트리거 | 비고 |
|---|---|---|---|
| 슬림 | 3px / 40% | 기본 | 방해 최소 |
| 확장 | 24px / 85% | hover 또는 touchstart | 섹션 라벨 표시 |
| 스크럽 | 24px + 매그니파이 | touchmove | h1 프리뷰 플로팅 |
| 검색 발광 | 시안 펄스 | Cmd+F 연동 | 3회 후 정적 마커 |
| 비활성 | 렌더 생략 | 짧은 페이지 / RTL-vertical / 가상 스크롤 감지 | 배지로 이유 표시 |
| 로딩 | 1px 세로선 | 스캔 중 | 레이아웃 시프트 방지 |
| 에러 | UI 숨김 | 사일런트 폴백 | 토스트 금지 |
| 다크 | 소프트 화이트 팔레트 | 휘도 임계 이하 | 트레일은 형광 금지 |

---

## 5. 성능 예산 (Lock)

| 지표 | 목표 | 레드라인 |
|---|---|---|
| 첫 렌더 (p50) | < 150ms | < 300ms (p95) |
| DOM Scan (앵커 500) | < 8ms | < 20ms (2000개) |
| 스크럽 FPS | 58~60 | 55 미만 1프레임도 불가 |
| 탭→점프 응답 | < 16ms | 입력~scroll 시작 |
| 메모리 (iOS) | +< 15MB | +< 30MB (macOS) |
| SPA 100회 라우팅 후 힙 | +< 2MB | 누수 감지 기준 |

---

## 6. 교차 레이어 조정 로그 🔁

| 충돌/의존 | 해결 |
|---|---|
| UX "60fps 하한" vs Performance "RAF 4ms budget" | **일치** — 프레임당 미니맵 할당 4ms, 페이지 scroll reflow 12ms |
| UX "마이크로 애니메이션 + 매그니파이" vs Performance "shadowBlur 금지" | 매그니파이는 `transform: scale()` + `opacity` transition만, blur 불가 |
| UX "Progress Trail" vs Performance "Canvas 재그리기 비용" | 트레일은 dirty region의 좌측 1px 라인 only, 프레임당 < 1ms |
| Debugger "H5/H6 (내부 스크롤/가상)" | UX가 **수동 피커 + 배지** 제공 (자동 감지 실패 시) |
| Test "DI/`__TEST__` 훅" | Coder에게 전달 — `createScanner({now, random, observer})` 시그니처 강제 |
| Test "fixture 기반 CI + nightly 실사이트" | 채택, PR 게이트는 fixture만 |
| UX "앵커 스냅 threshold 정량화 요청" | **±12px** 확정 (Test 기준) |

---

## 7. 기술 스택 (Architect 확정)

- **플랫폼**: Safari Web Extension (`manifest.json` v3, macOS Xcode 래퍼)
- **언어**: TypeScript (strict) — iOS/macOS 공용 content script
- **렌더**: Canvas 2D + DOM 하이브리드 (D1)
- **격리**: Shadow DOM (`mode: 'closed'`) + `all: initial` 리셋
- **상태**: 순수 함수 중심, 글로벌 상태는 `WeakMap<Document, State>`
- **빌드**: Vite + Safari App Extension 번들 변환
- **테스트**: Vitest (단위) + happy-dom (통합) + Playwright(WebKit) (E2E)
- **컨벤션**: 함수형 우선, 클래스는 Observer/Renderer만

---

## 8. 다음 단계 (Coder 디스패치 입력)

Coder에게 요구:
1. 모듈 트리 (core / content / ui / test 폴더)
2. 타입 정의 (`AnchorPoint`, `DensityBlock`, `ScannerResult`, `RenderContext`)
3. 핵심 함수 시그니처 (Scanner, Renderer, Scrubber, Observer)
4. DI 진입점 (`createScanner({now, random, observer})`)
5. Shadow DOM 생성 유틸
6. 구현은 하지 말고 **골격/API 표면**까지만

---

## 10. R2 개선 반영 로그 🔁

| # | Reviewer 지적 | Sev | 반영 |
|---|---|---|---|
| R2-1 | **렌더러 인터페이스 계약 부재** (Canvas/DOM 드리프트) | **Sev1** | `interface MinimapRenderer { mount/update(anchors)/highlight(id)/destroy }` 계약 추가 → Canvas/DOM 구현은 이 계약만 준수. 테스트는 인터페이스 대상. **Coder API의 `Renderer` 타입을 이 계약으로 승격.** |
| R2-2 | 렌더 모드 전환 히스테리시스 부재 | Sev2 | **진입 600 / 이탈 550 + 1초 쿨다운**. `pickRenderMode(prev, count, lastSwitchAt)` 시그니처로 변경. |
| R2-3 | 플랫폼 분기 산재 위험 (iOS vs macOS) | Sev2 | `PlatformCapabilities` 어댑터 신설 — `{ haptics, pointerType, safeAreaInsets, isIOS }` 단일 관문. `if (isIOS)` 산재 금지. |
| R2-4 | 성능 예산 검증 자동화 경로 불명 | Sev2 | `perf-budget.json` 루트에 커밋 + Playwright `performance.mark` 스모크 + CI에서 회귀 자동 리포트 (Test Engineer 제안 연동). |
| R2-5 | Mutation debounce 500ms 매직넘버 | Sev3 | `/src/config/tuning.ts`로 격리 + 사이트 프로파일 훅 자리 예약 (값은 500 유지). |

## 11. 리스크 대시보드 (Debugger H1~H12 매핑)

- **Must-fix (배포 블로커)**: H1(엣지 스와이프), H3(Mutation 폭주), H5(내부 스크롤), H6(가상 스크롤), H12(메모리 누수) — 모두 위 설계에 반영
- **Guard**: H2(Shadow DOM 누수), H4(SPA), H7(sticky), H9(zoom/DPR), H10(다크 휘도) — 각 모듈에 방어 로직 필수
- **Advisory**: H8(CSP), H11(RTL/vertical) — 감지 후 사일런트 비활성
