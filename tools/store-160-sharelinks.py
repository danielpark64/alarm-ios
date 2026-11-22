# 공유 탭 스크린샷용 가짜 근무표 3개(받기 링크) — 2026-11-22부터 215일
# 사용: python3 mklinks.py [주간 야간 비번 출근 휴무]  (라벨은 보낸 사람 앱 언어 — 언어별 촬영 때 바꿔 넣는다)
import json, urllib.parse, datetime, sys
B36='0123456789abcdefghijklmnopqrstuvwxyz'
start=datetime.date(2026,11,22); N=215
day,night,off,work,rest=(sys.argv[1:]+["주간","야간","비번","출근","휴무"][len(sys.argv[1:]):])[:5]
def body(l,c,o,fn):
    return json.dumps({"f":start.isoformat(),"l":l,"c":c,"o":o,"d":"".join(B36[fn(i)] for i in range(N)),"t":1795000000000},separators=(',',':'),ensure_ascii=False)
A=body([day,night,off],["#F5B041","#5D6DFF","#7FB3D5"],[0,0,1],lambda i:[0,1,2][(i+2)%3])
B=body([work,rest],["#AF7AC5","#58D68D"],[0,1],lambda i:1 if (start+datetime.timedelta(i)).weekday()>=5 else 0)
C=body([day,night,off],["#F5B041","#5D6DFF","#7FB3D5"],[0,0,1],lambda i:[0,0,1,1,2,2,2,2][(i+7)%8])
for sid,b in zip(["demoa1b2c3","demob4d5e6","democ7f8g9"],[A,B,C]):
    print("alarmappshare://?v=1&i=%s&p=%s"%(sid,urllib.parse.quote(b,safe='')))
