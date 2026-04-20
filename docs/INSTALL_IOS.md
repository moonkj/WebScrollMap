# iPhone 설치 가이드

실기기 iPhone에 WebScrollMap을 설치하는 절차. **Apple ID + Mac + Lightning/USB-C 케이블**만 있으면 무료로 가능 (7일 유효, 유료 Developer 계정 시 1년).

## 사전 준비 (최초 1회)

1. Mac에서 Xcode 실행 (이미 설치됨: `/Applications/Xcode.app`)
2. iPhone을 Mac에 USB 연결
3. iPhone: **설정 → 개인정보 및 보안 → 개발자 모드 ON** (재부팅 필요)
4. Mac Xcode: **Settings → Accounts** 에서 Apple ID 로그인

## 설치 절차

### 1) Xcode 프로젝트 열기
```bash
open /Users/kjmoon/WebScrollMap/native/WebScrollMap/WebScrollMap.xcodeproj
```

### 2) Signing 설정 (중요)
Xcode 좌측 프로젝트 네비게이터에서 **WebScrollMap**(루트) 선택 →
- **Signing & Capabilities** 탭
- **Team**: 본인 Apple ID 선택 (Free 계정 OK)
- **Bundle Identifier**: `com.moonkj.WebScrollMap` → **유일해야 하므로 필요 시 `com.<본인ID>.WebScrollMap`으로 변경**
- **WebScrollMap Extension** 타겟도 동일하게 Team + Bundle ID 설정 (예: `com.<본인ID>.WebScrollMap.Extension`)

### 3) 실행 타겟을 iPhone으로 전환
상단 디바이스 선택기에서 연결된 **"<본인 iPhone 이름>"** 선택 (simulator 대신).

### 4) 빌드 & 설치
⌘R (Run) — Xcode가 자동으로 빌드 → 서명 → iPhone에 설치.

> 첫 실행 시 "Untrusted Developer" 오류가 뜨면:
> iPhone: **설정 → 일반 → VPN 및 기기 관리 → (본인 Apple ID) → 신뢰** 탭.

### 5) Safari 확장 활성화
iPhone에서:
1. **설정 → 앱 → Safari → 확장 프로그램** (iOS 17+) 또는 **설정 → Safari → 확장 프로그램** (iOS 16 이하)
2. **WebScrollMap** 토글 ON
3. **웹사이트 허용**: "모든 웹사이트" → **허용**
4. Safari 앱으로 가서 긴 웹페이지 방문 — 우측에 미니맵이 보이면 성공.

## 단축키 (iPad 외장 키보드 / macOS Safari)

- **Cmd+Shift+F**: 커스텀 검색 패널
- **Alt+Shift+M**: 수동 스크롤 컨테이너 피커 (Gmail/Slack 등)

## 모바일 제스처 (iPhone Safari)

- 미니맵 **탭**: 해당 위치로 점프
- 미니맵 **드래그**: 스크러빙 (손가락 근처 프리뷰)
- 미니맵 **롱프레스 (0.5s)**: 현재 지점에 Pin Drop (최대 3)
- 우측 엣지 2px는 Safari 뒤로가기 제스처에 양보 (Pull Handle)

## 문제 해결

### 미니맵이 안 보여요
- 페이지가 viewport 1.5배 이상 스크롤 가능해야 활성화
- 설정 → Safari → 확장 프로그램에서 해당 사이트 권한이 "허용"인지 확인
- RTL (아랍어)·세로쓰기 일본어 페이지는 자동 비활성

### Gmail/Slack 등에서 안 먹혀요
창 내부 스크롤 컨테이너 감지 실패. **Alt+Shift+M** (외장 키보드) 또는 popup에서 다시 활성화.

### 7일 후 앱이 열리지 않아요
Free 계정 서명은 7일 만료. Xcode에서 ⌘R 재빌드 or 유료 Developer 계정($99/년)으로 전환 시 1년 유지.

## TestFlight 배포 (유료 계정 필요)

Safari Web Extension은 TestFlight를 통한 **확장 테스트 미지원** (일반 앱만 지원). 대안:
- 유료 계정에서 Developer ID로 직접 `.app` 배포 (macOS만)
- App Store 정식 제출 (심사 필요)

## 다음 단계 (개발자용)

- `extension/manifest.json`, `src/` 수정 → `npm run build` → Xcode ⌘R
- 아이콘 교체: `scripts/gen-icons.py` 편집 후 재실행
- 개인정보 라벨: `extension/PrivacyInfo.xcprivacy` 업데이트
