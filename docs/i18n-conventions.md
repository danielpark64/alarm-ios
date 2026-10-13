# 문구를 t()로 감싸는 규칙 (feat/i18n 3단계)

목표: **한국어 화면은 글자 하나도 바뀌지 않게** 하면서, 사용자에게 보이는 모든 한국어 문구를 번역 가능하게 만든다.
번역 방식은 "한국어 원문이 곧 키"다. `t('알람 추가')`는 한국어일 때 `'알람 추가'`를 그대로 돌려준다.

## 가져오는 곳
- React 컴포넌트·훅: `import { useT } from '<상대경로>/i18n';` → 컴포넌트 본문 맨 위에서 `const { t } = useT();`
  (언어가 바뀌면 다시 그려진다). 같은 파일 안의 하위 컴포넌트·memo 컴포넌트도 각각 `useT()`를 부른다.
- 훅을 못 쓰는 곳(유틸 함수, 알림 예약, 위젯, 컴포넌트 밖 헬퍼, `Alert.alert`를 부르는 일반 함수 등):
  `import { t } from '<상대경로>/i18n/translate';` — **반드시 `i18n/translate`** (`i18n` 인덱스는 React·AsyncStorage를
  끌고 와서 순수 로직 테스트 `scripts/logic-tests`가 깨진다. `src/utils/**`, `src/constants/**`는 절대 `i18n` 인덱스를 import하지 말 것).
- 모듈 최상위 상수(배열·객체의 label 등)는 그 자리에서 t()를 부르면 import 시점 언어로 굳는다. 대신
  `import { N } from '<상대경로>/i18n/lang';`의 표식 `N('초번')`으로 감싸 두고, **표시하는 쪽에서 `t(x.label)`** 로 번역한다.

## 감싸는 법
- 고정 문구: `<Text>알람 추가</Text>` → `<Text>{t('알람 추가')}</Text>`, `placeholder="…"` → `placeholder={t('…')}`,
  `Alert.alert('제목', '본문', [{ text: '취소' }])` → 각 문자열을 `t()`로.
- 값이 끼는 문구는 **고정 키 + params**: `` `${n}일` `` → `t('{n}일', { n })`, `` `선택한 ${k}개를 삭제할까요?` `` →
  `t('선택한 {k}개를 삭제할까요?', { k })`. 템플릿 리터럴에 `${}`가 들어간 채로 t()에 넘기지 말 것(키 추출이 안 된다).
  조각을 이어붙이지 말고 문장 통째로 키를 만든다(언어마다 어순이 다르다). 예: `label + ' · 다음날'` →
  `t('{label} · 다음날', { label })`.
- 조건부 문구는 갈래마다 따로: `x ? t('켜짐') : t('꺼짐')`.
- 상수 라벨을 표시할 때: `{t(shift.label)}`, `{t(type.label)}`, `t(OVERRIDE_KINDS.find(...)!.label)`.
  사용자 입력 문자열(알람 이름 `alarm.label`, `shiftCustom`, 경조사 메모)은 번역하지 않는다 —
  `alarm.label || t(type.label)`처럼 기본값 쪽만 감싼다.
- 요일: 기존 `DAYS`/`DAYS_DISPLAY`(['월','화',…]) 값을 표시할 때 `t(DAYS[i])`. 월 이름: `t(`${m}월`)`은 금지(보간) —
  대신 `t(MONTH_KEYS[m-1])`를 쓴다(`MONTH_KEYS = [N('1월'), …, N('12월')]`를 src/constants/index.ts에 한 번만 정의. 이미 있으면 재사용).
  "10월 9일 금요일" 같은 날짜 문장은 `t('{month} {d}일 {dow}요일', { month: t(MONTH_KEYS[m-1]), d, dow: t(DAYS[i]) })`처럼
  문장 전체를 키로 둔다(한국어 결과가 기존과 정확히 같아야 한다 — 공백·구두점 포함).
- 알림 본문 `` `${pad(h)}:${pad(m)} 알람` `` → `t('{time} 알람', { time: `${pad(h)}:${pad(m)}` })`.
  ⚠️ 이 본문은 네이티브 끄기 경로가 **맨 앞의 HH:MM**을 정규식으로 읽으므로(`cancelExpoGroupReps`), 키는 반드시 `{time}`으로 시작해야 한다.

- 같은 한국어가 뜻이 다른 곳에 쓰이면 키 뒤에 `##문맥`을 붙인다(한국어 출력에서는 떼어진다): 요일은 `DAYS`의 `'일'` 그대로,
  날짜 단위 한 글자는 `t('일##단위')`, 시간 단위는 `t('시##단위')`, `t('분##단위')`. 요일 한 글자('월'~'일')와 겹치는
  한 글자 키는 반드시 이렇게 구분한다. 가능하면 한 글자 키 대신 `t('{n}일', { n })`처럼 문장 키를 쓴다.
- `src/constants/index.ts`의 라벨은 이미 `N('…')`으로 감싸 뒀다(TYPES·SHIFTS·REPEAT·SOUNDS·VIBS·OVERRIDE_KINDS·DAYS·DAYS_DISPLAY·MONTH_KEYS).
  이 파일은 고치지 말고, 그 라벨을 **화면에 표시하는 곳에서 `t(x.label)`** 로 감싸기만 하면 된다.

## 건드리지 않는 것
- 주석, 로그, AsyncStorage 키, 식별자, 테스트용 문자열, 정적 체크가 grep하는 코드 구조.
  ⚠️ `scripts/test-alarm-suite.sh`가 특정 코드 문자열을 grep한다 — 감싼 뒤 `./scripts/test-alarm-suite.sh --static`이
  전부 PASS여야 한다. 깨지면 코드 쪽을 되돌리지 말고 무엇이 깨졌는지 보고에 적는다(체크 문자열 갱신은 메인 세션이 한다).
- 로직·스타일·레이아웃·함수 시그니처(꼭 필요한 경우 제외). 번역 사전 파일(`src/i18n/locales/*`)도 만들지 않는다 — 키만 감싼다.
- 한국 전용 데이터: `src/constants/holidays.ts`의 공휴일 이름, `solarTerms.ts`의 절기 이름, 음력 표기 — 한국어일 때만 보이는 기능이라 그대로 둔다.
- 이모지·숫자·시각(HH:MM)·"Android" 같은 고유명사.

## 끝나고 반드시
1. `npx tsc --noEmit` — `src/ReactotronConfig.ts` TS2556 한 건(기존) 외 오류 0.
2. `node scripts/logic-tests/run.js` — 전부 통과(한국어 기준 문자열이 그대로인지 검증한다).
3. `./scripts/test-alarm-suite.sh --static` — 결과 보고.
4. 맡은 파일에 한글 문자열 리터럴이 남았는지 스스로 grep: 남긴 것은 이유(주석/사용자 입력/한국 전용 등)를 보고.
