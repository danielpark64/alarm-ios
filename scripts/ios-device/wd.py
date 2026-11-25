#!/usr/bin/env python3
# iOS 실기기 자동 조작 도우미 — Appium(XCUITest 드라이버, WebDriverAgent) 서버에 HTTP로 명령을 보낸다.
# 표준 라이브러리만 쓴다. 직접 부르지 말고 scripts/ios-device-test.sh를 통해 쓴다(사용법은 그 파일 맨 위).
#
# 핵심 규칙(2026-08-23·11-26 미니에서 확인):
#   - 앱(React Native) 안의 버튼은 좌표 탭이 안 먹을 때가 있다 → 접근성 이름으로 찾아 element click.
#   - 알림 배너·알림 센터·잠금 화면은 앱이 아니라 SpringBoard(com.apple.springboard) 화면이다.
#     세션은 SpringBoard 기준으로 만들고, 앱 화면을 볼 땐 activateApp으로 앞에 띄운다.
#   - 세션 id는 상태 파일에 두고 다시 쓴다. 앱을 다시 설치하면 세션이 죽을 수 있어 자동으로 새로 만든다.
import json, os, sys, time, base64, urllib.request, urllib.error, re, subprocess

SERVER = os.environ.get('APPIUM_URL', 'http://127.0.0.1:4723')
UDID = os.environ['IOS_UDID']
TEAM = os.environ.get('IOS_TEAM', 'T5Z6ACK2PU')
WDA_ID = os.environ.get('WDA_BUNDLE_ID', 'com.danielpark.wda')
STATE = os.path.expanduser(f'~/Library/Caches/ios-device-test/session-{UDID}.txt')
SPRINGBOARD = 'com.apple.springboard'


def req(method, path, body=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(SERVER + path, data=data, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as f:
            return json.loads(f.read() or b'{}').get('value')
    except urllib.error.HTTPError as e:
        v = json.loads(e.read() or b'{}').get('value', {})
        raise RuntimeError(f"{method} {path}: {v.get('error')} — {str(v.get('message'))[:300]}")


def new_session():
    caps = {
        'platformName': 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:udid': UDID,
        'appium:xcodeOrgId': TEAM,
        'appium:xcodeSigningId': 'Apple Development',
        'appium:updatedWDABundleId': WDA_ID,
        'appium:allowProvisioningDeviceRegistration': True,  # 없으면 "No profiles for ...xctrunner"
        'appium:noReset': True,
        'appium:wdaLaunchTimeout': 240000,
        'appium:newCommandTimeout': 3600,
        'appium:bundleId': SPRINGBOARD,  # 앱을 띄우지 않고 홈 화면 기준으로 시작
        'appium:shouldTerminateApp': False,
        'appium:forceAppLaunch': False,
    }
    v = req('POST', '/session', {'capabilities': {'alwaysMatch': caps, 'firstMatch': [{}]}}, timeout=900)
    sid = v['sessionId']
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    open(STATE, 'w').write(sid)
    return sid


def session():
    if os.path.exists(STATE):
        sid = open(STATE).read().strip()
        try:
            req('GET', f'/session/{sid}/timeouts', timeout=20)
            return sid
        except Exception:
            pass
    return new_session()


S = None
def sid():
    global S
    if S is None:
        S = session()
    return S


def mobile(script, args=None, timeout=300):
    return req('POST', f'/session/{sid()}/execute/sync', {'script': f'mobile: {script}', 'args': [args or {}]}, timeout=timeout)


def find_all(using, value):
    return [list(e.values())[0] for e in req('POST', f'/session/{sid()}/elements', {'using': using, 'value': value})]


def label_pred(text, kinds=None):
    t = text.replace("'", "\\'")
    p = f"(label CONTAINS '{t}' OR name CONTAINS '{t}')"
    if kinds:
        p += ' AND (' + ' OR '.join(f"type == '{k}'" for k in kinds) + ')'
    return p


def find(text, kinds=None, wait=10):
    end = time.time() + wait
    while True:
        els = find_all('-ios predicate string', label_pred(text, kinds))
        if els:
            return els[0]
        if time.time() > end:
            return None
        time.sleep(0.7)


def click(el):
    req('POST', f'/session/{sid()}/element/{el}/click', {})


def attr(el, name):
    return req('GET', f'/session/{sid()}/element/{el}/attribute/{name}')


def rect(el):
    return req('GET', f'/session/{sid()}/element/{el}/rect')


def activate(bundle):
    mobile('activateApp', {'bundleId': bundle})


def screenshot(path):
    b = req('GET', f'/session/{sid()}/screenshot')
    open(path, 'wb').write(base64.b64decode(b))
    print(path)


def source():
    return req('GET', f'/session/{sid()}/source')


def visible_texts(xml):
    seen, out = set(), []
    for m in re.finditer(r'<XCUIElementType(\w+)[^>]*?(?:label="([^"]*)")?[^>]*?visible="true"', xml):
        kind, lab = m.group(1), m.group(2)
        if lab and (kind, lab) not in seen:
            seen.add((kind, lab)); out.append(f'{kind}: {lab}')
    return out


def drag(x1, y1, x2, y2, dur=0.3):
    mobile('dragFromToForDuration', {'fromX': x1, 'fromY': y1, 'toX': x2, 'toY': y2, 'duration': dur})


def window_size():
    return req('GET', f'/session/{sid()}/window/rect')


def open_notification_center():
    # 맨 위 왼쪽 가장자리에서 아래로 끌기(iPad는 오른쪽 위가 제어 센터라 왼쪽에서)
    w = window_size()
    drag(w['width'] * 0.25, 2, w['width'] * 0.25, w['height'] * 0.6, 0.2)
    time.sleep(1.2)


def find_notification(text, wait):
    """SpringBoard에서 text가 들어간 알림 카드(배너·알림 센터·잠금 화면 공통 이름 NotificationShortLookView)를 찾는다.
    가로 화면에선 rect가 세로 기준으로 나오므로 크기로 거르지 않는다."""
    t = text.replace("'", "\\'")
    end = time.time() + wait
    while True:
        els = find_all('-ios predicate string', f"name == 'NotificationShortLookView' AND label CONTAINS '{t}'")
        if not els and not wait_center_ok() and time.time() + 3 > end:  # 마지막엔 알림 센터도 열어 본다
            open_notification_center()
            els = find_all('-ios predicate string', f"name == 'NotificationShortLookView' AND label CONTAINS '{t}'")
        if els:
            return els[0]
        if time.time() > end:
            return None
        time.sleep(1)


def wait_center_ok():
    """지금 알림 센터·잠금 화면 목록이 열려 있는가(ListCell이 보이면 목록)"""
    return bool(find_all('-ios predicate string', "name == 'ListCell' AND visible == 1"))


def notif_action(text, button, wait):
    """알림을 찾아 길게 눌러 펼치고 버튼(예: '5분 후 다시')을 누른다. 배너·알림 센터·잠금 화면 공통."""
    # 배너를 길게 누르면 안 된다 — 누르는 사이 배너가 사라지면 홈 화면을 길게 눌러 편집 모드로 들어간다(11-26 미니).
    # 알림이 온 뒤 알림 센터를 열어 거기서 누른다(잠금 화면이면 그대로 잠금 화면 목록에서).
    el = find_notification(text, wait)  # 배너든 목록이든 알림이 올 때까지 기다린 뒤
    if not wait_center_ok():
        time.sleep(1)
        open_notification_center()
        el = find_notification(text, 10)
    if not el:
        raise RuntimeError(f"알림을 못 찾음: '{text}' ({wait}초)")
    mobile('touchAndHold', {'elementId': el, 'duration': 1.2})
    time.sleep(1.2)
    if os.environ.get('NOTIF_SHOT'):  # 펼친 알림(버튼이 보이는 상태)을 캡처
        screenshot(os.environ['NOTIF_SHOT'])
    b = find(button, ['XCUIElementTypeButton', 'XCUIElementTypeCell', 'XCUIElementTypeOther', 'XCUIElementTypeStaticText'], wait=6)
    if not b:
        raise RuntimeError(f"버튼을 못 찾음: '{button}' — 펼친 화면: " + '; '.join(visible_texts(source())[:30]))
    click(b)
    print(f"눌렀음: [{button}]")


def main():
    a = sys.argv[1:]
    cmd = a[0] if a else 'help'
    if cmd == 'session':
        print(sid())
    elif cmd == 'new-session':
        if os.path.exists(STATE):
            try: req('DELETE', f'/session/{open(STATE).read().strip()}', timeout=30)
            except Exception: pass
            os.remove(STATE)
        print(new_session())
    elif cmd == 'shot':
        screenshot(a[1])
    elif cmd == 'texts':  # 지금 화면(앞에 있는 앱)의 보이는 글자
        print('\n'.join(visible_texts(source())))
    elif cmd == 'source':
        print(source())
    elif cmd == 'activate':
        activate(a[1])
    elif cmd == 'terminate':
        print(mobile('terminateApp', {'bundleId': a[1]}))
    elif cmd == 'state':  # 0 없음 1 안 돌아감 2 백그라운드 정지 3 백그라운드 4 앞
        print(mobile('queryAppState', {'bundleId': a[1]}))
    elif cmd == 'home':
        mobile('pressButton', {'name': 'home'})
    elif cmd == 'volume-min':
        for _ in range(int(a[1]) if len(a) > 1 else 16):
            mobile('pressButton', {'name': 'volumeDown'}); time.sleep(0.15)
        print('음량 내림 버튼 눌렀음')
    elif cmd == 'lock':
        mobile('lock', {})
    elif cmd == 'unlock':
        mobile('unlock', {})
    elif cmd == 'is-locked':
        print(mobile('isLocked'))
    elif cmd == 'tap':  # 접근성 이름(라벨 일부)으로 찾아 누르기
        el = find(a[1], wait=float(a[2]) if len(a) > 2 else 10)
        if not el: raise RuntimeError(f"못 찾음: {a[1]}")
        click(el); print(f"눌렀음: {a[1]}")
    elif cmd == 'wait-text':  # 앞 화면에 글자가 나올 때까지(초)
        el = find(a[1], wait=float(a[2]) if len(a) > 2 else 30)
        print('있음' if el else '없음'); sys.exit(0 if el else 1)
    elif cmd == 'alert':  # 앱의 시스템 경고창(Alert) 글자를 읽고 첫 버튼으로 닫는다
        t = mobile('alert', {'action': 'getText'})
        print(t)
        if len(a) < 2 or a[1] != 'keep':
            try: mobile('alert', {'action': 'accept'})
            except Exception: pass
    elif cmd == 'notif-wait':  # SpringBoard에 text 들어간 알림이 뜰 때까지(초)
        activate_springboard = len(a) > 3 and a[3] == 'center'
        if activate_springboard: open_notification_center()
        el = find_notification(a[1], float(a[2]) if len(a) > 2 else 60)
        print('왔음' if el else '안 옴'); sys.exit(0 if el else 1)
    elif cmd == 'notif-action':  # notif-action <알림 글자> <버튼> [기다릴 초] [center]
        notif_action(a[1], a[2], float(a[3]) if len(a) > 3 else 60)
    elif cmd == 'notif-center':
        open_notification_center()
    elif cmd == 'springboard-texts':
        print('\n'.join(visible_texts(source())))
    else:
        print('명령: session new-session shot texts source activate terminate state home volume-min lock unlock is-locked tap wait-text alert notif-wait notif-action notif-center')


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as e:
        print('✗', e, file=sys.stderr); sys.exit(2)
