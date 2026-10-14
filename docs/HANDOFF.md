# 교대알람(AlarmApp) 인수인계 — 2026-10-14

새 대화에서 이 파일을 먼저 읽고 이어서 작업한다. 프로젝트 규칙은 `CLAUDE.md`, 버그 이력은 `.claude/bugs.md`.
**사용자에게 보이는 모든 글은 한국어로 쓴다**(전역 규칙, 사용자가 강하게 요청).

## 지금 상태 한 줄
v1.5.0(versionCode 10) 출시 준비가 끝났고 main에 병합·푸시됨(`b842d42`). **Play Console 업로드는 사용자가 직접 할 차례.**

## 이번에 끝낸 것 (main에 있음)
- 다국어 9개(ko en ja zh-Hans zh-Hant es fr de pt), 한국 전용 기능(공휴일·음력·절기·반반차)은 한국어에서만.
- 해외 교대제도: 자정 넘는 야간 근무(퇴근은 근무일 다음 날), 주간·야간 근무조, 근무표 프리셋, 대체휴무·대기근무, 주 시작 요일.
- **앱 이름**: 한국어 기기 "교대알람", 그 외 전부 **"RotaWake"**. 한국 스토어 제목은 "교대알람(RotaWake)".
  - 처음 정한 "ShiftWake"는 같은 이름의 교대근무 알람 앱이 App Store 2개·Play 1개 있어서 바꿈.
  - RotaWake는 App Store 12개국·Play·웹·상표 검색에서 없음, rotawake.com 비어 있음(공식 상표 DB 직접 조회는 안 함).
- 버그 수정: 주 시작/언어를 바꾸면 달력 칸이 통째로 비던 문제(날짜 칸 key), iOS 로테이션 보조 알림 제목에 근무조 누락.
- 위젯 선택 화면의 위젯 이름 현지화, 독일어 수정 화면 제목 단축.

## Play 업로드 자료 (사용자가 직접 올림)
- AAB: `~/Desktop/교대알람-1.5.0-vc10.aab` (서명은 기존 출시본과 동일 확인)
- 순서 안내: `docs/release-1.5.0-guide.md`
- 등록 문구: `store-assets/listings/<언어>.md` (제목·짧은 설명·전체 설명·새 기능, 글자 수 검증 완료)
- 출시 노트(전 언어 한 번에): `store-assets/release-notes-1.5.0.md`
- 스크린샷 54장(1350×2400): `store-assets/screenshots/i18n-2026-10-14/<언어>/`, 같은 것이 `~/Desktop/스크린샷/스토어-다국어-2026-10-14/`
- 대표 이미지: `store-assets/feature-graphics/<언어>.png` (`python3 scripts/make-feature-graphic.py "RotaWake"`로 재생성)
- 개인정보처리방침: `docs/privacy.html`에 영어판 추가(같은 주소 `#en`)
- 해외 노출하려면 Play Console에서 **배포 국가 추가** 필요(안내서 6번).
- versionCode 10은 업로드하는 순간 소모 — 이후 코드를 고치면 11로 빌드. 심사 중 재제출 금지.

## 남은 일 / 사용자 결정 대기
1. 사용자가 Play에 1.5.0 업로드 → 막히면 스크린샷 보고 안내.
2. iOS App Store 출시는 아직 계획 없음. 하려면 유료 개발자 계정, iOS 버전 번호(현재 Info.plist 1.1.0) 정리 필요.
3. **8+(iPhone 8 Plus, iOS 16.7)**: Xcode 27이 iOS 16 미지원 → 사용자가 Xcode 16.4를 받아 "받았어"라고 하면 설치 진행(보류 중).
4. 번역은 원어민 검수 전. 리뷰에서 어색한 표현이 나오면 `src/i18n/locales/<언어>.ts`와 `store-assets/listings/` 함께 수정.
5. 2027-10-01까지 공휴일 표에 2029년분 추가(예약 작업 `alarmapp-holiday-2029-reminder` 있음).
6. 개발 빌드 만료: 폰·미니 **2026-10-20 21:37** → 10/19 09:00 리마인더("교대알람 iOS 재설치") 있음. 맥에 연결해 재설치.

## 기기
| 이름 | 식별자 | 비고 |
|---|---|---|
| 32 (Galaxy A32, Android 13) | adb `RF9R3049REV` | 주 테스트·스크린샷 기기, 알람 0개 |
| 노트 (Note10+, Android 12) | adb `R3CM909QRGK` | 알람 0개 |
| 폰 (iPhone 17 Pro Max) | `00008150-000C61A11AE9401C` | 사용자 실사용 기기 — 데이터 건드리지 말 것 |
| 미니 (iPad mini 6) | `00008110-00061C9C02FB801E` | 사용자 알람 105/106 있음 → `clearAll` 금지, `clearTestAlarms`만 |
| 8+ | `eb9c87802243c86d7f63cb0b04cd15784f60d8cc` | iOS 16.7, 위 3번 참고 |

- **테스트 알람은 모든 기기에서 진동만**(사용자 지시).
- iOS 화면 캡처가 안 돼서 `report=1` 딥링크로 상태를 AsyncStorage에 저장 후 devicectl로 꺼내 읽는다.

## 자주 쓰는 명령
```bash
# 정적 검사(62개) — 알람 파일 수정 시 필수
./scripts/test-alarm-suite.sh --static
# Android 빌드(lintVital은 환경 문제로 제외)
cd android && ./gradlew bundleRelease assembleRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease
# iOS 빌드(미니 대상, 같은 app.app을 폰에도 설치 가능)
xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Release -destination 'id=00008110-00061C9C02FB801E' -allowProvisioningUpdates DEVELOPMENT_TEAM=T5Z6ACK2PU CODE_SIGN_STYLE=Automatic build
xcrun devicectl device install app --device <UDID> ~/Library/Developer/Xcode/DerivedData/app-amzralgzijzqardetzrduialcpmj/Build/Products/Release-iphoneos/app.app
# 개발 딥링크(잠금 키 필요, 같은 URL은 1회만 처리되므로 n=<임의 숫자> 추가)
adb -s RF9R3049REV shell am start -a android.intent.action.VIEW -d "alarmapp://?k=1ef80163d089870d\&lang=en\&tab=calendar\&n=1" com.danielpark.alarmapp
```
딥링크 종류: `testAlarm=<분>`, `testPattern=night`, `demo=1`/`demo=2`(스크린샷용), `clearAll=1`, `clearTestAlarms=1`, `report=1`, `lang=<코드|system>`, `tab=calendar|alarms|settings|add`.

## 일하는 방식 (사용자 요청)
- TDD: 정적 체크·로직 테스트 먼저 → FAIL 확인 → 수정 → PASS.
- 변경마다 에이전트로 검증: verify-fix(커밋 전), alarm-logic(알람 로직), bug-tracker(이력), android-build / ios-build.
- Android 알람은 Expo 알림 + 네이티브 AlarmManager **둘 다** 예약·취소.
- 작업이 끝나면 **커밋·푸시 여부를 사용자에게 묻는다.** 기능은 브랜치에서, 사용자가 말하면 main에 병합·푸시.
- 배터리를 더 쓰는 방식(iOS 백그라운드 오디오 등)은 하지 않는다.
- Apple ID 등 자격증명 입력, Play Console 업로드·결제는 사용자가 직접.
