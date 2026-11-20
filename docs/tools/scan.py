"""Scan the Lean sources under src/ and write per-module records to a compact JSON cache.

Usage: python3 docs/tools/scan.py   (from the repository root)
"""
import json, os, re, sys
from multiprocessing import Pool

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'src')
IMPORT = re.compile(r'^\s*(?:public\s+|private\s+)?(?:meta\s+)?import\s+(?:all\s+)?(\S+)')
DECL = re.compile(r'^\s*(?:@\[[^\]]*\]\s*)?(?:(?:private|protected|noncomputable|nonrec|partial|unsafe)\s+)*'
                  r'(theorem|lemma|def|abbrev|instance|structure|class|inductive)\b')
KINDS = ['theorem', 'lemma', 'def', 'abbrev', 'instance', 'structure', 'class', 'inductive']
# Keywords that would weaken or bypass a kernel-checked proof; counted as whole words, comments included.
HATCHES = {'sorry': r'\bsorry\b', 'admit': r'\badmit\b', 'axiom': r'^\s*(?:private\s+|protected\s+)?axiom\b',
           'native_decide': r'\bnative_decide\b', 'implemented_by': r'\bimplemented_by\b', 'extern': r'@\[\s*extern\b',
           'unsafe': r'\bunsafe\b', 'skipKernelTC': r'skipKernelTC'}
HATCH_RE = {k: re.compile(v) for k, v in HATCHES.items()}

def scan(path):
    rel = os.path.relpath(path, SRC)
    mod = rel[:-5].replace(os.sep, '.')
    imports, counts, lines, nbytes = [], dict.fromkeys(KINDS, 0), 0, os.path.getsize(path)
    hatches = dict.fromkeys(HATCHES, 0)
    in_header = True
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            lines += 1
            if in_header:
                m = IMPORT.match(line)
                if m:
                    imports.append(m.group(1)); continue
                s = line.strip()
                if s and not s.startswith('--') and not s.startswith('/-') and not s.startswith('module') and not s.startswith('prelude'):
                    in_header = False
            m = DECL.match(line)
            if m:
                counts[m.group(1)] += 1
            for k, r in HATCH_RE.items():
                if r.search(line):
                    hatches[k] += 1
    return mod, lines, nbytes, imports, [counts[k] for k in KINDS], [hatches[k] for k in HATCHES]

if __name__ == '__main__':
    paths = [os.path.join(d, f) for d, _, fs in os.walk(SRC) for f in fs if f.endswith('.lean')]
    with Pool() as p:
        recs = p.map(scan, paths, chunksize=500)
    recs.sort()
    out = os.path.join(os.path.dirname(__file__), 'modules.json')
    json.dump({'kinds': KINDS, 'hatches': list(HATCHES), 'modules': recs}, open(out, 'w'), separators=(',', ':'))
    print(len(recs), 'modules ->', out, os.path.getsize(out) // 1024, 'KB')
