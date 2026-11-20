"""Build the JSON files the site reads (docs/data/) from the scan cache written by scan.py.

Usage, from the repository root:
    python3 docs/tools/scan.py
    python3 docs/tools/build_data.py
"""
import collections, datetime, json, os
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'data')
EXPLORER_DEPTH = 10      # modules this many import levels below Main are expandable in the explorer
TOP_FANIN = 15

scan = json.load(open(os.path.join(HERE, 'modules.json')))
KINDS, HATCHES, M = scan['kinds'], scan['hatches'], scan['modules']
K = {k: i for i, k in enumerate(KINDS)}
idx = {m[0]: i for i, m in enumerate(M)}
name = lambda i: M[i][0]
lib = lambda n: n.split('.')[0]

# Library groups, largest first; the rest fold into "Other".
lines_by_lib = collections.Counter()
for m in M:
    lines_by_lib[lib(m[0])] += m[1]
GROUPS = [l for l, _ in lines_by_lib.most_common(6)] + ['Other']
group = lambda n: lib(n) if lib(n) in GROUPS else 'Other'

thm = lambda m: m[4][K['theorem']] + m[4][K['lemma']]
dfn = lambda m: m[4][K['def']] + m[4][K['abbrev']]
ch = [[idx[v] for v in m[3] if v in idx] for m in M]
main = idx['Main']

# Import closure of Main, a topological order, and each module's depth (longest import path from Main).
indeg = collections.Counter(v for u in range(len(M)) for v in ch[u])
topo, q, left = [], deque([main]), dict(indeg)
while q:
    u = q.popleft(); topo.append(u)
    for v in ch[u]:
        left[v] -= 1
        if left[v] == 0:
            q.append(v)
depth = {main: 0}
for u in topo:
    for v in ch[u]:
        depth[v] = max(depth.get(v, 0), depth[u] + 1)
height = {}
for u in reversed(topo):
    height[u] = 1 + max((height[v] for v in ch[u]), default=0)

# The longest import chain below Main: follow the child with the greatest height.
chain, u = [main], main
while ch[u]:
    u = max(ch[u], key=lambda v: (height[v], name(v)))
    chain.append(u)

os.makedirs(OUT, exist_ok=True)
def write(fname, obj):
    path = os.path.join(OUT, fname)
    json.dump(obj, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{fname:16s} {os.path.getsize(path) // 1024:6d} KB')

mathlib_imports = collections.Counter(im for m in M for im in m[3] if im.split('.')[0] == 'Mathlib')
src = lambda f: open(os.path.join(ROOT, 'src', f), encoding='utf-8').read()
write('summary.json', {
    'generated': datetime.date.today().isoformat(),
    'modules': len(M), 'lines': sum(m[1] for m in M), 'bytes': sum(m[2] for m in M),
    'kinds': {k: sum(m[4][i] for m in M) for i, k in enumerate(KINDS)},
    'theorems': sum(thm(m) for m in M), 'definitions': sum(dfn(m) for m in M),
    'importEdges': sum(len(c) for c in ch), 'closure': len(depth), 'longestChain': len(chain),
    'leafModules': sum(1 for c in ch if not c), 'folders': 0,
    'mathlibWhole': mathlib_imports.get('Mathlib', 0), 'mathlibDistinct': len(mathlib_imports),
    'mathlibTop': [[k, c] for k, c in mathlib_imports.most_common(9) if k != 'Mathlib'][:8],
    'hatches': {h: sum(m[5][i] for m in M) for i, h in enumerate(HATCHES)},
    'groups': GROUPS,
    'mainLean': src('Main.lean'), 'statementsLean': src('Statements.lean'),
})

# Folder tree: every folder with its module, line, theorem and definition totals.
root = {'n': 'src', 'f': 0, 'l': 0, 't': 0, 'd': 0, 'c': {}}
for m in M:
    node = root
    for part in m[0].split('.')[:-1]:
        for key, val in (('f', 1), ('l', m[1]), ('t', thm(m)), ('d', dfn(m))):
            node[key] += val
        node = node['c'].setdefault(part, {'n': part, 'f': 0, 'l': 0, 't': 0, 'd': 0, 'c': {}})
    for key, val in (('f', 1), ('l', m[1]), ('t', thm(m)), ('d', dfn(m))):
        node[key] += val
folders = 0
def freeze(node):
    global folders
    folders += 1
    kids = sorted(node['c'].values(), key=lambda c: -c['l'])
    node['c'] = [freeze(c) for c in kids]
    if not node['c']:
        del node['c']
    return node
write('tree.json', freeze(root))

# Library-to-library import counts (rows import columns), plus Mathlib.
libs = [l for l, _ in lines_by_lib.most_common()]
cols = libs + ['Mathlib']
mat = {(a, b): 0 for a in libs for b in cols}
for u in range(len(M)):
    for im in M[u][3]:
        b = lib(im) if im in idx else ('Mathlib' if im.split('.')[0] == 'Mathlib' else None)
        if b in cols:
            mat[(lib(name(u)), b)] += 1
write('matrix.json', {'rows': libs, 'cols': cols, 'values': [[mat[(a, b)] for b in cols] for a in libs]})

# Modules per depth below Main, split by library group.
prof = collections.defaultdict(lambda: dict.fromkeys(GROUPS, 0))
for u, d in depth.items():
    prof[d][group(name(u))] += 1
write('depth.json', {'groups': GROUPS, 'rows': [[d] + [prof[d][g] for g in GROUPS] for d in sorted(prof)]})

write('chain.json', [[name(u), group(name(u)), M[u][1], thm(M[u])] for u in chain])

fanin = collections.Counter(v for u in range(len(M)) for v in ch[u])
write('fanin.json', [[name(v), group(name(v)), c] for v, c in fanin.most_common(TOP_FANIN)])

# Explorer: full records for modules within EXPLORER_DEPTH of Main, stubs for their deeper imports.
inside = {u for u, d in depth.items() if d <= EXPLORER_DEPTH}
keep = inside | {v for u in inside for v in ch[u]}
explorer = {}
for u in keep:
    m = M[u]
    rec = {'g': group(m[0]), 'l': m[1], 't': thm(m), 'd': dfn(m), 'z': depth[u],
           'x': sum(1 for im in m[3] if im.split('.')[0] == 'Mathlib')}
    if u in inside:
        rec['i'] = [name(v) for v in ch[u]]
    else:
        rec['n'] = len(ch[u])
    explorer[m[0]] = rec
write('explorer.json', {'maxDepth': EXPLORER_DEPTH, 'modules': explorer})

summary = json.load(open(os.path.join(OUT, 'summary.json')))
summary['folders'] = folders - 1
write('summary.json', summary)
