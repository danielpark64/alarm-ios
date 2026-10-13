# 사전 작성 지침 (feat/i18n 4단계)

교대알람은 교대 근무자를 위한 알람·근무 달력 앱이다. 화면 문구의 한국어 원문이 곧 번역 키다.
`src/i18n/keys.json`에 모든 키(`key`)와 그 키가 쓰이는 파일(`files`)이 있다. 네가 맡은 언어의 사전 파일
`src/i18n/locales/<lang>.ts` **하나만** 고쳐서 모든 키의 번역을 채운다(다른 파일·git 커밋 금지).

## 파일 형식
```ts
// <lang> 사전 (키 = 한국어 원문). 없는 키는 영어 → 한국어 순으로 폴백.
export const <이미 있는 export 이름>: Record<string, string> = {
  "알람 추가": "Add alarm",
  ...
};
```
- 기존 파일의 export 이름(EN, JA, ZH_HANS, ZH_HANT, ES, FR, DE, PT)을 그대로 쓴다.
- 키는 keys.json의 `key`를 **글자 그대로**(공백·구두점·이모지·줄바꿈 포함) JSON 문자열로 적는다. 키와 값 모두 큰따옴표 JSON 문자열을
  쓰면 이스케이프 실수가 없다(줄바꿈은 `\n`). 직접 손으로 옮기지 말고 스크립트(node)로 keys.json을 읽어 뼈대를 만든 뒤 값을 채우는 방식을 권한다.
- 화면 영역별로 주석을 달아 묶으면 좋지만 필수는 아니다.

## 반드시 지킬 것
1. `{n}`, `{label}`, `{time}` 같은 자리표시자는 번역문에 **전부 그대로** 들어가야 한다(어순은 자유).
2. 키가 `{time}`으로 시작하면 번역도 **반드시 `{time}`으로 시작**한다(알림 본문 맨 앞의 HH:MM을 네이티브 코드가 읽는다). 예: `"{time} 알람"` → `"{time} Alarm"`.
3. `##` 뒤는 문맥 표시다. `"일##단위"`는 날짜 단위 '일(day)'이라는 뜻 — 값에는 `##`를 넣지 않는다.
4. 요일 한 글자 키 `"월" "화" "수" "목" "금" "토" "일"`은 요일 약어(Mon…Sun)다. `"1월"`…`"12월"`은 월 이름(약어 권장: Jan, 1月, Jan., ene 등 — 달력 머리글과 "{month} {d}일" 문장에 들어간다).
5. 날짜·시간 문장 키는 그 언어의 자연스러운 표기로: `"{month} {d}일 {dow}요일"` → en `"{dow}, {month} {d}"`, ja `"{month}{d}日 {dow}曜日"`, de `"{dow}, {d}. {month}"` 등.
6. 화면이 좁다. 버튼·칩·탭 라벨은 짧게(근무조 이름은 6자 안팎, 탭 라벨은 한 단어). 문장은 자연스럽고 친근한 존댓말 톤(원문이 "~해요"체).
7. 이모지·기호(→ · ● ○ ✓ ＋ ‹ ›)는 그대로 둔다.
8. 한국 전용 기능 문구(음력, 한국 공휴일, 후원 계좌, 채널 바로가기)도 번역은 채운다(화면에서는 한국어일 때만 보이지만 누락 검사 대상이다).

## 용어 (docs/shift-systems-research.md의 나라별 표를 따른다)
| 한국어 | 뜻 | en | ja | zh-Hans | zh-Hant | de | es | fr | pt |
|---|---|---|---|---|---|---|---|---|---|
| 초번 | 이른 근무조 | Early | 早番 | 早班 | 早班 | Früh | Mañana | Matin | Manhã |
| 중번 | 중간 근무조 | Mid | 中番 | 中班 | 中班 | Mittel | Intermedio | Journée | Intermédio |
| 말번 | 늦은 근무조 | Late | 遅番 | 晚班 | 晚班 | Spät | Tarde | Soir | Tarde |
| 주간 | 2교대 낮 근무 | Day | 日勤 | 白班 | 白班 | Tag | Día | Jour | Dia |
| 야간 | 밤 근무(다음날 퇴근) | Night | 夜勤 | 夜班 | 大夜班 | Nacht | Noche | Nuit | Noite |
| 비번 | 쉬는 날(근무표상 휴무) | Off | 休み | 休息 | 休假 | Frei | Libre | Repos | Folga |
| 출근 / 퇴근 | 근무 시작/종료 알람 | Clock in / Clock out | 出勤 / 退勤 | 上班 / 下班 | 上班 / 下班 | Dienstbeginn / Dienstende | Entrada / Salida | Début / Fin | Entrada / Saída |
| 연차 / 반차 / 반반차 / 병가 | 휴가 종류 | Leave / Half day / Quarter day / Sick | 有給 / 半休 / 時間休 / 病欠 | 年假 / 半天假 / 小时假 / 病假 | 特休 / 半天假 / 小時假 / 病假 | Urlaub / Halber Tag / Vierteltag / Krank | Vacaciones / Medio día / Cuarto de día / Baja | Congé / Demi-journée / Quart de journée / Maladie | Férias / Meio dia / Quarto de dia / Doença |
| 대근 / 특근 | 교대 대신 근무 / 추가 근무 | Cover / Extra shift | 代勤 / 休日出勤 | 代班 / 加班日 | 代班 / 加班日 | Vertretung / Zusatzschicht | Cobertura / Turno extra | Remplacement / Poste supp. | Cobertura / Turno extra |
| 야근 / 연장 | 늦게까지 근무 / 연장 근무 | Late work / Overtime | 夜間残業 / 残業 | 夜间加班 / 加班 | 夜間加班 / 加班 | Spätarbeit / Überstunden | Trabajo nocturno / Horas extra | Travail tardif / Heures sup. | Serão / Horas extra |
| 대체휴무 / 대기근무 | 휴일근무 대신 쉬는 날 / 호출 대기 | Comp day / On-call | 代休 / 待機 | 调休 / 待命 | 補休 / 待命 | Freizeitausgleich / Bereitschaft | Día compensatorio / Guardia | Récupération / Astreinte | Folga compensatória / Sobreaviso |
| 경조사 | 결혼식·장례식 등 가족 행사 메모 | Family event | 冠婚葬祭 | 红白事 | 婚喪喜慶 | Familienanlass | Evento familiar | Événement familial | Evento familiar |
| 휴일근무 | 공휴일에 근무한 날 집계 | Holiday work | 祝日出勤 | 节假日上班 | 國定假日出勤 | Feiertagsarbeit | Trabajo en festivo | Travail jour férié | Trabalho em feriado |
| 하루 근무 변경 | 특정 날짜 하루만 근무를 바꾸는 기능 | Change this day | この日だけ変更 | 当天班次调整 | 當日班次調整 | Tag ändern | Cambiar este día | Modifier ce jour | Alterar este dia |
| 이날 끄기 | 그 날짜만 알람 끄기 | Skip this day | この日はオフ | 当天关闭 | 當天關閉 | Diesen Tag aus | Omitir este día | Ignorer ce jour | Pular este dia |
| 근무표 / 근무 순환표 | 교대 순환 패턴 | Shift pattern / Rotation | シフト表 / ローテーション | 排班表 / 轮班表 | 班表 / 輪班表 | Schichtplan / Rotation | Turnos / Rotación | Planning / Rotation | Escala / Rodízio |
| 교대알람 | 앱 이름 | Shift Alarm | 交代アラーム | 轮班闹钟 | 輪班鬧鐘 | Schichtwecker | Alarma de Turnos | Réveil Posté | Alarme de Turnos |

프리셋 이름: `"2-2-3 (피트먼)"` → "2-2-3 (Pitman)", `"듀폰"` → "DuPont", `"주야비휴"` → 그 언어로 "Day · Night · Off · Off" 식 설명형 이름.

## 끝나고 반드시
`node scripts/i18n-keys.js --check --lang <lang>` 가 "누락 0 / 자리표시자 깨짐 0 / 시각이 맨 앞이 아님 0"(= 그 언어 줄이 출력되지 않고 마지막 줄이 "누락 없음")이어야 한다.
`npx tsc --noEmit`에서 네 파일의 오류가 없어야 한다. 보고(한국어): 키 수, 번역이 애매해서 판단한 항목 5~10개(원문 → 번역, 이유), 길이가 길어 화면에서 잘릴 우려가 있는 항목.
