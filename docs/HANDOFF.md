# 교대알람(AlarmApp) 인수인계 — 2026-11-25(1.6.3 vc16 준비)

새 대화에서 이 파일을 먼저 읽고 이어서 작업한다. 프로젝트 규칙은 `CLAUDE.md`, 버그 이력은 `.claude/bugs.md`, 여러 앱 현황은 `~/Desktop/daniel-project/본부/현황판.md`.
**사용자에게 보이는 모든 글은 한국어로 쓴다**(전역 규칙).

## 지금 상태 한 줄
**1.6.3 사용자 승인됨 — 각 스토어 1.6.2 통과 즉시 올림(되묻지 않음).** 1.6.3(vc16·iOS 빌드 16) 준비 끝(11-25): `feature/ring-card`를 main에 병합(7ad90af), AAB `~/Desktop/교대알람-1.6.3-vc16.aab`(vc15 AAB는 1.6.2 심사 끝날 때까지 둠), TestFlight 16 VALID, 출시 노트 `store-assets/listings/release-1.6.3.json`(iOS는 "안정성 개선" 한 줄 — 울림 카드·스누즈는 Android 전용), 체크리스트·대조표 `docs/출시-체크리스트-1.6.3.md`. 노트에서 울림 카드(한국어·영어, 야간 퇴근=근무일)·끄기·5분 후 재울림·스누즈 뒤 근무 변경/시간 변경이면 안 울림·앱 다시 열기 유지·맨 앞(화면 꺼짐·영상 위·뒤로·홈·본문 누름·종료 뒤)·울림 중 새 버전 안내 안 뜸·허용 안내 확인, 캡처 `~/Desktop/스크린샷/163-노트-*`·`163-32-*`. 올릴 때: Play는 `~/.playconsole/play-upload.mjs`로 vc16 + 노트, iOS는 버전 1.6.3 만들고 빌드 16 연결 + iOS 글. 남은 것: 스토어 스크린샷 9개 언어 재촬영(시안 승낙 필요), 보안 잠금 위 실기기(두 기기 보안 잠금 없음), 플립 커버, iOS 실기기(TestFlight 16).
**1.6.2(vc15·iOS 빌드 15) — 11-25 두 스토어 제출: Play production 검토 중(vc15), App Store WAITING_FOR_REVIEW — 재제출 금지.** 사용자 "올려" 직접(11-25). 체크리스트 `docs/출시-체크리스트-1.6.2.md`, 출시 노트 `store-assets/listings/release-1.6.2.json`. 다음: 공개 뒤 Play판 1.6.1 폰에서 새 버전 안내 확인, 폰 TestFlight 15 확인. 1.6.3은 위 줄.
**1.6.3 울림 카드 — main 병합됨(7ad90af, 11-25).** 시안 `docs/시안/울림화면-카드-시안.html` "바꿀 모양" — JS `AlarmRinging.tsx`·커버 `CoverAlarmActivity.kt` 같은 카드(밤하늘·근무 이름·근무일 날짜·보라 원 끄기·"5분 후 다시"), 시간·이모지 없음. 스누즈는 네이티브 ACTION_SNOOZE 한 길(지금 울림의 소리·진동 설정 유지, baseAlarmId 게이트, rescheduleAll이 스누즈를 더는 안 지움, JS `alarmSnoozed`로 Expo 보조 취소). 근무일은 예약→원장(`wdate`)→울림으로 전달. 32·노트 확인, 플립 커버는 기기 없어 못 봄. 캡처 `~/Desktop/스크린샷/울림카드-*`.
vc15 추가: 새 버전 안내(6e08162, ⚠️ iOS 빌드 14엔 AppUpdate pod가 빠져 있었음 → pod install, testflight.sh에 가드) · 울리자마자 끄면 지연 맨앞 호출 취소(`AlarmService.cancelPendingRingLaunch`) · 최근 앱 낡은 울림 인텐트면 잠금 위 플래그 바로 해제(`MainActivity.isStaleRingingIntent`) · 저장 직후 허용 안내(알림 권한→다른 앱 위 표시→전체 화면 알림, `useAlarmScreenAsk.askAfterSave`) · 설정에 배터리 최적화 줄(창으로는 절대 안 띄움). 스위트 32·노트 107/0.
1.6.2 = ① 울리는 중 Expo 알림 본문 누름 → Android는 끄지 않고 울림 화면(판정 `src/utils/alarmResponse.ts` responseAction, iOS는 그대로 끔) ② 끈 뒤 잠금 위 표시 해제(`MainActivity.onRingingEnded` ← AlarmService 끄기·스누즈·onDestroy, 커버 화면도 닫음) ③ 끈 알람의 표시된 알림 지우기(`dismissPresentedAlarm`) ④ 표시 권한 안내 "교대알람"/RotaWake ⑤ 울림 화면·상시 알림에 앱 이름(세이람 1.2.3 모양, AlarmKit 제목엔 안 붙임 — 시스템이 앱 이름 표시). 근무표 알람 울림 제목은 이미 근무일 기준 근무 이름("초번 출근", 자정 넘는 "야간 퇴근") — 32·노트 확인. 개발 딥링크 `testShift=<분>[&night=1]` 추가.
남은 것: iOS 실기기 확인(TestFlight 15), 스토어 스크린샷 9개 언어 재촬영(공유 줄·오늘 버튼 변경분, 시안 승낙 필요), 32 잠금 위 확인(32는 화면 잠금 없음), 검사반 에이전트 미실행, 안드로이드 카톡 공유는 노트 카톡 미로그인이라 대화방 선택 전까지만(링크는 공유 글에 들어감 확인).

(이전) **1.6.1 — Play vc13 공개(11-24 확인), iOS 빌드 12 심사 대기 — 재제출 금지.** (업로드는 서비스 계정 키 `~/.playconsole/play-upload.mjs`) 1.6.1 = 근무표 링크 바로 열기(유니버설 링크/App Links)·보낸 사람 이름, 새 형식 [업데이트] 안내, 알람 화면 맨 앞(Android)·시간 민감 알림(iOS), 달력 '오늘' 버튼 항상, 공유 탭 이름 줄바꿈. 출시 노트 `store-assets/listings/release-1.6.1.json`. App ID에 Associated Domains를 ASC API로 켬. 1.6.0은 두 스토어 공개 중.

**1.6.2에 고칠 것 — 알람 맨 앞 실기기 점검(11-25, 1.6.1 vc13, 32·노트, 스크린샷 `~/Desktop/스크린샷/맨앞161-*`):**
1. 울리는 중 Expo 알림 본문을 누르면 울림 화면 대신 알람이 꺼짐 — `src/hooks/useAlarmNotifications.ts` 응답 리스너가 액션/본문 탭을 구분 안 함. `DEFAULT_ACTION_IDENTIFIER`는 끄지 말고 울림 화면 열기(워치·잠금 '알람 끄기'는 그대로).
2. 끈 뒤에도 MainActivity가 보안 잠금 위에 남음(잠금 해제 없이 앱 사용 가능) — `MainActivity.kt` `applyRingingWindowFlags`의 showWhenLocked를 끈 시점에 해제.
3. 지난 알림이 알림 줄에 쌓임 / 표시 권한 안내 문구 '"알람"을 찾아주세요' → '교대알람'.
통과: 잠금 위·뒤로·홈·다른 앱·전체 화면 영상 위·완전 종료 뒤·재부팅 직후·아이콘 누름·권한 끔 안내. 한계: 표시 권한 끔+화면 켜짐이면 알림 줄만(안내로 대응), iOS 진동만 알람·iOS 26 미만은 시간 민감 알림. 확인 못 함: 32의 2·4·6(PIN 잠금), Android 14+ 전체 화면 알림 안내, 안드로이드 카톡 공유.
32에 꺼진 '테스트 알람' 3개 남음(예약 0건) — 잠금 풀면 `clearTestAlarms=1` 딥링크로 지우기.
11-25 아이폰 카톡 글 공유 실패는 카카오톡 쪽 문제였고 저절로 풀림(메모 앱도 같이 실패) — 코드 수정 없음.

### iOS 1.6.0 제출 내용 (2026-11-23)
- 15개 로캘: 새 기능 = `store-assets/listings/release-1.6.0.md`의 App Store 글. 설명 = 1.5.3 설명 + "하루 근무 변경" 다음에 공유 단락 + 아이폰 안내 단락에 AlarmKit 한 줄(iOS 26 이상 무음·집중 모드에서도). fr·de는 4000자 때문에 무음 안내 문장을 AlarmKit 문장으로 바꾸고 위젯 단락을 줄임. 키워드는 기존 + 공유 낱말(공유/share/共有/共享/分享/compartir/partage/teilen/compartilhar).
- 스크린샷: `~/Desktop/스크린샷/store-1.6.0/{iphone63,ipad13}/<언어>/01~08`(만든 도구 `tools/store-160.py`·`store-160-copy.json`, 미리보기 `미리보기-<언어>.jpg`). APP_IPHONE_61·APP_IPAD_PRO_3GEN_129 각 8장, 240장 처리 완료.
- 나라: 175곳 중 174곳. 중국 본토는 Apple이 CANNOT_SELL(허가 필요)로 막음. 새 나라 자동 포함 켜짐.
- 심사 메모: 1.6.0 새 기능(AlarmKit·메시지 링크 공유(서버·로그인 없음)·소리 고르기) + 앱 기본 설명을 영어로 새로 씀(옛 2.1 답변 긴 글은 4000자 때문에 줄임).
- 시뮬(아이폰 17 Pro·아이패드 Pro 13)은 clearAll·공유 지움·한국어로 되돌림.

## 다음 판 1.6.0 = AlarmKit 알람 + 근무표 공유 (2026-11-22 사용자 지시, 총괄 창 전달)
- 사용자 원문: "교대알람 ios26 알람 잘되 새이람도 같이 적용해줘 이 내용하고 데이타 공유 도 다음 버전에 같이 적용해줘 지금 이미지 올린것 통과되면 바로 올리게 작업해줘 이 버전 까지 올리면 일단 걔획한건 다 올리는거야"
- **AlarmKit 알람은 사용자가 폰에서 잘 울린다고 확인(2026-11-22).** 1.5.4는 따로 내지 않고 1.6.0에 근무표 공유와 함께 넣는다. 전 세계 출시도 같은 판(`본부/가족공유-준비.md`).
- 근무표 공유 시안: `docs/시안/근무표공유-시안.html`(11-22, 승낙 기다림 — 화면 4장과 정할 것 6가지).
- 순서: 근무표 공유 시안 → 사용자 승낙 → 개발(Opus) → 점검 → TestFlight·내부 테스트까지 미리. 1.5.3·Play 스크린샷 결과 전에는 재제출 금지, 심사 제출은 사용자에게 한 번 확인.
- **세이람이 가져갈 AlarmKit 파일:** `modules/alarmapp-alarmkit/`(Swift 모듈·podspec·expo-module.config.json), `src/utils/alarmkitRoute.ts`(분기 한 곳), `src/utils/notifications/alarmkit.ts`(직렬 큐), core.ts의 `viaAK` 세 갈래, `targets/widget/AlarmLiveActivity.swift`(+`AlarmWidget.swift`·`expo-target.config.js` 등록), 권한 문구 `NSAlarmKitUsageDescription`(`app.json` + `locales/*.json` 9개), Swift가 부르는 소리 `alarm_long.wav`·`silent_short.wav`, 테스트 `scripts/logic-tests/alarmkit.test.js`·정적 체크. 전체 목록은 `git show --stat fcc8938`.
  - 주의: ① 진동만 알람은 AlarmKit에 못 넣음(기존 방식 유지) ② AlarmKit 알람엔 보조(rep) 알림을 걸지 않음 ③ 재예약 때 AlarmKit 전체 정리는 원장(UserDefaults UUID→id) 기준, 울리는 중인 켜진 알람만 보존 ④ AlarmKit은 약한 링크 — iOS 26 미만에서 죽지 않게 ⑤ 모듈 이름·App Group은 세이람 것으로 바꿀 것 ⑥ Android는 무관.
- 알람 소리 고르기(앱에 넣은 소리 여러 개 중 선택)는 사용자에게 제안만 함, 아직 미정.

## 진행 중 — 알람 소리 고르기 (1.6.0, 2026-11-23, 세이람도 같은 작업 진행 예정)
- **현재: 개발 완료(2026-11-23).** 시안 승낙 → 구현 → Android 32·노트 Release 설치(기기 테스트 88/88) → 폰 Release 설치 → TestFlight.
  - 표 한 곳: `src/constants/alarmTones.ts`(id·이름·iOS 파일 `assets/sounds/tone_*.caf`·Android `res/raw/snd_*.m4a`), 네이티브 `AlarmTones.kt`.
  - 전달: core.ts(`notifSound(soundOn, tone)`·data.tone) → `scheduleNative(…, tone, crescendo)` → AlarmModule → AlarmStore(`tone`/`cres`) →
    AlarmScheduling 인텐트 → AlarmReceiver(본·+1/+2분 rep) → AlarmService(`AlarmTones.rawRes`, 스누즈도 같은 소리). AlarmKit은 `sound` 필드.
  - UI: `src/components/AlarmForm/ToneSelector.tsx`(일반·근무표 폼 둘 다, 진동만이면 흐림), 미리듣기 `src/utils/tonePreview.ts`(미디어 음량 3초, Android AlarmModule.previewTone / iOS AlarmappAlarmKit.previewSound).
  - 점점 크게(Android): 켜면 2%에서 20초. 꺼져 있으면 예전 그대로(15%에서 15초 페이드).
  - 테스트: `scripts/logic-tests/alarm-tone.test.js`, 정적 체크 ⑦(하드코딩 금지·파일 존재·30초·전달 경로).
  - iOS `ios/`는 git 밖 — 이번엔 xcodeproj(ruby)로 caf 6개를 리소스에 직접 넣음. prebuild하면 app.json sounds로 다시 들어감.
  - 아직 실제 알람 소리(고른 소리로 울리는지)는 사람이 귀로 확인 못 함.
- 소리: freesound CC0 6개, 고음질 미리듣기 mp3를 `~/Desktop/알람소리/01~06_*.mp3`에 받아 둠
  (디지털비프 20초·종소리행진 31·옛날자명종 31·마림바 77·잔잔한피아노 34·오르골왈츠 59초). 30초 이하로 자를 것.
- 설계(시안): 알람 수정 화면에 "알람 소리" 한 줄 → 시트에서 기본+6개, 누르면 3초 미리듣기. 알람마다 저장, 기존 알람은 '기본'.
  점점 크게 토글도 뺌(11-23, Android 기본이 이미 15초 페이드인 — 네이티브 crescendo 경로는 항상 false로 남김). 폰 벨소리는 뺌(11-23 결정). 근무표 알람도 알람당 소리 하나(11-23 결정). 개발 중.
- 가져갈 때 주의:
  ① iOS 알림 소리는 앱 번들 안 파일만, 30초 이하·CAF(IMA4) 권장(~1MB 이하). AlarmKit은 `.named(파일명)`.
     iOS는 폰 벨소리·음량 조절 불가.
  ② Android 소리 파일은 `res/raw`(이름 소문자·영문), 실제 울림은 네이티브 AlarmService가 재생 → 알람에 소리 id를 넘겨
     AlarmManager 예약 데이터·`AlarmStore`(부팅 복구)에도 저장해야 함. Expo 알림 채널은 소리가 채널 단위라 소리별 채널 필요.
  ③ 진동만 모드는 기존 무음 파일(`silent_short.wav`) 경로 유지 — iOS 진동이 안 오는 사고 방지.
  ④ 재알림(rep 묶음)·스누즈·워치 끄기도 같은 소리로 울리는지 확인. 소리 이름 9개 언어 번역.
- 교대알람 현재 소리 파일: `assets/alarm_long.wav`(기본), `assets/silent_short.wav`, android `res/raw/` 같은 이름.

- **1.6.0 출시 뒤 고쳐 둔 것(다음 판에 포함, 기기 미확인 — 2026-11-24):** 공유 탭 이름 칸을 옆 스크롤 → 줄바꿈(`ShareBar.tsx`, 화면 끝 잘림 해결).
- 달력 '오늘' 버튼을 항상 보이게(세이람과 같게, 11-24, 32 확인). 달력 머리 줄이 바뀌어 다음 판 스토어 스크린샷 재촬영 대상.
  안내 페이지(`docs/s/index.html`, 이미 배포됨): Android는 intent:// 로 열기(32 크롬 확인), LINE 안 브라우저면 `openExternalBrowser=1`로 Safari/Chrome에서 다시 열기(미확인).

## 끝남 — iOS 26 AlarmKit 알람 (2026-11-21 구현·커밋 fcc8938, 11-22 폰에서 사용자 확인)
- **Fable 직접 점검(11-21):** 정적 76/0, logic-tests 248/0, i18n 누락 없음, tsc 새 오류 0(기존 Reactotron 1건). 코드: 분기는 `usesAlarmKit` 한 곳, 세 예약 지점 모두 AlarmKit이면 Expo 미예약, 요일 weekly는 이날끄기·근무변경·공휴일 없을 때만. 시뮬 스샷은 다이내믹 아일랜드뿐 — **전체 화면 울림·끄기 버튼은 실기기 미확인.**
- ⚠️ 사용자 폰(iOS 27)의 실제 소리 알람 110·111·112가 이미 AlarmKit으로 옮겨져 있음(27건). 첫 실제 울림 때 끄기 확인 필요.
- 남은 일: 폰 수동 확인(3환경·무음/집중·끈/삭제 알람 안 울림·이날끄기·권한 끄면 기존 방식·워치), 8은 프로파일에 UDID 없어 미설치(iOS 16 미확인). 다시 울림 버튼은 `SNOOZE_ENABLED=false`라 숨김. 1.5.3 심사 결과 뒤 1.5.4로 번호 올려 제출.
- 목표: iOS 26 이상은 AlarmKit으로 기본 시계 알람처럼 울림(무음·집중 모드 통과, 시스템 울림 화면). **자동 전환**(권한 허용 → AlarmKit, 거부·iOS 26 미만 → 기존 Expo 방식), 설정 항목 없음. Android 무변경.
- 분기 한 곳: `src/utils/alarmkitRoute.ts` `usesAlarmKit(alarm, 모드)` = iOS 26+ & 권한 허용 & **소리 알람(snd='default')**. 진동만 알람은 Expo(무음 파일 방식) 유지 — AlarmKit엔 "진동만" API가 없음.
- 구조: 네이티브 `modules/alarmapp-alarmkit`(UserDefaults 원장 UUID→알람 id, AlarmKit 약한 링크), JS `src/utils/notifications/alarmkit.ts`(직렬 큐). core.ts 세 예약 지점이 `viaAK`로 갈라지고 보조(rep) 알림은 AlarmKit 알람에 안 건다. 요일 반복은 AlarmKit weekly 한 건, 나머지는 기존 14일 루프 그대로 날짜별 예약(UUID = 알람 id+근무일 해시라 겹쳐도 덮어씀). rescheduleAll은 매번 모드 재판정 → AlarmKit 전체 정리(울리는 중인 켜진 알람만 보존) → 재예약.
- 위젯 확장에 `AlarmLiveActivity.swift`(카운트다운용, 울림 화면은 시스템이 그림). `[다시 울림]`은 `SNOOZE_ENABLED`(지금 false)를 따른다 — 켜면 5분 카운트다운 버튼이 생김.
- 개발 딥링크: `akTest=<분>`(무음 AlarmKit 테스트 알람, 앱을 앞으로 가져오면 재예약이 지움), `report=1`에 `alarmkit` 항목(권한·모드·예약 목록).
- **남은 일:** 폰(iOS 26+) 수동 확인 — 잠금/백그라운드/앱 화면 3환경, 무음 모드, 끈 알람이 안 울리는지, 잠금 화면 울림 화면에 끄기 버튼이 보이는지(시뮬은 Dynamic Island 형태만 확인). 8(iOS 16) 기존 방식 확인. 그 뒤 1.5.3 심사 결과 → 1.5.4로 번호 올려 제출.
- 버전 번호는 아직 1.5.3 그대로.

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
6. ~~1.6.0 "근무표 공유"~~ 끝남(Play 11-23 공개, iOS 심사 중). 다음 판(1.6.1)은 위 48~49줄의 작은 수정 묶음뿐 — 새 기능 계획 없음.
7. 나중 후보: 위젯에 세이람 일정.
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
딥링크 종류: `testAlarm=<분>`, `testPattern=night`, `demo=1`/`demo=2`(스크린샷용), `clearAll=1`, `clearTestAlarms=1`, `report=1`, `lang=<코드|system>`, `tab=calendar|alarms|share|settings|add`.

## 일하는 방식 (사용자 요청)
- TDD: 정적 체크·로직 테스트 먼저 → FAIL 확인 → 수정 → PASS.
- 변경마다 에이전트로 검증: verify-fix(커밋 전), alarm-logic(알람 로직), bug-tracker(이력), android-build / ios-build.
- Android 알람은 Expo 알림 + 네이티브 AlarmManager **둘 다** 예약·취소.
- 작업이 끝나면 **커밋·푸시 여부를 사용자에게 묻는다.** "마무리"라고 하면 커밋 → 푸시 → 현황판·이 파일 갱신 → 짧은 보고까지 한 번에(대화 비우기·리모트는 건드리지 않음)(`~/.claude/CLAUDE.md` 본부 절).
- 배터리를 더 쓰는 방식(iOS 백그라운드 오디오 등)은 하지 않는다.
- 자격증명 입력·결제·법적 선언은 사용자가 직접. Play Console 스토어 등록정보(스크린샷)는 사용자가 시키면 크롬(u/2 프로필, Susu Development)으로 Claude가 올린다. AAB 업로드는 사용자가 직접.
- 계획은 Fable, 실행은 Opus 에이전트(`model: "opus"`), 결과 점검은 Fable이 직접.
