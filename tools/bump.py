#!/usr/bin/env python3
"""一次過升版本號（避免漏改／改錯）。

用法：python3 tools/bump.py 51 52

必須改嘅地方：
  1. index.html          var V、所有 ?v=、頁尾 buildTag
  2. sw.js               VERSION、ASSETS 內所有 ?v=
  3. js/ui-tiles.js      IMG_VERSION、?v=
  4. js/app.js / js/practice.js / js/battle-ui.js   BUILD

注意：一定要「先讀完、後開檔寫」，唔可以寫成
    open(p, 'w').write(open(p).read().replace(...))
因為 open(p, 'w') 會即刻清空檔案，之後讀到嘅就係空字串（會整爛個檔案）。
"""
import re
import sys


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def bump(old, new):
    o, n = int(old), int(new)

    s = read('index.html')
    s = re.sub(r"var V = '\d+';", "var V = '%d';" % n, s)
    s = s.replace('?v=%d' % o, '?v=%d' % n)
    s = re.sub(r'id="buildTag">v\d+<', 'id="buildTag">v%d<' % n, s)
    write('index.html', s)

    s = read('sw.js')
    s = re.sub(r"var VERSION = 'v(\d+)';", lambda m: "var VERSION = 'v%d';" % (int(m.group(1)) + 1), s)
    s = s.replace('?v=%d' % o, '?v=%d' % n)
    write('sw.js', s)

    s = read('js/ui-tiles.js')
    s = re.sub(r"IMG_VERSION = '\d+'", "IMG_VERSION = '%d'" % n, s)
    s = s.replace('?v=%d' % o, '?v=%d' % n)
    write('js/ui-tiles.js', s)

    for path in ('js/app.js', 'js/practice.js', 'js/battle-ui.js'):
        s = read(path)
        s = re.sub(r"BUILD = 'v\d+'", "BUILD = 'v%d'" % n, s)
        write(path, s)

    write('version.json', '{\n  "v": "%d"\n}\n' % n)
    print('bumped v%d -> v%d' % (o, n))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('用法：python3 tools/bump.py <舊版本> <新版本>')
        sys.exit(1)
    bump(sys.argv[1], sys.argv[2])
