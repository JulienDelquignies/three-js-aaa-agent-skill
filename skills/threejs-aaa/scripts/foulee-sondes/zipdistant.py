# Lire une archive ZIP (ZIP64 compris) À DISTANCE par requêtes Range : la table des matières, puis seulement les fichiers voulus.
import struct, sys, zlib, urllib.request, re, os, json
URL = sys.argv[1]
def rng(a, b):
    import time
    for k in range(8):
        try:
            r = urllib.request.Request(URL, headers={'Range': f'bytes={a}-{b}'}); return urllib.request.urlopen(r, timeout=120).read()
        except Exception as e:
            print('  (reprise', k, e, ')', file=sys.stderr); time.sleep(3 * (k + 1))
    raise RuntimeError('range')
def taille():
    r = urllib.request.Request(URL, headers={'Range': 'bytes=0-0'}); h = urllib.request.urlopen(r, timeout=60).headers['Content-Range']; return int(h.split('/')[1])
def table():
    N = taille(); tail = rng(max(0, N - 70000), N - 1); i = tail.rfind(b'PK\x05\x06')
    cd_n, cd_size, cd_off = struct.unpack('<HII', tail[i + 10:i + 20])[0], *struct.unpack('<II', tail[i + 12:i + 20])
    j = tail.rfind(b'PK\x06\x06')
    if j >= 0: cd_n, cd_size, cd_off = struct.unpack('<QQQ', tail[j + 32:j + 56])
    cd = rng(cd_off, cd_off + cd_size - 1); out = []; p = 0
    while p < len(cd) and cd[p:p + 4] == b'PK\x01\x02':
        meth, = struct.unpack('<H', cd[p + 10:p + 12]); csz, usz = struct.unpack('<II', cd[p + 20:p + 28]); nl, el, cl = struct.unpack('<HHH', cd[p + 28:p + 34]); off, = struct.unpack('<I', cd[p + 42:p + 46])
        name = cd[p + 46:p + 46 + nl].decode('utf-8', 'replace'); ex = cd[p + 46 + nl:p + 46 + nl + el]; q = 0
        while q + 4 <= len(ex):
            hid, hl = struct.unpack('<HH', ex[q:q + 4]); d = ex[q + 4:q + 4 + hl]
            if hid == 1:
                k = 0
                if usz == 0xFFFFFFFF: usz, = struct.unpack('<Q', d[k:k + 8]); k += 8
                if csz == 0xFFFFFFFF: csz, = struct.unpack('<Q', d[k:k + 8]); k += 8
                if off == 0xFFFFFFFF: off, = struct.unpack('<Q', d[k:k + 8]); k += 8
            q += 4 + hl
        out.append((name, meth, csz, usz, off)); p += 46 + nl + el + cl
    return out
def extraire(e, dest):
    name, meth, csz, usz, off = e; h = rng(off, off + 29); nl, el = struct.unpack('<HH', h[26:30]); a = off + 30 + nl + el
    raw = rng(a, a + csz - 1) if csz else b''; data = zlib.decompress(raw, -15) if meth == 8 else raw
    os.makedirs(os.path.dirname(dest) or '.', exist_ok=True); open(dest, 'wb').write(data)
if __name__ == '__main__':
    T = table()
    if len(sys.argv) == 2: json.dump(T, sys.stdout); sys.exit()
    pat = re.compile(sys.argv[2]); out = sys.argv[3]
    todo = [e for e in T if pat.search(e[0]) and not e[0].endswith('/') and not (os.path.exists(os.path.join(out, e[0])) and os.path.getsize(os.path.join(out, e[0])) == e[3])]
    if os.environ.get('UN_STATIQUE'):                                   # un seul essai statique par sujet (le plus petit numéro)
        garde, vus = [], set()
        for e in sorted(todo, key=lambda e: (e[0].split('/')[0], int(re.search(r'static_(\d+)', e[0]).group(1)) if 'static_' in e[0] else -1)):
            sj = e[0].split('/')[0]
            if 'static_' in e[0]:
                if sj in vus or os.path.exists(os.path.join(out, sj, 'MarkerData', 'static_1.trc')): continue
                vus.add(sj)
            garde.append(e)
        todo = garde
    from concurrent.futures import ThreadPoolExecutor
    def job(e): extraire(e, os.path.join(out, e[0])); print(e[0], e[3], flush=True)
    print(len(todo), 'fichiers,', round(sum(e[2] for e in todo) / 1e6), 'Mo compressés', flush=True)
    with ThreadPoolExecutor(int(os.environ.get('FILS', '8'))) as ex: list(ex.map(job, todo))
