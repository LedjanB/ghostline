"""Turn a Claude Docs export (the <doc ...> XML that the Claude Docs `read` of a tab returns) into Markdown.
Usage: python scripts/doc-to-md.py <saved-read-output> <out.md> "<title>" "<doc url>"
The input may be the raw read result (JSON or text); the <doc ...>...</doc> part is found inside it."""
import json, re, sys
import xml.etree.ElementTree as ET

def find_doc(raw):
    try:
        data = json.loads(raw)
        stack = [data]
        while stack:
            o = stack.pop()
            if isinstance(o, str) and '<doc' in o: return o
            if isinstance(o, dict): stack += list(o.values())
            if isinstance(o, list): stack += o
    except ValueError:
        pass
    m = re.search(r"<doc[\s\S]*</doc>", raw)
    return m.group(0) if m else raw

def inline(el):
    out = ''
    for t in el.iter():
        if t.tag == 'text':
            s = ''.join(t.itertext())
            for tag, mark in (('bold', '**'), ('italic', '*'), ('code', '`')):
                b = t.find(tag)
                if b is not None:
                    inner = ''.join(b.itertext())
                    if inner.strip(): s = s.replace(inner, mark + inner + mark, 1)
            out += s
        elif t.tag == 'date': out += t.get('value', '')
        elif t.tag == 'mention': out += t.get('name', '')
    return out

def convert(xml):
    root = ET.fromstring(xml)
    lines = []
    def lst(el, depth):
        num = el.get('kind') == 'ordered'
        for i, li in enumerate(el, 1):
            first = True
            for sub in li:
                if sub.tag == 'paragraph':
                    lead = (f'{i}. ' if num else '- ') if first else '  '
                    lines.append('  ' * depth + lead + inline(sub)); first = False
                elif sub.tag == 'list': lst(sub, depth + 1)
                elif sub.tag == 'table': table(sub)
        lines.append('')
    def table(el):
        rows = [[' '.join(inline(p) for p in cell.iter('paragraph')).replace('|', '/') for cell in r] for r in el.iter('row')]
        if not rows: return
        lines.append('')
        lines.append('| ' + ' | '.join(rows[0]) + ' |'); lines.append('|' + '---|' * len(rows[0]))
        for r in rows[1:]: lines.append('| ' + ' | '.join(r) + ' |')
        lines.append('')
    def walk(el):
        for c in el:
            if c.tag == 'paragraph':
                h = c.get('heading')
                if h: lines.extend(['', '#' * int(h) + ' ' + inline(c), ''])
                else: lines.append(inline(c))
            elif c.tag == 'list': lst(c, 0)
            elif c.tag == 'table': table(c)
            elif c.tag == 'embed': lines.extend(['', f"[Diagram in the doc: {c.get('caption', '')}] (read node {c.get('ref', '')} with the Claude Docs connector)", ''])
            elif c.tag in ('code', 'codeBlock'): lines.extend(['```', ''.join(c.itertext()), '```'])
            else:
                if c.tag not in ('doc',) and not list(c) and (c.text or '').strip(): lines.append(c.text.strip())
                walk(c)
    walk(root)
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip() + '\n'

if __name__ == '__main__':
    src, out, title, url = sys.argv[1:5]
    md = convert(find_doc(open(src, encoding='utf-8').read()))
    head = f'<!-- Full copy of the Claude Doc "{title}" ({url}). Re-export with scripts/doc-to-md.py if the doc changes. -->\n\n'
    open(out, 'w', encoding='utf-8').write(head + md)
    print(out, len(md), 'chars')
