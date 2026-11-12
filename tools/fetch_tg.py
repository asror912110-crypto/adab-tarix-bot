"""Botga yuborilgan hujjatlarni yuklab olish (ZIP -> data/raw/<nom>/)."""
import json, os, sys, urllib.request, zipfile, re
tok = [l.split('=', 1)[1].strip() for l in open(os.path.join(os.path.dirname(__file__), '..', '.env')) if l.startswith('BOT_TOKEN=')][0]
api = f"https://api.telegram.org/bot{tok}/"
Z, R = '/home/user/data/zips', '/home/user/data/raw'
def call(m, **p):
    return json.load(urllib.request.urlopen(api + m + '?' + urllib.parse.urlencode(p), timeout=60))['result']
import urllib.parse
ups = call('getUpdates', timeout=0)
for u in ups:
    m = u.get('message', {})
    d = m.get('document')
    if not d:
        if m.get('text') or m.get('photo'): print('MSG', m.get('text', '<photo>')[:80])
        continue
    name = re.sub(r'[^\w.\- ()]', '_', d['file_name'])
    dst = os.path.join(Z, name)
    if os.path.exists(dst) and os.path.getsize(dst) == d['file_size']:
        continue
    try:
        f = call('getFile', file_id=d['file_id'])
    except Exception as e:
        print('FAIL', name, d['file_size'], e); continue
    urllib.request.urlretrieve(f"https://api.telegram.org/file/bot{tok}/{f['file_path']}", dst)
    print('OK', name, os.path.getsize(dst))
    if name.lower().endswith('.zip'):
        out = os.path.join(R, re.sub(r'\.zip$', '', name, flags=re.I))
        os.makedirs(out, exist_ok=True)
        with zipfile.ZipFile(dst) as z:
            for i in z.infolist():
                fn = i.filename
                try: fn = fn.encode('cp437').decode('utf-8')
                except Exception: pass
                tgt = os.path.realpath(os.path.join(out, fn))
                if not tgt.startswith(os.path.realpath(out) + os.sep) or i.is_dir(): continue
                os.makedirs(os.path.dirname(tgt), exist_ok=True)
                open(tgt, 'wb').write(z.read(i))
print('zips:', len(os.listdir(Z)))
