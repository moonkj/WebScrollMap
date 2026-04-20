# WebScrollMap

> 긴 웹페이지를 우측 미니맵으로 "지도처럼" 탐색하는 Safari Web Extension (iOS + macOS)

## Why?

무한 스크롤과 장문 아티클이 일상이 된 모바일 웹에서 현재 위치와 전체 맥락을 한눈에 파악하기 어렵다. WebScrollMap은 페이지의 뼈대(heading, media, emphasis)를 우측에 스켈레톤 미니맵으로 상주시켜, 스크롤을 "탐색 가능한 지형"으로 바꾼다.

## Core Features

| 기능 | 설명 | 상태 |
|------|------|------|
| Skeleton Render | `h1~h3`, `img`, `video`, `strong`, `a` 추출 후 축소 렌더 | MVP |
| Canvas+DOM Hybrid | 앵커 수 기반 런타임 분기 (≥600 Canvas, 히스테리시스 진입 600/이탈 550) | MVP |
| Shadow DOM 격리 | `mode: 'closed'` + `all: initial` 샌드박스 | MVP |
| Viewport Indicator | 현재 화면 영역 반투명 박스 | MVP |
| Pull Handle | iOS 엣지 스와이프 충돌 회피 메타포 (margin 16px) | MVP |
| Anchor Snap | ±12px threshold 자동 스냅 | 차별화 |
| Magnifier Preview | 스크럽 지점 ±15% 확대 + h1 프리뷰 | 차별화 |
| Search Glow | Cmd+F 매칭 위치 시안 펄스 | 차별화 |
| Pin Drop | 롱프레스 핀 고정 (최대 3, sessionStorage) | 차별화 |
| Progress Trail | 읽은 구간 1px 라인 트레일 | 차별화 |
| Micro Haptics (iOS) | 스냅/섹션 진입 20ms 탁 | 차별화 |
| Smart Tag Filter | 제목만/이미지만 모드 | Pro |
| Theme Store | 커스텀 팔레트 | Pro |
| Layout Customization | 좌/우 반전, margin 0/16/24 프리셋 | Pro |

## Architecture at a Glance

```
src/
├─ core/        # 순수 로직 (scanner, density, snap, hash, assert)
├─ content/     # content script 부트스트랩 + 수명주기
├─ ui/          # Shadow DOM + Canvas/DOM 하이브리드 Renderer + Scrubber
├─ platform/    # container 탐지, observerBus, haptic, edgeSwipe
├─ config/      # tuning.ts (debounce 등 매직넘버 격리)
└─ test/        # __TEST__ 이벤트 버스, DI fixture
```

## Performance Budget

| 지표 | 목표 |
|------|------|
| 첫 렌더 (p50) | < 150ms |
| 스크럽 FPS | 58~60 (55 미만 1프레임도 불가) |
| iOS 메모리 증가 | < 15MB |

`perf-budget.json`에 커밋되고 CI에서 회귀 자동 감지.

## Install & Run

_TBD — Xcode 프로젝트 구성 및 Safari 확장 활성화 가이드 추후 채움._

## Contributing

팀은 Architect (리더) + 4 Teammate (Coder / Debugger / Test·Reviewer / Performance·Doc) 역할로 운영한다. 작업은 [`Tasklist.md`](Tasklist.md)로 추적하고, 설계·변경 이력은 [`process.md`](process.md)에 기록한다. 과학적 토론과 교차 레이어 조정 원칙은 [`design.md`](design.md) 참조.

## Roadmap

- **MVP**: Skeleton Render + Canvas/DOM Hybrid + Shadow DOM 격리 + Pull Handle
- **차별화**: Pin Drop, Progress Trail, Magnifier, Search Glow, Micro Haptics
- **Pro**: Smart Tag Filter, Theme Store, Layout Customization

## License

MIT
