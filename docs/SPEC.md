# WebScrollMap — Technical Specification (목차)

> 실구현 사이클에서 각 섹션을 채운다. v2 설계 기준.

1. Overview & Goals
2. Target Platforms (iOS Safari / macOS Safari)
3. Skeleton Extraction Rules (`h1~h3`, `img`, `video`, `strong`, `a`)
4. Rendering Pipeline — Canvas + DOM Hybrid (히스테리시스 600/550, 쿨다운 1s)
5. Shadow DOM Isolation Model (`all: initial`, closed)
6. Interaction Spec (Pull Handle, Tap, Scrub, Long-press, Anchor Snap ±12px)
7. Feature Specs
   - 7.1 Pin Drop (sessionStorage, max 3)
   - 7.2 Progress Trail (1px line, pathname 키)
   - 7.3 Magnifier Preview (±15%, h1 40자)
   - 7.4 Search Glow (Cmd+F, 시안 1.5Hz × 3)
   - 7.5 Micro Haptics (iOS 20ms, reduce-motion 존중)
8. Performance Budget & Measurement (`perf-budget.json`, Playwright+performance.mark)
9. Accessibility (WCAG, ARIA `role="scrollbar"`, prefers-reduced-motion, 색각)
10. Settings, Persistence & Sync (`sessionStorage` tab-local, 프리셋)
11. Failure Modes (CSP, Reader Mode, SPA, iframe, 가상 스크롤, RTL/vertical)
12. PlatformCapabilities Adapter (iOS vs macOS 단일 관문)
13. Versioning & Release Criteria
