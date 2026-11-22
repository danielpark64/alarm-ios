// 알람 소리 고르기(src/constants/alarmTones.ts) — 알람마다 소리 하나. 기존 알람(tone 없음)은 '기본'(alarm_long)
// 그대로여야 하고, 진동만이면 iOS는 무음 파일을 붙여야 진동이 온다. 알 수 없는 id(옛 버전·깨진 데이터)는 기본으로.
module.exports = (U, M) => {
  const C = M.constants;
  check('alarmTones가 constants에서 나온다', !!(C && C.ALARM_TONES && C.notifSoundFor));
  if (!C || !C.ALARM_TONES || !C.notifSoundFor) return;

  // ── 목록: 기본 + 6개, 기본이 맨 앞 ──
  check('선택지는 기본+6개', C.ALARM_TONES.length === 7, String(C.ALARM_TONES.length));
  check('맨 앞은 기본', C.ALARM_TONES[0].id === 'default');
  check('기본 소리 파일은 지금의 alarm_long.wav', C.toneIosFile('default') === 'alarm_long.wav');
  check('기본 Android 리소스는 alarm_long', C.toneAndroidRes('default') === 'alarm_long');
  const ids = new Set(C.ALARM_TONES.map(x => x.id));
  check('id가 겹치지 않는다', ids.size === C.ALARM_TONES.length);
  // iOS 알림 소리 파일은 번들의 wav/caf/aiff, Android res/raw 이름은 소문자 영문·숫자·밑줄만
  check('iOS 파일은 wav/caf/aiff', C.ALARM_TONES.every(x => /\.(wav|caf|aiff)$/.test(x.ios)));
  check('Android 리소스 이름 규칙', C.ALARM_TONES.every(x => /^[a-z][a-z0-9_]*$/.test(x.android)));

  // ── 기본값·알 수 없는 id ──
  check('tone 없음 → 기본', C.normalizeTone(undefined) === 'default');
  check('빈 문자열 → 기본', C.normalizeTone('') === 'default');
  check('알 수 없는 id → 기본', C.normalizeTone('ringtone_xyz') === 'default');
  check('숫자 등 엉뚱한 값 → 기본', C.normalizeTone(3) === 'default');
  check('아는 id는 그대로', C.normalizeTone('marimba') === 'marimba');
  check('알 수 없는 id의 iOS 파일은 기본 파일', C.toneIosFile('nope') === 'alarm_long.wav');
  check('알 수 없는 id의 Android 리소스는 기본', C.toneAndroidRes('nope') === 'alarm_long');
  check('마림바 iOS 파일은 alarm_long이 아니다', C.toneIosFile('marimba') !== 'alarm_long.wav');

  // ── 알림 소리(content.sound) — 기존 동작과 100% 같아야 하는 갈래 ──
  check('iOS 소리 켬·tone 없음 → alarm_long.wav(기존과 동일)', C.notifSoundFor('ios', true, undefined) === 'alarm_long.wav');
  check('iOS 소리 켬·마림바 → 마림바 파일', C.notifSoundFor('ios', true, 'marimba') === C.toneIosFile('marimba'));
  check('iOS 진동만 → 무음 파일(진동이 오게)', C.notifSoundFor('ios', false, 'marimba') === 'silent_short.wav');
  check('iOS 진동만·tone 없음 → 무음 파일', C.notifSoundFor('ios', false, undefined) === 'silent_short.wav');
  check('Android 진동만 → 소리 없음(undefined)', C.notifSoundFor('android', false, 'beep') === undefined);
  // Android Expo 알림 소리는 채널이 정한다 — 실제 울림은 네이티브 AlarmService. 문자열은 기존 그대로 둔다.
  check('Android 소리 켬 → 기존 문자열 그대로', C.notifSoundFor('android', true, 'beep') === 'alarm_long.wav');
  check('개발 빌드 소리 켬 → true(시스템 기본음, 기존과 동일)', C.notifSoundFor('ios', true, 'beep', true) === true);
  check('개발 빌드 진동만 → 무음 파일', C.notifSoundFor('ios', false, 'beep', true) === 'silent_short.wav');

  // ── 같은 시각 묶음 보조 알림: 소리 켠 첫 알람의 소리 ──
  check('묶음: 소리 켠 첫 알람 소리', C.groupTone([{ snd: 'none', tone: 'beep' }, { snd: 'default', tone: 'piano' }, { snd: 'default', tone: 'chime' }]) === 'piano');
  check('묶음: 다 진동만이면 기본', C.groupTone([{ snd: 'none', tone: 'beep' }]) === 'default');
  check('묶음: tone 없는 기존 알람 → 기본', C.groupTone([{ snd: 'default' }]) === 'default');

  // ── 점점 크게(Android): 기본 꺼짐 ──
  check('점점 크게 기본 꺼짐', C.crescendoOn(undefined) === false && C.crescendoOn({}) === false);
  check('점점 크게 켬', C.crescendoOn({ crescendo: true }) === true);
  check('점점 크게 20초', C.CRESCENDO_MS === 20000);

  // ── 이름 번역: 9개 언어에서 키가 있어야 한다(한국어는 그대로) ──
  check('한국어 이름', M.translate.t(C.ALARM_TONES[3].label) === '옛날 자명종', M.translate.t(C.ALARM_TONES[3].label));
  setLang('en');
  check('영어 이름은 번역된다', M.translate.t('옛날 자명종') !== '옛날 자명종', M.translate.t('옛날 자명종'));
  setLang('ko');
};
