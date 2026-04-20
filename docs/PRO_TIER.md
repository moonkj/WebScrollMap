# WebScrollMap — Free vs Pro Tier

## 가격: $0.99 (₩1,400) (one-time purchase, StoreKit 2)

## Free (무료)
- 좌측 바 + 앵커 마커 + viewport indicator
- `enabled` 토글 (ON/OFF)
- 짧은 페이지 자동 비활성화
- SPA 라우팅 대응
- 다크모드 자동

## Pro (결제 후)
- **레이아웃**: 좌/우 선택, 여백 0/8/16/24/32, 바 두께 3/6/12
- **Pin Drop** (최대 5개) + 플로팅 메모장 (드래그 이동, 투명도 40/70/100%)
- **Progress Trail** — 읽은 구간 누적 표시
- **매그니파이 프리뷰** + 현재 섹션 배지
- **커스텀 검색 패널** (Cmd+Shift+F, 바 더블탭) + 발광 마커
- **수동 스크롤 컨테이너 피커** (Alt+Shift+M)
- **Smart Tag Filter** (전체/제목만/미디어만)
- **Theme Store** (Default, Sunset, Ocean, Forest, Mono)
- **CoreHaptics** (pin drop / anchor snap / edge)
- **Opt-in Telemetry 원격 전송**

## 아키텍처
```
Extension JS                  Native Host (Swift)
─────────────                 ──────────────────
isProTier check              ↔ StoreKit 2 Transaction
  └─ entitlement cache        Product.purchase()
     (browser.storage.local)   AppStore.sync()
                              CoreHaptics
                              UserDefaults deviceId
```

## 보안 (Permissive — 팀 Debugger 권고)
- djb2 기반 HMAC-like 서명 + 디바이스 ID binding
- 14일 grace period (오프라인)
- 서버 검증 없음 (1인 운영, $0.99 (₩1,400) ROI)
- 정직한 사용자 95% 커버 목표. 크래커는 포기.

## 구매 흐름
1. 사용자가 popup의 **"Upgrade"** 클릭 → `purchase-pro` 메시지
2. Background → native `sendNativeMessage` → `EntitlementManager.purchase()`
3. StoreKit 2 product.purchase() → Apple Sheet 표시
4. Verified transaction → `buildProEntitlement()` with signature → 반환
5. Background가 모든 탭에 `entitlement-changed` 브로드캐스트
6. Content script가 tier='pro'로 업데이트, 모든 Pro 기능 즉시 해금

## 복원 흐름
1. 사용자가 popup의 **"구매 복원"** 클릭
2. `AppStore.sync()` + `Transaction.currentEntitlements`
3. 이전에 구매했으면 Pro entitlement 재발급

## 환불 처리
- `Transaction.updates` 리스닝 (향후 사이클)
- 현재는 grace period 만료 시 자동 free로 전환

## App Store 제출 체크리스트
- [ ] StoreKit config (.storekit) — 로컬 테스트
- [ ] App Store Connect에 `com.kjmoon.WebScrollMap.Pro` 제품 등록 ($0.99 (₩1,400))
- [ ] Privacy Manifest: In-App Purchase 항목 선언
- [ ] Popup에 가격 명시 (현재: "$0.99 (₩1,400)")
- [ ] 복원 버튼 가시성 (popup 하단)
- [ ] 한국 앱스토어 약관 링크 (popup 또는 Settings 앱)
- [ ] 영수증 검증 실패 시 Graceful degradation
- [ ] 외부 결제 유도 금지 (Apple 가이드라인 3.1)
- [ ] 기능 차이 명세 (이 문서)
- [ ] 환불 후 기능 제거 경로 (grace 이후 verify 실패 시 tier='free' 강등)

## 테스트 시나리오
| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | Free 신규 설치 | 좌측 바만, Pro 기능 🔒 |
| 2 | Free에서 Pro 기능 터치 | 토스트 "Pro 전용 · $0.99 (₩1,400)" |
| 3 | Upgrade → StoreKit 시트 → 구매 | 즉시 모든 탭 Pro 해금 |
| 4 | 환불 → 14일 경과 | free로 자동 강등 |
| 5 | Restore Purchases | 기존 구매 복원 |
| 6 | 오프라인 상태에서 Pro 사용 | grace 14일 내 정상 동작 |
| 7 | 다른 기기 토큰 복사 | signature 검증 실패 → free |

## 개발자 로컬 테스트
`.storekit` 구성 파일로 StoreKit Testing:
1. Xcode 프로젝트에 `Products.storekit` 생성
2. Scheme → Options → StoreKit Configuration 지정
3. 빌드 시 실제 App Store 호출 대신 로컬 시뮬레이션
