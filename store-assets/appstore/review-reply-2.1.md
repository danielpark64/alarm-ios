# App Review 답장 — Guideline 2.1 Information Needed (2026-10-23)

App Store Connect → 앱 심사 메시지 → "앱 심사에 회신"에 아래 영어 본문을 붙이고 화면 녹화 파일을 첨부한다.
같은 본문을 버전 화면 "앱 심사 정보 → 메모"에도 넣는다(Apple 요청). 메모 칸은 4000자.

## 회신 본문 (영어)

```
Hello App Review team,

Thank you for reviewing RotaWake. Here is the information you requested. A screen recording made on a physical iPhone running the latest iOS is attached.

1. Screen recording
The recording starts from launching the app from the Home Screen and shows the typical flow: the calendar with work days and days off filled in from the alarms, building a rotating shift pattern (shift blocks and days off), adding a regular alarm, the scheduled alarm notification arriving on time, and opening a single day on the calendar to change only that day (leave, extra shift, etc.).

2. Purpose and target audience
RotaWake is an alarm app for shift workers (nurses, factory and security staff, firefighters, etc.) whose work schedule rotates in a repeating pattern such as early/late/night shifts and days off. Regular weekly alarms cannot follow such a schedule, so these users usually re-set alarms by hand every few days and sometimes forget to clock in or out. RotaWake lets them enter the rotation once; the app then schedules the right clock-in and clock-out alarms for each day and shows the schedule on a calendar. It is free, has no ads, no account and no login.

3. How to use the main features
- Launch the app and allow notifications when asked.
- Tap "+" (top right) to add an alarm. Choose a weekly alarm, or pick a shift in the "Shift" card to build a rotating pattern (add work blocks and days off, then "Repeat from here").
- Settings → "Shift pattern walkthrough" guides you through building a rotating pattern step by step.
- The Calendar tab colors work days and marks days off automatically from the alarms. Tap a date to change only that day (leave, extra shift, etc.).
- When an alarm notification arrives, tap it or use the "Dismiss" action.
No login credentials or sample files are needed.

4. External services
- Korean public holidays: when the app language is Korean, the app downloads the list of public holiday dates from the Korean government open data API (apis.data.go.kr, data.go.kr). No personal data is sent.
- SayRam (our other app): an optional setting shares the shift schedule between our two apps on the same device through an App Group container. Nothing is sent over the network.
- A banner shown only in the Korean interface links to our YouTube channels (youtube.com) and opens them in the browser or YouTube app.
The app uses no authentication service, no payment processor, no analytics, no ads and no AI service. There are no in-app purchases and no paid content.

5. Regional differences
The app works the same in all regions. The only differences depend on the app language, not the region: when the language is Korean, the app also shows Korean public holidays, lunar-calendar dates and the 24 solar terms, and skips weekday commute alarms on Korean public holidays. The app interface is available in Korean, English, Japanese, Chinese (Simplified and Traditional), Spanish, French, German and Portuguese.

6. Regulated industry / third-party material
Not applicable. The app does not operate in a regulated industry and contains no protected third-party material.

Thank you.
```

## 화면 녹화 대본 (폰에서 직접, 1~2분)

녹화: 제어 센터 → 화면 기록(●). 소리는 필요 없다. 앱을 지우지 않는다(쓰던 알람이 사라짐) — 깔린 상태에서 실행부터 찍으면 된다.

1. 홈 화면에서 교대알람 아이콘을 눌러 **실행**(녹화는 실행 전부터 시작)
2. 첫 실행 안내가 나오면 넘기고, **알림 허용**
3. 오른쪽 위 **＋** → "교대근무" 카드에서 근무조 선택 → 출근·퇴근 시각 정하기 → 근무 블록 2~3개와 비번 쌓기 → **여기서 반복** → 저장
4. **달력 탭**: 근무일 색칠·비번 표시 보여 주기
5. 달력에서 날짜 하나 눌러 **하루 근무 변경** 팝업 열었다 닫기(또는 연차 하나 저장)
6. 1~2분 뒤로 **알람 하나 추가**(진동만) → 잠금 화면/배너로 알림이 오는 것 → **끄기**
7. 설정 화면 한 번 훑기 → 끝

녹화 파일(사진 앱)은 Mac으로 AirDrop해서 회신에 첨부한다.
