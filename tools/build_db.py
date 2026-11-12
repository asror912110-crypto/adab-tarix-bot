"""data/raw ichidagi barcha PDF'lardan content/topics.json va content/media/ ni yig'adi."""
import os, re, sys, json, glob, hashlib, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(__file__))
import parse_pdf as P
import pymupdf

RAW = sys.argv[1] if len(sys.argv) > 1 else "/home/user/data/raw"
OUT = os.path.join(os.path.dirname(__file__), "..", "content")
os.makedirs(os.path.join(OUT, "media"), exist_ok=True)
topics, report = [], []

def save_img(doc, xref):
    pix = pymupdf.Pixmap(doc, xref)
    if pix.n - pix.alpha >= 4: pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    if pix.alpha: pix = pymupdf.Pixmap(pix, 0)
    data = pix.tobytes("jpeg", jpg_quality=82)
    fn = hashlib.md5(data).hexdigest()[:16] + ".jpg"
    open(os.path.join(OUT, "media", fn), "wb").write(data)
    return fn

def subj_of(name):
    n = name.lower()
    g = re.search(r"(\d+)-sinf", n)
    grade = int(g.group(1)) if g else 0
    if "jahon" in n: return "jahon", grade
    if "ozbekiston" in n: return "uzb", grade
    return "tarix", grade

for cdir in sorted(glob.glob(os.path.join(RAW, "*"))):
    for root, dirs, files in os.walk(cdir):
        subj, grade = subj_of(os.path.relpath(root, RAW))
        jobs = [("v1", f) for f in files if f.endswith("_1_Test_kitobcha.pdf")]
        jobs += [("v2", f) for f in sorted(files) if re.search(r"_([\d\-]+)-mavzu\.pdf$", f)]
        for ver, fname in jobs:
          if ver == "v1":
            num = re.match(r"([\d\-]+)-mavzu", fname).group(1)
            base = os.path.join(root, fname[:-len("_1_Test_kitobcha.pdf")])
            src = base + "_1_Test_kitobcha.pdf"
          else:
            num = re.search(r"_([\d\-]+)-mavzu\.pdf$", fname).group(1)
            src = os.path.join(root, fname)
          tid = f"{subj}{grade}-{num}"
          errs = []
          try:
            if ver == "v1":
                b = P.parse_booklet(src)
                k = P.parse_key(base + "_3_Oqituvchi_kaliti.pdf")
                oq = P.parse_questions(base + "_2_Savollar_varagi.pdf")
            else:
                b, k, oq = P.parse_v2(src)
          except Exception as e:
            report.append((tid, [f"EXC {e!r}"])); continue
          doc = pymupdf.open(src)
          if True:
            tests = []
            for t in b["tests"]:
                ans = k["tests"].get(t["n"])
                if not t["q"] or sorted(t["opts"]) != list("ABCD") or not all(t["opts"].values()) or not ans:
                    errs.append(f"T{t['n']}"); continue
                item = {"n": t["n"], "q": t["q"], "o": [t["opts"][x] for x in "ABCD"], "a": "ABCD".index(ans)}
                if "img_xref" in t:
                    item["img"] = save_img(doc, t["img_xref"])
                elif re.search(r"ushbu|rasmda|xaritada|suratda|tasvirda", t["q"], re.I) and re.search(r"rasm|portret|xarita|surat|tasvir|haykal|yodgorlik", t["q"], re.I):
                    errs.append(f"T{t['n']}:noimg")
                tests.append(item)
            if len(b["tests"]) != len(k["tests"]): errs.append(f"tests {len(b['tests'])}!={len(k['tests'])}key")
            matches = []
            for m in b["matches"]:
                key = k["matches"].get(m["n"])
                if "error" in m or not key or len(key) != len(m["left"]) \
                        or not all(t or (i + 1) in m["limg"] for i, t in enumerate(m["left"])) \
                        or not all(v or x in m["rimg"] for x, v in m["right"].items()) \
                        or any(x not in m["right"] for x in key) or len(set(key)) != len(key):
                    errs.append(f"M{m['n']}:{m.get('error','')}"); continue
                letters = sorted(m["right"])
                item = {"n": m["n"], "t": m["title"], "lh": m["lh"], "rh": m["rh"], "l": m["left"],
                        "r": [m["right"][x] for x in letters], "a": [letters.index(x) for x in key]}
                if m["limg"]:
                    item["li"] = [save_img(doc, m["limg"][i + 1]) if (i + 1) in m["limg"] else None for i in range(len(m["left"]))]
                if m["rimg"]:
                    item["ri"] = [save_img(doc, m["rimg"][x]) if x in m["rimg"] else None for x in letters]
                matches.append(item)
            if len(b["matches"]) != len(k["matches"]): errs.append(f"match {len(b['matches'])}!={len(k['matches'])}key")
            cards = []
            if len(oq) != len(k["answers"]): errs.append(f"open {len(oq)}!={len(k['answers'])}ans")
            else:
                for i, (q, a) in enumerate(zip(oq, k["answers"])):
                    if a.strip().lower().strip("().") in ("erkin javob", ""): continue
                    cards.append({"n": i + 1, "q": q, "a": a})
            topics.append({"id": tid, "subj": subj, "grade": grade, "num": num, "title": b["title"],
                           "tests": tests, "matches": matches, "cards": cards})
            if errs: report.append((tid, errs))

def skey(t):
    return (t["grade"], t["subj"], [int(x) for x in t["num"].split("-")])
topics.sort(key=skey)
json.dump(topics, open(os.path.join(OUT, "topics.json"), "w"), ensure_ascii=False)
print("topics", len(topics), "tests", sum(len(t["tests"]) for t in topics), "matches", sum(len(t["matches"]) for t in topics),
      "cards", sum(len(t["cards"]) for t in topics), "imgs", len(os.listdir(os.path.join(OUT, "media"))))
print("topics with problems:", len(report))
json.dump(report, open(os.path.join(OUT, "..", "build_report.json"), "w"), ensure_ascii=False)
for tid, e in report[:25]: print(tid, " ".join(e)[:150])
