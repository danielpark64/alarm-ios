#!/usr/bin/env python3
"""스토어 대표 이미지(1024x500)를 언어별로 만든다.
원본 store-assets/feature-graphic.png의 왼쪽 시계 그림과 배경 그라데이션을 그대로 쓰고, 오른쪽 글자만 새로 그린다.
사용: python3 scripts/make-feature-graphic.py "<해외용 앱 이름>"   → store-assets/feature-graphics/<언어>.png
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = sys.argv[1] if len(sys.argv) > 1 else None
if not name: sys.exit('앱 이름을 인자로 주세요')
F = '/System/Library/Fonts/'
LATIN, KO, CJK = F + 'HelveticaNeue.ttc', F + 'AppleSDGothicNeo.ttc', F + 'Hiragino Sans GB.ttc'
ROWS = {  # 언어: (제목, 한 줄 소개, 글꼴)
  'ko-KR': ('교대알람', '알람 넣으면 근무표 완성', KO),
  'en-US': (name, 'Alarms that follow your rota', LATIN),
  'ja-JP': (name, 'シフトに合わせて鳴るアラーム', CJK),
  'zh-CN': (name, '跟着排班表响的闹钟', CJK),
  'zh-TW': (name, '跟著班表響的鬧鐘', CJK),
  'es-ES': (name, 'Alarmas que siguen tu cuadrante', LATIN),
  'fr-FR': (name, 'Des alarmes qui suivent votre planning', LATIN),
  'de-DE': (name, 'Wecker, die deinem Schichtplan folgen', LATIN),
  'pt-BR': (name, 'Alarmes que seguem a sua escala', LATIN),
}
src = Image.open(os.path.join(ROOT, 'store-assets/feature-graphic.png')).convert('RGB')
W, H = src.size
out = os.path.join(ROOT, 'store-assets/feature-graphics'); os.makedirs(out, exist_ok=True)
col = src.crop((W - 2, 0, W - 1, H))  # 글자가 없는 오른쪽 끝 한 줄 = 배경 그라데이션
X0, XMAX = 420, W - 40
def fit(text, path, size, idx=0):
    while size > 16:
        f = ImageFont.truetype(path, size, index=idx)
        if f.getlength(text) <= XMAX - X0 - 60: return f
        size -= 2
    return f
for lang, (title, tag, font) in ROWS.items():
    im = src.copy()
    im.paste(col.resize((W - X0, H)), (X0, 0))
    d = ImageDraw.Draw(im)
    tf = fit(title, LATIN if title == name else font, 84)
    sf = fit(tag, font, 31)
    x = 485
    if lang == 'ko-KR':
        # 한국 스토어 제목이 "교대알람(RotaWake)"라 이미지에도 해외용 이름을 작게 함께 쓴다
        d.text((x, 215), title, font=tf, fill=(255, 255, 255), anchor='ls')
        d.text((x + 2, 268), name, font=ImageFont.truetype(LATIN, 40), fill=(214, 208, 255), anchor='ls')
        d.text((x, 325), tag, font=sf, fill=(232, 228, 255), anchor='ls')
    else:
        d.text((x, 228), title, font=tf, fill=(255, 255, 255), anchor='ls')
        d.text((x, 300), tag, font=sf, fill=(232, 228, 255), anchor='ls')
    im.save(os.path.join(out, lang + '.png'), optimize=True)
    print(lang, im.size)
