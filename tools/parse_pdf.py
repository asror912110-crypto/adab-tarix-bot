"""Adab School tarix PDF'laridan savollarni ajratib olish.

Har mavzu uchun uchta PDF bor:
  *_1_Test_kitobcha.pdf    - testlar (A-D) va moslashtirish topshiriqlari
  *_2_Savollar_varagi.pdf  - ochiq savollar (savolnoma)
  *_3_Oqituvchi_kaliti.pdf - test kaliti (bo'yalgan doirachalar), moslashtirish
                             kaliti va savolnomaning qisqa javoblari
"""
import re
import pymupdf

WHITE = 0xFFFFFF
NAVY, GREEN, GRAY = 0x03174A, 0x11A833, 0x5B6478   # 2-shablon (6-sinf) ranglari


def spans(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                if s["text"] == "":
                    continue
                x0, y0, x1, y1 = s["bbox"]
                out.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "t": s["text"],
                            "c": s["color"], "sz": s["size"], "f": s["font"]})
    return out


def join(sp):
    """Spanlarni o'qish tartibida matnga yig'ish."""
    sp = sorted(sp, key=lambda s: (s["y0"], s["x0"]))
    lines = []
    for s in sp:
        if lines and abs(lines[-1][0]["y0"] - s["y0"]) < 4:
            lines[-1].append(s)
        else:
            lines.append([s])
    parts = []
    for ln in lines:
        ln.sort(key=lambda s: s["x0"])
        txt = ""
        prev = None
        for s in ln:
            if prev is not None and s["x0"] - prev["x1"] > 1.5 and not txt.endswith(" ") \
                    and not s["t"].startswith(" "):
                txt += " "
            txt += s["t"]
            prev = s
        parts.append(txt.strip())
    text = " ".join(p for p in parts if p)
    text = re.sub(r"\s+", " ", text).strip()
    # so'z bo'linishi: "ibodat- xona" kabi holatlar yo'q, lekin ortiqcha bo'shliqlarni tuzatamiz
    text = re.sub(r"\s+([,.;:?!»)])", r"\1", text)
    text = re.sub(r"([«(])\s+", r"\1", text)
    return text


def merged_tokens(sp, gap=1.2):
    """Bir qatordagi yopishgan spanlarni bitta tokenga birlashtirish (belgi/yorliqlarni topish uchun)."""
    sp = sorted(sp, key=lambda s: (s.get("p", 0), round(s["y0"]), s["x0"]))
    toks = []
    for s in sp:
        if toks:
            p = toks[-1]
            if p.get("p", 0) == s.get("p", 0) and abs(p["y0"] - s["y0"]) < 2 and -3 < s["x0"] - p["x1"] < gap \
                    and p["c"] == s["c"] \
                    and abs(p["sz"] - s["sz"]) < 0.3:
                p["t"] += s["t"]
                p["x1"] = s["x1"]
                p["parts"].append(s)
                continue
        t = dict(s)
        t["parts"] = [s]
        toks.append(t)
    return toks


def header_info(page):
    """Sahifa tepasidagi 'JAHON TARIXI · 8-SINF · 1-MAVZU' va mavzu nomi."""
    sp = [s for s in spans(page) if s["y0"] < 70]
    small = [s for s in sp if s["sz"] < 8 and s["x0"] < 340]
    big = [s for s in sp if s["sz"] > 10 and s["x0"] < 340]
    return join(small), join(big)


def parse_booklet(path, v2=False):
    doc = pymupdf.open(path)
    meta_line, title = header_info(doc[0])
    items = []   # barcha spanlar (sahifa, ustun, y) tartibida
    images = []
    boxes = []
    for pno, page in enumerate(doc):
        W = page.rect.width
        if v2:
            sp = [s for s in spans(page) if 38 < s["y0"] < page.rect.height - 40]
        else:
            sp = [s for s in spans(page) if 66 < s["y0"] < page.rect.height - 40 or pno > 0 and s["y0"] < page.rect.height - 40]
        for s in sp:
            s["p"] = pno
        items.append((pno, W, sp))
        for info in page.get_image_info(xrefs=True):
            bb = pymupdf.Rect(info["bbox"])
            if info.get("xref") and bb.width > 12 and not (pno == 0 and bb.y0 < 60):
                images.append({"p": pno, "bbox": bb, "xref": info["xref"]})
        for g in page.get_drawings():
            r = g["rect"]
            if g["type"] == "s" and 150 < r.width < 260 and r.height > 50:
                boxes.append({"p": pno, "r": r})
    # --- bo'lim sarlavhalari (Testlar / Savollar / Moslashtirish topshiriqlari)
    sec2 = tests_end = None
    for pno, W, sp in items:
        big = [s for s in sp if s["sz"] > 11.5 and s["x0"] < 200]
        txt = {}
        for s in big:
            txt.setdefault(round(s["y0"] / 3), []).append(s)
        for k, v in sorted(txt.items()):
            name = join(v).lower()
            pos = (pno, min(s["y0"] for s in v))
            if name.startswith("moslashtirish") and sec2 is None:
                sec2 = pos
            if (name.startswith("moslashtirish") or name == "savollar") and tests_end is None:
                tests_end = pos
    tests = parse_tests(items, images, doc, tests_end, v2)
    matches = parse_matches(items, boxes, sec2, images, v2)
    return {"meta": meta_line, "title": title, "tests": tests, "matches": matches}


def parse_tests(items, images, doc, sec2, v2=False):
    seq = []
    for pno, W, sp in items:
        mid = W / 2
        for s in sp:
            if sec2 and (pno > sec2[0] or (pno == sec2[0] and s["y0"] >= sec2[1] - 2)):
                continue
            col = 0 if s["x0"] < mid - 4 else 1
            s["col"] = col
            s["cx"] = s["x0"] - (0 if col == 0 else mid - 34 + 5.5)
            seq.append(s)
    seq.sort(key=lambda s: (s["p"], s["col"], round(s["y0"]), s["x0"]))
    # savol raqami: oq rangli kichik raqam (nishon)
    if v2:
        badges = merged_tokens([s for s in seq if s["c"] == NAVY and 7.7 < s["sz"] < 8.3
                                and re.fullmatch(r"\d{1,2}", s["t"].strip())], gap=1.5)
    else:
        badges = merged_tokens([s for s in seq if s["c"] == WHITE and s["sz"] < 8.5], gap=1.5)
    qs = []
    badge_ids = set()
    for t in badges:
        if re.fullmatch(r"\d{1,2}", t["t"].strip()):
            qs.append({"num": t["t"].strip(), "sp": [], "p": t["p"], "col": t["col"], "y": t["y0"]})
            badge_ids |= {id(x) for x in t["parts"]}
    qs.sort(key=lambda q: (q["p"], q["col"], q["y"]))
    # birinchi sahifada eng birinchi savoldan yuqoridagi matn — sahifa sarlavhasi (F.I.Sh., Guruh, Sana...)
    top0 = min((q["y"] for q in qs if q["p"] == 0), default=0) - 6
    for s in seq:
        if s["c"] == WHITE or id(s) in badge_ids or (s["p"] == 0 and s["y0"] < top0):
            continue
        c = [q for q in qs if (q["p"], q["col"], q["y"] - 5) <= (s["p"], s["col"], s["y0"])]
        if c:
            c[-1]["sp"].append(s)
    out = []
    for i, q in enumerate(qs):
        sp = q["sp"]
        labels = []
        toks = merged_tokens(sp if v2 else [s for s in sp if s["c"] == 0])
        for t in toks:
            m = re.fullmatch(r"([A-D])\)", t["t"].strip())
            if m:
                labels.append({"L": m.group(1), "x0": t["x0"], "y0": t["y0"], "p": t["p"], "col": t["col"],
                               "ids": {id(x) for x in t["parts"]}})
        lab_ids = set().union(*[l["ids"] for l in labels]) if labels else set()
        first = min(labels, key=lambda l: (l["p"], l["col"], l["y0"])) if labels else None
        stem, opts = [], {l["L"]: [] for l in labels}
        for s in sp:
            if id(s) in lab_ids:
                continue
            key = (s["p"], s["col"], s["y0"])
            if first is None or key < (first["p"], first["col"], first["y0"] - 3):
                stem.append(s)
                continue
            cands = [l for l in labels if l["p"] == s["p"] and l["col"] == s["col"]
                     and l["y0"] <= s["y0"] + 3 and l["x0"] <= s["x0"] + 2]
            if not cands:
                cands = [l for l in labels if (l["p"], l["col"]) < (s["p"], s["col"])]
                if not cands:
                    stem.append(s)
                    continue
                best = max(cands, key=lambda l: (l["p"], l["col"], l["y0"], l["x0"]))
            else:
                mx = max(l["x0"] for l in cands)
                best = max([l for l in cands if mx - l["x0"] < 20], key=lambda l: l["y0"])
            opts[best["L"]].append(s)
        # rasm
        img = None
        nxt = qs[i + 1] if i + 1 < len(qs) else None
        for im in images:
            b = im["bbox"]
            if sec2 and (im["p"] > sec2[0] or (im["p"] == sec2[0] and b.y0 >= sec2[1])):
                continue
            col = 0 if b.x0 < 294 else 1
            if im["p"] == q["p"] and col == q["col"] and b.y0 > q["y"]:
                if nxt and nxt["p"] == q["p"] and nxt["col"] == q["col"] and b.y0 > nxt["y"]:
                    continue
                img = im
        item = {"n": int(q["num"]), "q": join(stem),
                "opts": {k: join(v) for k, v in sorted(opts.items())}}
        if img:
            item["img_xref"] = img["xref"]
            item["img_page"] = img["p"]
        out.append(item)
    return out


def parse_matches(items, boxes, sec2, images=(), v2=False):
    out = []
    for bx in boxes:
        pno, r = bx["p"], bx["r"]
        sp = [s for s in items[pno][2] if r.x0 - 1 <= s["x0"] <= r.x1 + 1 and r.y0 - 1 <= s["y0"] <= r.y1 + 1]
        if not sp:
            continue
        if v2:
            badge = [s for s in sp if s["c"] == NAVY and 7.7 < s["sz"] < 8.3 and s["y0"] < r.y0 + 14
                     and s["x0"] < r.x0 + 18 and s["t"].strip().isdigit()]
        else:
            badge = [s for s in sp if s["c"] == WHITE]
        if not badge:
            continue
        num = "".join(s["t"] for s in sorted(badge, key=lambda s: s["x0"])).strip()
        if not num.isdigit():
            continue
        by = min(s["y0"] for s in badge)
        rest = [s for s in sp if s["c"] != WHITE]
        if v2:
            bid = {id(x) for x in badge}
            rest = [s for s in rest if s["c"] != GRAY and id(s) not in bid]
        # sarlavha: nishon bilan bir qatorda boshlanib, jadval sarlavhasigacha
        toks = merged_tokens(rest)
        left_lab, right_lab = [], []
        for t in toks:
            tt = t["t"].strip()
            if re.fullmatch(r"\d", tt) and t["x0"] - r.x0 < 22 and t["y0"] > by + 8:
                left_lab.append(t)
            elif re.fullmatch(r"[a-h]", tt) and t["x1"] - r.x0 > 28 and t["y0"] > by + 8:
                right_lab.append(t)
        # o'ng yorliqlar ustuni: bir xil x da turadi, tartib a,b,c...
        if right_lab:
            best = None
            for ref in right_lab:
                col = sorted([t for t in right_lab if abs(t["x1"] - ref["x1"]) < 7], key=lambda t: t["y0"])
                letters = "".join(t["t"].strip() for t in col)
                if "abcdefgh".startswith(letters) and len(letters) >= 2:
                    if best is None or len(col) > len(best):
                        best = col
            right_lab = best or []
        if left_lab:
            lx = min(t["x0"] for t in left_lab)
            col = sorted([t for t in left_lab if t["x0"] - lx < 5], key=lambda t: t["y0"])
            seq = []
            for t in col:
                if int(t["t"].strip()) == len(seq) + 1:
                    seq.append(t)
            left_lab = seq
        if not left_lab or not right_lab:
            out.append({"n": int(num), "error": "labels"})
            continue
        table_top = min(left_lab[0]["y0"], right_lab[0]["y0"])
        rx = min(t["x1"] for t in right_lab) - 7
        lab_ids = set()
        for t in left_lab + right_lab:
            lab_ids |= {id(x) for x in t["parts"]}
        head = [s for s in rest if s["y0"] < table_top - 3]
        # sarlavha (topshiriq matni) va ustun nomlari
        hl = sorted(head, key=lambda s: s["y0"])
        lines = []
        for s in hl:
            if lines and abs(lines[-1][0]["y0"] - s["y0"]) < 4:
                lines[-1].append(s)
            else:
                lines.append([s])
        # oxirgi qator(lar) - ustun sarlavhalari (kichikroq shrift yoki jadval ichida)
        col_head = lines[-1] if len(lines) > 1 else []
        title = [s for ln in lines[:-1] for s in ln] if len(lines) > 1 else head
        # ustun sarlavhasi ikki qatorli bo'lishi mumkin
        while len(lines) > 2 and lines[-2][0]["sz"] == lines[-1][0]["sz"] and \
                lines[-2][0]["sz"] < lines[0][0]["sz"] - 0.2:
            col_head = lines[-2] + col_head
            title = [s for ln in lines[:-2] for s in ln]
            lines = lines[:-2] + [col_head]
        if v2:
            wh = [s for s in sp if s["c"] == WHITE]
            col_head, title = wh, head
        lh = join([s for s in col_head if s["x0"] < rx - 2])
        rh = join([s for s in col_head if s["x0"] >= rx - 2])
        left = {int(t["t"].strip()): [] for t in left_lab}
        right = {t["t"].strip(): [] for t in right_lab}
        for s in rest:
            if id(s) in lab_ids or s["y0"] < table_top - 3:
                continue
            if s["x0"] < rx - 2:
                c = [t for t in left_lab if t["y0"] <= s["y0"] + 3]
                if c:
                    left[int(c[-1]["t"].strip())].append(s)
            else:
                c = [t for t in right_lab if t["y0"] <= s["y0"] + 3]
                if c:
                    right[c[-1]["t"].strip()].append(s)
        limg, rimg = {}, {}
        for im in images:
            bb = im["bbox"]
            cy = (bb.y0 + bb.y1) / 2
            if im["p"] != pno or not (r.x0 <= bb.x0 <= r.x1 and r.y0 <= cy <= r.y1):
                continue
            if bb.x0 < rx - 2:
                c = [t for t in left_lab if t["y0"] <= cy + 3]
                if c:
                    limg[int(c[-1]["t"].strip())] = im["xref"]
            else:
                c = [t for t in right_lab if t["y0"] <= cy + 3]
                if c:
                    rimg[c[-1]["t"].strip()] = im["xref"]
        out.append({"n": int(num), "title": join(title), "lh": lh, "rh": rh, "p": pno,
                    "left": [join(left[k]) for k in sorted(left)],
                    "right": {k: join(v) for k, v in sorted(right.items())},
                    "limg": limg, "rimg": rimg})
    out.sort(key=lambda m: m["n"])
    return out


def parse_key(path):
    doc = pymupdf.open(path)
    tests, matches, answers = {}, {}, []
    for page in doc:
        sp = spans(page)
        toks = merged_tokens(sp, gap=0.8)
        # shablon ramkasi ichidagi qism va uning ostidagi "qisqa javoblar"
        short_y = None
        for t in merged_tokens([s for s in sp if s["sz"] > 9.5], gap=6):
            if "qisqa javob" in t["t"].lower():
                short_y = t["y0"]
        frame_bottom = short_y if short_y else page.rect.height
        nums = [t for t in toks if re.fullmatch(r"\d{1,2}", t["t"].strip()) and t["c"] != WHITE
                and t["y0"] < frame_bottom]
        # --- test kaliti: oq harf = bo'yalgan doiracha
        for t in toks:
            tt = t["t"].strip()
            if t["c"] == WHITE and tt in "ABCD" and len(tt) == 1 and t["y0"] < frame_bottom:
                c = [n for n in nums if abs((n["y0"] + n["y1"]) / 2 - (t["y0"] + t["y1"]) / 2) < 5
                     and 0 < t["x0"] - n["x1"] < 95]
                if c:
                    n = max(c, key=lambda n: n["x1"])
                    tests[int(n["t"].strip())] = tt
        # --- moslashtirish kaliti: kichik harflar katakchalarda
        low = [t for t in toks if re.fullmatch(r"[a-h]", t["t"].strip()) and t["y0"] < frame_bottom
               and t["c"] != WHITE]
        if low:
            minx = min(t["x0"] for t in low)
            rows = {}
            for t in low:
                c = [n for n in nums if abs((n["y0"] + n["y1"]) / 2 - (t["y0"] + t["y1"]) / 2) < 6
                     and 0 < t["x0"] - n["x1"] < 110 and n["x0"] > minx - 40]
                if c:
                    n = max(c, key=lambda n: n["x1"])
                    rows.setdefault(int(n["t"].strip()), []).append(t)
            for k, v in rows.items():
                matches[k] = [t["t"].strip() for t in sorted(v, key=lambda t: t["x0"])]
        # --- savolnoma qisqa javoblari
        if short_y:
            answers = parse_numbered_stream(page)
    return {"tests": tests, "matches": matches, "answers": answers}


JUNK = re.compile(r"^(Adab School ■|© 20|\d+ / \d+$|.*·\s*[\d\-]+-mavzu$)")


def numbered_from_text(text):
    """'1. ...', '2. ...' ko'rinishidagi ketma-ket raqamlangan ro'yxatni matndan ajratish."""
    text = "\n".join(l for l in text.split("\n") if not JUNK.match(l.strip()))
    pos, cuts = 0, []
    n = 1
    while True:
        m = re.compile(rf"(?m)^\s*{n}\.\s").search(text, pos)
        if not m:
            break
        cuts.append((m.start(), m.end()))
        pos = m.end()
        n += 1
    out = []
    for k, (a, b) in enumerate(cuts):
        end = cuts[k + 1][0] if k + 1 < len(cuts) else len(text)
        chunk = text[b:end]
        if k + 1 == len(cuts):
            chunk = re.split(r"\n\s*(?:©|O‘QITUVCHI UCHUN|F\.I\.Sh|Mualliflik huquqi|Asos:)", chunk)[0]
        lines = [l.strip() for l in chunk.split("\n") if l.strip()]
        t = ""
        for l in lines:
            if t.endswith("-") and re.match(r"[a-z‘’']", l):
                t += l
            else:
                t += (" " if t else "") + l
        out.append(re.sub(r"\s+", " ", t).strip())
    return out


def parse_numbered_stream(page):
    """Raqamlangan ro'yxatni PDF oqimidagi tartibda o'qish (ustunlar ustma-ust tushsa ham to'g'ri ishlaydi)."""
    text = page.get_text("text")
    i = text.lower().find("qisqa javob")
    return numbered_from_text(text[i:] if i >= 0 else text)


def parse_v2(path):
    """2-shablon: bitta PDF ichida testlar, savollar, moslashtirish va oxirida javoblar kaliti."""
    doc = pymupdf.open(path)
    b = parse_booklet(path, v2=True)
    p0 = [s for s in spans(doc[0]) if s["y0"] < 70]
    b["title"] = join([s for s in p0 if s["sz"] > 11 and s["c"] == NAVY])
    texts = [pg.get_text("text") for pg in doc]
    kp = next((i for i, t in enumerate(texts) if "Javoblar kaliti" in t), len(doc) - 1)
    body = "\n".join(texts[:kp])
    m = re.search(r"(?m)^Savollar\s*$", body)
    oq = []
    if m:
        chunk = body[m.end():]
        e = chunk.find("Moslashtirish topshiriqlari")
        oq = numbered_from_text(chunk[:e] if e >= 0 else chunk)
        if oq:
            oq[-1] = re.sub(r"\s+III$", "", oq[-1])   # keyingi bo'lim nishoni
    # --- kalit
    tests, matches = {}, {}
    for pg in doc[kp:]:
        toks = merged_tokens(spans(pg), gap=0.8)
        nums = [t for t in toks if t["c"] == GRAY and re.fullmatch(r"\d{1,2}", t["t"].strip())]
        for t in toks:
            tt = t["t"].strip()
            if t["c"] == GREEN and len(tt) == 1 and tt in "ABCD":
                c = [n for n in nums if abs(n["y0"] - t["y0"]) < 5 and -2 < t["x0"] - n["x0"] < 16]
                if c:
                    tests[int(max(c, key=lambda n: n["x0"])["t"].strip())] = tt
    ktext = "\n".join(texts[kp:])
    i, j = ktext.find("III."), ktext.find("II. Savol")
    if i >= 0:
        seg = ktext[i:j] if j > i else ktext[i:]
        cur = None
        for num, a, bb in re.findall(r"(\d+)\s*[–\-]\s*([a-h])|(\d+)", seg.split("\n", 1)[-1]):
            if bb:
                cur = int(bb)
                matches[cur] = []
            elif cur is not None:
                matches[cur].append(a)
    answers = numbered_from_text(ktext[j:]) if j >= 0 else []
    return b, {"tests": tests, "matches": matches, "answers": answers}, oq


def parse_numbered(body, W):
    """Ikki ustunli raqamlangan ro'yxat: '21. matn ...' (davomi keyingi qatorda)."""
    c = [s["x0"] for s in body if re.match(r"\d", s["t"]) and W * 0.42 < s["x0"] < W * 0.56]
    split = (min(c) - 0.5) if c else W / 2 - 4
    cols = {0: [], 1: []}
    for s in body:
        cols[0 if s["x0"] < split else 1].append(s)
    res = []
    for c in (0, 1):
        sp = sorted(cols[c], key=lambda s: (s["y0"], s["x0"]))
        lines = []
        for s in sp:
            if lines and abs(lines[-1][0]["y0"] - s["y0"]) < 4:
                lines[-1].append(s)
            else:
                lines.append([s])
        for ln in lines:
            txt = join(ln)
            m = re.match(r"^(\d{1,2})\.\s*(.*)$", txt)
            if m and int(m.group(1)) == len(res) + 1:
                res.append(m.group(2))
            elif res:
                res[-1] = (res[-1] + " " + txt).strip()
    return res


def parse_questions(path):
    """Savollar varag'i: har bir ochiq savol alohida xatboshi (ostida yozish uchun chiziqlar)."""
    doc = pymupdf.open(path)
    out = []
    for pno, page in enumerate(doc):
        sp = [s for s in spans(page) if s["y0"] < page.rect.height - 40 and s["y0"] > (74 if pno == 0 else 20)
              and 7.9 < s["sz"] < 9 and s["c"] != WHITE]
        sp.sort(key=lambda s: (s["y0"], s["x0"]))
        groups = []
        for s in sp:
            if groups and s["y0"] - groups[-1][-1]["y0"] < 14:
                groups[-1].append(s)
            else:
                groups.append([s])
        out += [join(g) for g in groups]
    return [q for q in out if q]


if __name__ == "__main__":
    import sys, json
    kind, path = sys.argv[1], sys.argv[2]
    r = {"b": parse_booklet, "k": parse_key}[kind](path)
    print(json.dumps(r, ensure_ascii=False, indent=1))
