# 교대알람(RotaWake) App Store 제출 자료

App Store Connect(appstoreconnect.apple.com)에 그대로 옮겨 넣는 값. 로그인·제출 버튼은 사용자가 직접 누른다.
Play 자료(`store-assets/listings/`)를 바탕으로, iPhone에서 다르게 동작하는 부분(알림으로 울림·무음이면 진동·Apple Watch)을 고쳤다.

## 1. 앱 만들기 (나의 앱 → ＋ → 신규 앱)

| 칸 | 값 |
|---|---|
| 플랫폼 | iOS |
| 이름 | `RotaWake: Shift Work Alarm` (기본 언어 영어 기준. 한국어 이름은 로캘별로 따로 넣는다) |
| 기본 언어 | **한국어** (한국 사용자가 대부분 — 다른 언어 기기는 해당 로캘 문구가 보인다) |
| 번들 ID | `com.danielpark.alarmapp` |
| SKU | `alarmapp-ios` (아무 값이나 되지만 나중에 못 바꿈) |
| 사용자 액세스 | 전체 액세스 |

기본 언어를 한국어로 하면 기본 이름은 `교대알람(RotaWake)`이다. 같은 이름이 이미 있으면 거절되는데, 2026-10-21 한국 App Store 검색 기준 같은 이름은 없었다(비슷한 "교대 알람"은 다른 개발자 앱).

## 2. 앱 정보

| 칸 | 값 |
|---|---|
| 카테고리 | 기본: **유틸리티**, 보조: **생산성** |
| 콘텐츠 권한 | 제3자 콘텐츠 없음 |
| 연령 등급 | 모든 질문 "없음" → **4+** |
| 개인정보처리방침 URL | `https://danielpark64.github.io/alarm-ios/privacy.html` (영어는 같은 주소, 페이지 안 `#en`) |

## 3. 가격 및 사용 가능 여부
- 가격: **무료**
- 사용 가능 국가: Play와 맞추면 대한민국 + 12개국(미국·영국·캐나다·호주·뉴질랜드·일본·대만·홍콩·독일·스페인·프랑스·브라질 등). 처음엔 전체 국가로 해도 된다(번역 없는 나라는 영어 문구).

## 4. 앱 개인정보 보호 (App Privacy)
- "데이터를 수집합니까?" → **아니요, 이 앱에서 데이터를 수집하지 않습니다.**
  - 근거: 로그인·광고·분석 SDK 없음. 알람·근무표는 기기 안에만. 한국어일 때만 공휴일 공개 API(data.go.kr)에서 공휴일 날짜를 받아 오는데, 개인을 식별할 수 있는 정보를 보내지 않는다.
  - 세이람 공유는 같은 기기 안 App Group 폴더라 "수집"이 아니다.

## 5. 버전 정보 (1.5.0)
언어마다 `ko.md` · `en.md` · `ja.md` · `zh-Hans.md` · `zh-Hant.md` · `es.md` · `fr.md` · `de.md` · `pt.md`의 값을 넣는다.
| 칸 | 어디서 |
|---|---|
| 홍보 문구 | 각 파일 "홍보 문구" |
| 설명 | 각 파일 "설명" |
| 키워드 | 각 파일 "키워드" |
| 지원 URL | `https://danielpark64.github.io/alarm-ios/support.html` |
| 마케팅 URL | 비워 둔다 |
| 이번 버전의 새로운 기능 | 첫 출시라 칸이 없다 |
| 저작권 | `2026 Susu Development` (Play 개발자 이름과 맞춤) |
| 스크린샷 | `store-assets/appstore/screenshots/<언어>/` 6.9인치(1320×2868) 6장, 01→06 순서 |

로캘 추가: 버전 화면 오른쪽 위 언어 선택 → 각 파일 맨 위 "App Store 로캘"에 적힌 언어를 추가한다(영어는 미국·영국·호주·캐나다, 스페인어는 스페인·멕시코 등).

## 6. 빌드
- 버전 1.5.0, 빌드 1. Xcode에서 Archive → Distribute App → App Store Connect 업로드(또는 Claude가 Archive까지 만들고, 업로드는 사용자 확인 후).
- 수출 규정: Info.plist `ITSAppUsesNonExemptEncryption = false`(HTTPS만 사용) → 업로드 때 암호화 질문을 따로 묻지 않는다.

## 7. 앱 심사 정보
- 로그인 필요 없음(데모 계정 칸 비움).
- 연락처: 이름 Daniel Park, 이메일 danielpark6532@gmail.com, 전화번호는 사용자가 입력.
- 메모(영어로):

```
RotaWake is an alarm app for shift workers. No account or login is needed.
How to test: tap "+" (top right) to add an alarm, or open Settings → "Shift pattern walkthrough" to build a rotating shift pattern. Alarms are delivered as local notifications at the scheduled time (please allow notifications on first launch). The calendar tab fills in work days and days off from the alarms.
The optional "Share with SayRam" setting shares data only between our two apps on the same device through an App Group; nothing is sent over the network. Public holidays are fetched from the Korean government open API only when the app language is Korean.
```

## 8. 출시 전에 같이 할 일
- `docs/privacy.html` 4장의 "(현재 Android에서 제공)" / "(Currently available on Android.)" 지우기 — 세이람과 같은 날(세이람 채팅과 약속).
- `feat/sayram-share`를 main에 병합해야 개인정보처리방침·지원 페이지(`docs/support.html`)가 공개된다. App Store 심사 제출 **전에** 두 주소가 열리는지 확인.
- 세이람 소개 배너는 iOS에서 나오지 않는다(Play 주소라서). App Store 출시 뒤 세이람 App Store 주소가 생기면 다시 정한다.
