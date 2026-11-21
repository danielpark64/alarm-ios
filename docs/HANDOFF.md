# 교대알람(AlarmApp) 인수인계 — 2026-11-21

새 대화에서 이 파일을 먼저 읽고 이어서 작업한다. 프로젝트 규칙은 `CLAUDE.md`, 버그 이력은 `.claude/bugs.md`, 여러 앱 현황은 `~/Desktop/daniel-project/본부/현황판.md`.
**사용자에게 보이는 모든 글은 한국어로 쓴다**(전역 규칙).

## 지금 상태 한 줄
**두 스토어 모두 심사·검토 중(2026-11-21 제출).** 결과가 나오기 전에는 어느 쪽도 다시 제출하지 않는다. 코드는 main에 커밋·푸시됨.

## 스토어 상태 (2026-11-21)
- **iOS 1.5.3(빌드 7)**: App Store 심사 대기(WAITING_FOR_REVIEW), 통과하면 자동 출시. 내용 = 새 스크린샷 8장(15개 로캘, 아이폰 6.3·아이패드 13) + 위젯 날짜 두 줄 꺾임 수정. 확인: `node ~/.appstoreconnect/asc-submit.mjs com.danielpark.alarmapp 1.5.3`(확인만, `--go` 금지).
  - 판매 중인 판은 1.5.2(위젯 추가).
- **Play 스토어 등록정보**: 9개 언어(ko-KR en-US ja-JP zh-CN zh-TW es-ES fr-FR de-DE pt-BR) 휴대전화 스크린샷을 새 8장으로 바꿔 **검토로 전송함**. 통과하면 자동 반영(관리형 게시 꺼짐). 확인: Play Console → 교대알람 → 게시 개요.
  - **AI 애셋 선언은 "애셋 라벨 지정 안함"** — 사용자가 직접 고른 값("AI 라벨은 항상 사용하지 않은 것으로"). 다음에도 사용자에게 확인하고 같은 값으로.
  - 그래픽 이미지(1024×500)·짧은 설명("확실하게 울리는 알람")은 안 바꿈.
- **Android 1.5.2(vc11)**: AAB `~/Desktop/교대알람-1.5.2-vc11.aab` 준비됨, **아직 안 올림**. 세이람이 Play에 공개된 뒤 사용자가 올린다. 위젯 수정은 iOS만이라 Android는 그대로.

## 스토어 스크린샷 (새 방식, 모든 앱 공통)
- 방법: `~/.claude/store-screenshots.md`(본부 `규칙/스토어-이미지.md`). 종이 콜라주 + 큰 문구, 1·2번 장은 폰이 이음매에 걸쳐 이어짐.
- 8장 순서: 01-hero, 02-calendar, 03-reliable, 04-widget, 05-rotation, 06-override, 07-cycle, 08-everyday.
- 다시 뽑기: `tools/store-pano-all.sh` → `tools/store-final8.sh`. 문구는 `tools/store-pano-copy.json`·`store-shot-copy.json`(9개 언어).
- 결과물: `store-assets/store-shots/final8/{play,iphone63,ipad13}/<언어>/`(Play 업로드용 JPEG는 `final8/play-jpg/`). 위젯 원본 캡처는 `store-assets/screenshots/widget-2026-11-21/`. **둘 다 용량 때문에 git에 없음(.gitignore), 맥에만 있다.**
- 시안 페이지: https://claude.ai/artifact/7ucdhp5bhr6QYsKriA1AhQ
- Play Console 올리는 법: 크롬 u/2 → 스토어 등록정보 → 기본 등록정보 수정 → 언어별로 예전 장 삭제 → 애셋 추가에 8장 업로드(순서가 섞이니 삭제 후 애셋 목록에서 1→8 순서로 다시 추가) → 다음 → AI 선언 → 저장 → 게시 개요에서 검토 전송.

## 남은 일 / 사용자 결정 대기
1. **심사 결과 확인**(애플·구글 메일). 거절이면 사유를 보고 고친다.
2. 사용자가 TestFlight 빌드 7로 **실제 폰에서 위젯 확인**(수정은 시뮬레이터 캡처로만 확인함).
3. 다른 언어 아이폰 스크린샷 4번 장에 작은 한국어("교대알람" 위젯 이름표, 아이패드는 상태바 날짜)가 남아 있음 — 지적되면 시뮬레이터 시스템 언어를 바꿔 다시 찍는다.
4. Android 중간 위젯: 프랑스어·일본어에서 글이 두 줄로 접힘(미수정).
5. Play 짧은 설명의 단정 문구("확실하게 울리는") 손볼지, 그래픽 이미지를 새 가로 그림(`tools/store-banner.py`)으로 바꿀지.
6. 다음 판 **1.6.0 "근무표 공유"**: 기획 단계, 준비 문서 `본부/가족공유-준비.md`. 지금 심사가 끝난 뒤 시작.
7. 나중 후보: AlarmKit(iOS 26+) 알람, 위젯에 세이람 일정.
8. 2027-10-01까지 공휴일 표에 2029년분 추가(예약 작업 있음). 8+(iOS 16.7)는 Xcode 16.4가 있어야 설치 가능(보류).

## 시뮬레이터에 남겨 둔 것
- iPhone 17 Pro(90DC76C2…)·iPad Pro 13(M5)(3FABDE8C…): 교대알람 설치, 데모 근무표, 3페이지에 위젯, 상태바 9:41 고정. 스크린샷 다시 찍을 때 재사용. 세이람 위젯 페이지는 건드리지 말 것.

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
# 정적 검사(71개) — 알람 파일 수정 시 필수
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
- 작업이 끝나면 **커밋·푸시 여부를 사용자에게 묻는다.** "마무리"라고 하면 커밋 → 현황판·이 파일 갱신 → 짧은 보고 → 대화 비우기까지 한 번에(`~/.claude/CLAUDE.md` 본부 절).
- 배터리를 더 쓰는 방식(iOS 백그라운드 오디오 등)은 하지 않는다.
- 자격증명 입력·결제·법적 선언은 사용자가 직접. Play Console 스토어 등록정보(스크린샷)는 사용자가 시키면 크롬(u/2 프로필, Susu Development)으로 Claude가 올린다. AAB 업로드는 사용자가 직접.
- 계획은 Fable, 실행은 Opus 에이전트(`model: "opus"`), 결과 점검은 Fable이 직접.
