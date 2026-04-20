# WebScrollMap — Usage Guide (목차)

1. 설치하기 (iOS / macOS Safari에서 확장 활성화)
2. 첫 사용 — Pull Handle로 미니맵 열기
3. 스크럽과 탭으로 페이지 탐색
4. Pin Drop으로 중요한 위치 저장
5. Progress Trail로 읽은 구간 확인
6. 검색 발광과 매그니파이 프리뷰
7. 설정·프리셋과 문제 해결 FAQ

## 개발자 주의사항

- **Shadow DOM 스타일 누수 방지**: shadow host 내부 루트에 `all: initial` 리셋을 강제하고, 외부 CSS 변수/inherit 경로를 차단. `font`, `color`, `line-height` 명시 선언.
- **SPA 라우팅 재마운트 규칙**: `history.pushState`·`popstate`·`hashchange` 감지 시 skeleton을 재추출하고 shadow host를 **파괴 후 재마운트**. diff 패치 금지 (stale node 참조 위험).
- **CSP 차단 사이트**: strict CSP 환경에서는 기능 축소 모드(Canvas만, DOM 오버레이 OFF) 폴백. 지원 범위: "확장이 주입 가능한 DOM이 존재하는 일반 페이지".
- **iOS Reader 모드 비작동은 정상**: Reader는 별도 렌더 컨텍스트 → content script 미주입. 설정 화면에 "Reader에서는 비활성" 안내.
