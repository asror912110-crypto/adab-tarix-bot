"""Adab School — Tarix bot: API + Telegram bot + Mini App."""
import datetime as dt
import hashlib
import hmac
import json
import os
import random
import re
import secrets
import threading
import time
import urllib.parse

import httpx
import segno
import sqlalchemy as sa
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .db import (answers, badges, daily_sets, duels, engine, groups, homework, kv, members, mistakes, progress,
                 questions, reports, sessions, topics, users, whitelist, xp_log)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").rstrip("/")
ADMIN_IDS = {int(x) for x in os.environ.get("ADMIN_IDS", "").replace(" ", "").split(",") if x}
DEV_AUTH = os.environ.get("DEV_AUTH") == "1"
SECRET = hashlib.sha256(("hook:" + BOT_TOKEN).encode()).hexdigest()[:32]
FREE_LIMIT = int(os.environ.get("FREE_LIMIT", "20"))
REMIND_HOUR = int(os.environ.get("REMIND_HOUR", "18"))
TZ = dt.timezone(dt.timedelta(hours=5))  # Asia/Tashkent
BOT_NAME = {"v": os.environ.get("BOT_USERNAME", "")}

LEVELS = [(0, "Shogird"), (300, "Tolib"), (1000, "Mirzo"), (2500, "Bek"), (5000, "Amir"),
          (10000, "Vazir"), (20000, "Sohibqiron")]
BADGES = {
    "first": ("Ilk qadam", "Birinchi mashqni yakunladi"),
    "streak3": ("3 kun ketma-ket", "3 kun uzluksiz kunlik topshiriq"),
    "streak7": ("Bir hafta", "7 kun uzluksiz kunlik topshiriq"),
    "streak30": ("Bir oy", "30 kun uzluksiz kunlik topshiriq"),
    "perfect": ("Besh baho", "Imtihonni 100% natija bilan topshirdi"),
    "c100": ("Yuzlik", "100 ta to'g'ri javob"),
    "c500": ("Besh yuzlik", "500 ta to'g'ri javob"),
    "c2000": ("Bilimdon", "2000 ta to'g'ri javob"),
    "duel1": ("Pahlavon", "Birinchi bellashuv g'alabasi"),
    "duel10": ("Bahodir", "10 ta bellashuv g'alabasi"),
    "clean": ("Xatosiz", "Barcha xatolarini tuzatdi"),
}
PTS = {"test": 10, "pair": 5, "card": 2, "daily": 30, "duel": 50}
BOX_DAYS = [1, 3, 7]
EXAM_SEC, DUEL_SEC = 40, 30            # imtihon va bellashuvda bir savolga beriladigan vaqt
PER_Q = {"test": 40, "match": 90}      # kunlik topshiriqda har bir savol uchun taymer

app = FastAPI(title="Adab School Tarix")


def now():
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)


def today(delta=0):
    return (dt.datetime.now(TZ) + dt.timedelta(days=delta)).strftime("%Y-%m-%d")


def norm_phone(p):
    d = re.sub(r"\D", "", p or "")
    return d[-9:] if len(d) >= 9 else ""


def level(xp):
    i = max(k for k, (need, _) in enumerate(LEVELS) if xp >= need)
    nxt = LEVELS[i + 1][0] if i + 1 < len(LEVELS) else None
    return {"idx": i + 1, "name": LEVELS[i][1], "from": LEVELS[i][0], "next": nxt}


# ------------------------------------------------------------------ auth
def check_init_data(init_data):
    try:
        pairs = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        h = pairs.pop("hash")
        dcs = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(hmac.new(key, dcs.encode(), hashlib.sha256).hexdigest(), h):
            return None
        if time.time() - int(pairs.get("auth_date", "0")) > 86400 * 2:
            return None
        return json.loads(pairs["user"])
    except Exception:
        return None


def ensure_user(c, tg):
    u = c.execute(sa.select(users).where(users.c.id == tg["id"])).mappings().first()
    name = (tg.get("first_name", "") + " " + tg.get("last_name", "")).strip()[:120] or "O'quvchi"
    if not u:
        role = "admin" if tg["id"] in ADMIN_IDS else "user"
        c.execute(users.insert().values(id=tg["id"], name=name, username=tg.get("username"), role=role, xp=0,
                                        streak=0, best_streak=0, remind=True, created=now()))
        u = c.execute(sa.select(users).where(users.c.id == tg["id"])).mappings().first()
    elif tg["id"] in ADMIN_IDS and u["role"] != "admin":
        c.execute(users.update().where(users.c.id == tg["id"]).values(role="admin"))
        u = c.execute(sa.select(users).where(users.c.id == tg["id"])).mappings().first()
    return dict(u)


def auth(x_init_data: str = Header(default="")):
    tg = None
    if DEV_AUTH and x_init_data.startswith("dev:"):
        tg = {"id": int(x_init_data[4:]), "first_name": "Test" + x_init_data[4:]}
    elif x_init_data:
        tg = check_init_data(x_init_data)
    if not tg:
        raise HTTPException(401, "Telegram orqali kiring")
    with engine.begin() as c:
        return ensure_user(c, tg)


def need(*roles):
    def dep(u=Depends(auth)):
        if u["role"] not in roles:
            raise HTTPException(403, "Ruxsat yo'q")
        return u
    return dep


teacher = need("teacher", "admin")
admin = need("admin")


# ------------------------------------------------------------------ helpers
def add_xp(c, uid, pts, why):
    if pts:
        c.execute(users.update().where(users.c.id == uid).values(xp=users.c.xp + pts))
        c.execute(xp_log.insert().values(user_id=uid, pts=pts, day=today(), why=why))


def used_today(c, uid):
    return c.execute(sa.select(sa.func.count()).select_from(answers)
                     .where(answers.c.user_id == uid, answers.c.day == today())).scalar()


def pub(q, with_answer=False):
    d = dict(q["data"])
    out = {"id": q["id"], "kind": q["kind"], "topic": q["topic_id"]}
    if q["kind"] == "test":
        out.update(q=d["q"], o=d["o"], img=d.get("img"))
        if with_answer:
            out["right"] = d["a"]
    elif q["kind"] == "match":
        out.update(t=d["t"], lh=d.get("lh", ""), rh=d.get("rh", ""), l=d["l"], r=d["r"], li=d.get("li"), ri=d.get("ri"))
        if with_answer:
            out["right"] = d["a"]
    else:
        out.update(q=d["q"], a=d["a"])
    return out


def pick(c, kind, topic_ids, n, exclude=()):
    if not topic_ids or n <= 0:
        return []
    ids = [r[0] for r in c.execute(sa.select(questions.c.id).where(
        questions.c.kind == kind, questions.c.active == sa.true(), questions.c.topic_id.in_(topic_ids)))]
    ids = [i for i in ids if i not in set(exclude)]
    return random.sample(ids, min(n, len(ids)))


def grade_topics(c, grade, subj=None):
    q = sa.select(topics.c.id)
    if grade:
        q = q.where(topics.c.grade == grade)
    if subj:
        q = q.where(topics.c.subj == subj)
    ids = [r[0] for r in c.execute(q)]
    return ids or [r[0] for r in c.execute(sa.select(topics.c.id))]


def covered_topics(c, last_ids):
    """Har fan bo'yicha 'oxirgi o'tilgan mavzu'gacha bo'lgan barcha mavzular va eng so'nggilari."""
    covered, recent = [], []
    for t in c.execute(sa.select(topics).where(topics.c.id.in_(last_ids or ["-"]))).mappings():
        rows = c.execute(sa.select(topics.c.id).where(topics.c.grade == t["grade"], topics.c.subj == t["subj"],
                                                      topics.c.ord <= t["ord"]).order_by(topics.c.ord)).all()
        ids = [r[0] for r in rows]
        covered += ids
        recent += ids[-2:]
    return covered, recent


def daily_scope(c, u):
    """Kunlik topshiriq kimlar uchun umumiy: o'tilgan mavzulari belgilangan guruh yoki butun sinf."""
    for gid, in c.execute(sa.select(members.c.group_id).where(members.c.user_id == u["id"]).order_by(members.c.group_id)):
        pr = c.execute(sa.select(progress.c.topic_ids).where(progress.c.group_id == gid)).scalar()
        if pr:
            covered, recent = covered_topics(c, pr)
            if covered:
                return f"g{gid}", covered, recent
    return f"s{u['grade'] or 0}", grade_topics(c, u["grade"]), []


def daily_qids(c, u):
    """12 ta savol guruh/sinfdagi hammaga bir xil (o'tilgan mavzulardan, yarmi eng so'nggilaridan)
    + 3 ta savol o'quvchining o'zi ko'p xato qilgan mavzularidan."""
    scope, covered, recent = daily_scope(c, u)
    key = f"{scope}:{today()}"
    shared = c.execute(sa.select(daily_sets.c.qids).where(daily_sets.c.k == key)).scalar()
    if not shared:
        tests = pick(c, "test", recent, 5)
        tests += pick(c, "test", covered, 10 - len(tests), exclude=tests)
        ms = pick(c, "match", recent, 1)
        ms += pick(c, "match", covered, 2 - len(ms), exclude=ms)
        shared = tests + ms
        try:
            with c.begin_nested():
                c.execute(daily_sets.insert().values(k=key, qids=shared))
        except Exception:   # boshqa o'quvchi shu lahzada yaratib ulgurgan
            shared = c.execute(sa.select(daily_sets.c.qids).where(daily_sets.c.k == key)).scalar() or shared
    wrong = c.execute(sa.select(questions.c.topic_id, sa.func.count()).join(answers, answers.c.qid == questions.c.id).where(
        answers.c.user_id == u["id"], answers.c.ok == sa.false(), answers.c.day >= today(-30),
        questions.c.topic_id.in_(covered or ["-"])).group_by(questions.c.topic_id)).all()
    weak = [t for t, n in sorted(wrong, key=lambda r: -r[1])[:3]]
    own = pick(c, "test", weak, 3, exclude=shared)
    own += pick(c, "test", covered, 3 - len(own), exclude=shared + own)
    kinds = {q["id"]: q["kind"] for q in load_qs(c, shared)}
    return [i for i in shared if kinds.get(i) == "test"] + own + [i for i in shared if kinds.get(i) == "match"]


def load_qs(c, qids):
    rows = {r["id"]: dict(r) for r in c.execute(sa.select(questions).where(questions.c.id.in_(qids))).mappings()}
    return [rows[i] for i in qids if i in rows]


def award(c, uid, code):
    if not c.execute(sa.select(badges).where(badges.c.user_id == uid, badges.c.code == code)).first():
        c.execute(badges.insert().values(user_id=uid, code=code, ts=now()))
        return [code]
    return []


def check_badges(c, uid, sess=None):
    new = award(c, uid, "first")
    u = c.execute(sa.select(users).where(users.c.id == uid)).mappings().first()
    for n, code in ((3, "streak3"), (7, "streak7"), (30, "streak30")):
        if u["best_streak"] >= n:
            new += award(c, uid, code)
    ok = c.execute(sa.select(sa.func.count()).select_from(answers)
                   .where(answers.c.user_id == uid, answers.c.ok == sa.true())).scalar()
    for n, code in ((100, "c100"), (500, "c500"), (2000, "c2000")):
        if ok >= n:
            new += award(c, uid, code)
    if sess and sess["mode"] == "exam" and sess["total"] >= 20 and sess["score"] == sess["total"]:
        new += award(c, uid, "perfect")
    if sess and sess["mode"] == "mistakes":
        left = c.execute(sa.select(sa.func.count()).select_from(mistakes).where(mistakes.c.user_id == uid)).scalar()
        if left == 0:
            new += award(c, uid, "clean")
    wins = c.execute(sa.select(sa.func.count()).select_from(xp_log)
                     .where(xp_log.c.user_id == uid, xp_log.c.why == "duel")).scalar()
    for n, code in ((1, "duel1"), (10, "duel10")):
        if wins >= n:
            new += award(c, uid, code)
    return [{"code": b, "name": BADGES[b][0], "desc": BADGES[b][1]} for b in new]


# ------------------------------------------------------------------ profile
@app.get("/api/me")
def me(u=Depends(auth)):
    with engine.begin() as c:
        uid = u["id"]
        free = None
        if u["role"] == "user":
            free = {"limit": FREE_LIMIT, "used": used_today(c, uid)}
        due = c.execute(sa.select(sa.func.count()).select_from(mistakes)
                        .where(mistakes.c.user_id == uid, mistakes.c.due <= today())).scalar()
        allm = c.execute(sa.select(sa.func.count()).select_from(mistakes).where(mistakes.c.user_id == uid)).scalar()
        d = c.execute(sa.select(sessions.c.finished).where(sessions.c.user_id == uid, sessions.c.mode == "daily",
                                                           sessions.c.day == today())).first()
        gs = [dict(r) for r in c.execute(sa.select(groups.c.id, groups.c.name).join(
            members, members.c.group_id == groups.c.id).where(members.c.user_id == uid)).mappings()]
        hw = []
        if gs:
            names = {g["id"]: g["name"] for g in gs}
            for h in c.execute(sa.select(homework).where(homework.c.group_id.in_(list(names)))
                               .order_by(homework.c.id.desc()).limit(20)).mappings():
                s = c.execute(sa.select(sessions.c.score, sessions.c.total).where(
                    sessions.c.user_id == uid, sessions.c.mode == "hw", sessions.c.ref == str(h["id"]),
                    sessions.c.finished.isnot(None))).first()
                hw.append({"id": h["id"], "title": h["title"], "deadline": h["deadline"], "group": names[h["group_id"]],
                           "count": len(h["qids"]), "done": bool(s), "score": s[0] if s else None,
                           "late": bool(h["deadline"] and h["deadline"] < today())})
        bs = [r[0] for r in c.execute(sa.select(badges.c.code).where(badges.c.user_id == uid))]
        streak = u["streak"] if u["last_daily"] in (today(), today(-1)) else 0
        ok = c.execute(sa.select(sa.func.count()).select_from(answers)
                       .where(answers.c.user_id == uid, answers.c.ok == sa.true())).scalar()
        tot = c.execute(sa.select(sa.func.count()).select_from(answers).where(answers.c.user_id == uid)).scalar()
        return {"user": {"id": uid, "name": u["name"], "grade": u["grade"], "role": u["role"], "xp": u["xp"],
                         "streak": streak, "best_streak": u["best_streak"], "phone": bool(u["phone"]),
                         "remind": u["remind"]},
                "level": level(u["xp"]), "levels": [{"need": n, "name": nm} for n, nm in LEVELS], "free": free,
                "daily_done": bool(d and d[0]), "mistakes_due": due, "mistakes_all": allm, "homework": hw,
                "groups": gs, "covered": daily_scope(c, u)[1] if gs else [], "badges": bs, "stats": {"ok": ok, "total": tot}, "bot": BOT_NAME["v"],
                "all_badges": [{"code": k, "name": v[0], "desc": v[1]} for k, v in BADGES.items()]}


@app.post("/api/me")
async def me_update(req: Request, u=Depends(auth)):
    b = await req.json()
    vals = {}
    if b.get("grade") in (5, 6, 7, 8, 9, 10, 11):
        vals["grade"] = b["grade"]
    if isinstance(b.get("name"), str) and 2 <= len(b["name"].strip()) <= 60:
        vals["name"] = b["name"].strip()
    if isinstance(b.get("remind"), bool):
        vals["remind"] = b["remind"]
    if vals:
        with engine.begin() as c:
            c.execute(users.update().where(users.c.id == u["id"]).values(**vals))
    return {"ok": True}


@app.get("/api/topics")
def topic_list(grade: int = 0, u=Depends(auth)):
    with engine.begin() as c:
        cnt = {}
        for t, k, n in c.execute(sa.select(questions.c.topic_id, questions.c.kind, sa.func.count())
                                 .where(questions.c.active == sa.true()).group_by(questions.c.topic_id, questions.c.kind)):
            cnt.setdefault(t, {})[k] = n
        q = sa.select(topics).order_by(topics.c.ord)
        if grade:
            q = q.where(topics.c.grade == grade)
        grades = sorted({r[0] for r in c.execute(sa.select(topics.c.grade).distinct())})
        return {"grades": grades,
                "topics": [{"id": t["id"], "subj": t["subj"], "grade": t["grade"], "num": t["num"], "title": t["title"],
                            "tests": cnt.get(t["id"], {}).get("test", 0), "matches": cnt.get(t["id"], {}).get("match", 0),
                            "cards": cnt.get(t["id"], {}).get("card", 0)} for t in c.execute(q).mappings()]}


# ------------------------------------------------------------------ sessions
REVEAL = {"daily", "mistakes", "match", "cards"}


def session_payload(c, s, reveal_all=False):
    qs = load_qs(c, s["qids"])
    ans = s["ans"] or {}
    reveal = s["mode"] in REVEAL
    out = []
    for q in qs:
        p = pub(q)
        a = ans.get(str(q["id"]))
        if a is not None:
            p["your"] = a["a"]
            p["tries"] = a.get("tries", 1)
            if reveal or reveal_all:
                p["ok"] = a["ok"]
                if q["kind"] != "card":
                    p["right"] = q["data"]["a"]
        elif reveal_all and q["kind"] != "card":
            p["right"] = q["data"]["a"]
        out.append(p)
    left = None
    if s["limit_sec"]:
        left = max(0, s["limit_sec"] - int((now() - s["started"]).total_seconds()))
    daily = s["mode"] == "daily"
    return {"sid": s["id"], "mode": s["mode"], "reveal": reveal, "limit_sec": s["limit_sec"], "left_sec": left,
            "repeat": daily, "per_q": PER_Q if daily else None, "questions": out}


@app.post("/api/start")
async def start(req: Request, u=Depends(auth)):
    b = await req.json()
    mode = b.get("mode")
    uid = u["id"]
    with engine.begin() as c:
        remaining = 10 ** 6
        if u["role"] == "user":
            remaining = FREE_LIMIT - used_today(c, uid)
            if remaining <= 0:
                raise HTTPException(402, f"Bugungi bepul limit ({FREE_LIMIT} ta savol) tugadi. Ertaga davom eting "
                                         "yoki Adab School o'quvchisi sifatida telefon raqamingizni tasdiqlang.")
        tids = [t for t in (b.get("topics") or []) if isinstance(t, str)][:80]
        if not tids:
            tids = grade_topics(c, b.get("grade") or u["grade"], b.get("subj"))
        count = min(max(int(b.get("count") or 10), 1), 50, remaining)
        limit_sec, ref, qids = None, None, []
        if mode == "exam":
            qids = pick(c, "test", tids, count)
            limit_sec = len(qids) * EXAM_SEC
        elif mode == "daily":
            s = c.execute(sa.select(sessions).where(sessions.c.user_id == uid, sessions.c.mode == "daily",
                                                    sessions.c.day == today())).mappings().first()
            if s:
                if s["finished"]:
                    raise HTTPException(409, "Bugungi topshiriq bajarilgan. Ertaga yangisi bo'ladi!")
                return session_payload(c, s)
            qids = daily_qids(c, u)[:remaining]
        elif mode == "mistakes":
            qids = [r[0] for r in c.execute(sa.select(mistakes.c.qid).where(
                mistakes.c.user_id == uid, mistakes.c.due <= today()).order_by(mistakes.c.due).limit(min(20, remaining)))]
            if not qids:
                raise HTTPException(409, "Hozircha takrorlanadigan xatolar yo'q.")
        elif mode == "match":
            qids = pick(c, "match", tids, min(count, 10))
        elif mode == "cards":
            qids = pick(c, "card", tids, min(count, 30))
        elif mode == "hw":
            h = c.execute(sa.select(homework).where(homework.c.id == int(b.get("hw") or 0))).mappings().first()
            if not h or not c.execute(sa.select(members).where(members.c.group_id == h["group_id"],
                                                               members.c.user_id == uid)).first():
                raise HTTPException(404, "Vazifa topilmadi")
            if c.execute(sa.select(sessions.c.id).where(sessions.c.user_id == uid, sessions.c.mode == "hw",
                                                        sessions.c.ref == str(h["id"]),
                                                        sessions.c.finished.isnot(None))).first():
                raise HTTPException(409, "Bu vazifa allaqachon bajarilgan.")
            qids, ref = h["qids"], str(h["id"])
            limit_sec = len(qids) * EXAM_SEC
        elif mode == "duel":
            d = c.execute(sa.select(duels).where(duels.c.code == str(b.get("duel")))).mappings().first()
            if not d:
                raise HTTPException(404, "Bellashuv topilmadi")
            if uid not in (d["p1"], d["p2"]):
                if d["p2"] is not None:
                    raise HTTPException(403, "Bu bellashuvda joy yo'q")
                c.execute(duels.update().where(duels.c.id == d["id"]).values(p2=uid, open=False))
            if c.execute(sa.select(sessions.c.id).where(sessions.c.user_id == uid, sessions.c.mode == "duel",
                                                        sessions.c.ref == d["code"])).first():
                raise HTTPException(409, "Siz bu bellashuvda qatnashgansiz.")
            qids, ref = d["qids"], d["code"]
            limit_sec = len(qids) * DUEL_SEC
        else:
            raise HTTPException(400, "Noma'lum rejim")
        if not qids:
            raise HTTPException(404, "Bu bo'limda savollar topilmadi")
        r = c.execute(sessions.insert().values(user_id=uid, mode=mode, qids=qids, ans={}, ref=ref, day=today(),
                                               started=now(), limit_sec=limit_sec, total=len(qids)))
        s = c.execute(sa.select(sessions).where(sessions.c.id == r.inserted_primary_key[0])).mappings().first()
        return session_payload(c, s)


def judge(q, a):
    d = q["data"]
    if q["kind"] == "test":
        ok = isinstance(a, int) and a == d["a"]
        return ok, PTS["test"] if ok else 0
    if q["kind"] == "match":
        if not isinstance(a, list):
            a = []
        good = sum(1 for i, x in enumerate(d["a"]) if i < len(a) and a[i] == x)
        return good == len(d["a"]), good * PTS["pair"]
    ok = a in (1, True)
    return ok, PTS["card"] if ok else 0


@app.post("/api/answer")
async def answer(req: Request, u=Depends(auth)):
    b = await req.json()
    uid = u["id"]
    with engine.begin() as c:
        s = c.execute(sa.select(sessions).where(sessions.c.id == int(b.get("sid") or 0),
                                                sessions.c.user_id == uid)).mappings().first()
        if not s or s["finished"]:
            raise HTTPException(404, "Sessiya topilmadi")
        qid = int(b.get("qid") or 0)
        ans = dict(s["ans"] or {})
        prev = ans.get(str(qid))
        # kunlik topshiriqda xato qilingan savol to'g'ri topilguncha qayta ishlanadi
        retry = prev is not None and s["mode"] == "daily" and not prev["ok"]
        if qid not in s["qids"] or (prev is not None and not retry):
            raise HTTPException(400, "Bu savolga javob berilgan")
        if s["limit_sec"] and (now() - s["started"]).total_seconds() > s["limit_sec"] + 20:
            raise HTTPException(410, "Vaqt tugadi")
        if not retry and u["role"] == "user" and used_today(c, uid) >= FREE_LIMIT:
            raise HTTPException(402, "Bugungi bepul limit tugadi")
        q = load_qs(c, [qid])[0]
        ok, pts = judge(q, b.get("a"))
        if retry:   # qayta urinish: kamroq ball, statistika va limitga qo'shilmaydi
            pts //= 3
            ans[str(qid)] = {"a": b.get("a"), "ok": ok, "pts": prev["pts"] + pts, "tries": prev.get("tries", 1) + 1,
                             "first": False}
            c.execute(sessions.update().where(sessions.c.id == s["id"]).values(ans=ans))
            add_xp(c, uid, pts, "ans")
            return {"ok": ok, "pts": pts, "right": q["data"]["a"]}
        ans[str(qid)] = {"a": b.get("a"), "ok": ok, "pts": pts, "tries": 1, "first": ok}
        c.execute(sessions.update().where(sessions.c.id == s["id"]).values(ans=ans))
        c.execute(answers.insert().values(user_id=uid, qid=qid, ok=ok, mode=s["mode"], day=today(), ts=now()))
        add_xp(c, uid, pts, "ans")
        m = c.execute(sa.select(mistakes).where(mistakes.c.user_id == uid, mistakes.c.qid == qid)).mappings().first()
        if not ok:
            if m:
                c.execute(mistakes.update().where(mistakes.c.user_id == uid, mistakes.c.qid == qid)
                          .values(box=0, due=today(1) if s["mode"] == "mistakes" else today()))
            else:
                c.execute(mistakes.insert().values(user_id=uid, qid=qid, box=0, due=today()))
        elif m and s["mode"] == "mistakes":
            if m["box"] + 1 >= len(BOX_DAYS):
                c.execute(mistakes.delete().where(mistakes.c.user_id == uid, mistakes.c.qid == qid))
            else:
                c.execute(mistakes.update().where(mistakes.c.user_id == uid, mistakes.c.qid == qid)
                          .values(box=m["box"] + 1, due=today(BOX_DAYS[m["box"] + 1])))
        if s["mode"] in REVEAL:
            return {"ok": ok, "pts": pts, "right": q["data"]["a"] if q["kind"] != "card" else None}
        return {"saved": True}


@app.post("/api/finish")
async def finish(req: Request, u=Depends(auth)):
    b = await req.json()
    uid = u["id"]
    notify = []
    with engine.begin() as c:
        s = c.execute(sa.select(sessions).where(sessions.c.id == int(b.get("sid") or 0),
                                                sessions.c.user_id == uid)).mappings().first()
        if not s:
            raise HTTPException(404, "Sessiya topilmadi")
        s = dict(s)
        ans = s["ans"] or {}
        res = {"bonus": 0, "badges": [], "duel": None}
        if not s["finished"] and s["mode"] == "daily" and not all(
                ans.get(str(q), {}).get("ok") for q in s["qids"]):
            raise HTTPException(409, "Avval barcha savollarni to'g'ri bajaring")
        if not s["finished"]:
            # kunlik topshiriqda natija — birinchi urinishda to'g'ri topilganlar soni
            score = sum(1 for a in ans.values() if a.get("first", a["ok"]))
            secs = int((now() - s["started"]).total_seconds())
            if s["limit_sec"]:
                secs = min(secs, s["limit_sec"])
            c.execute(sessions.update().where(sessions.c.id == s["id"]).values(finished=now(), score=score, secs=secs))
            s.update(finished=now(), score=score, secs=secs)
            # imtihon rejimlarida javobsiz qolgan savollar xatolar ro'yxatiga tushadi
            if s["mode"] in ("exam", "hw"):
                for qid in s["qids"]:
                    if str(qid) not in ans and not c.execute(sa.select(mistakes).where(
                            mistakes.c.user_id == uid, mistakes.c.qid == qid)).first():
                        c.execute(mistakes.insert().values(user_id=uid, qid=qid, box=0, due=today()))
            if s["mode"] == "daily":
                streak = u["streak"] + 1 if u["last_daily"] == today(-1) else (u["streak"] if u["last_daily"] == today() else 1)
                c.execute(users.update().where(users.c.id == uid).values(
                    streak=streak, best_streak=max(u["best_streak"] or 0, streak), last_daily=today()))
                add_xp(c, uid, PTS["daily"], "daily")
                res["bonus"] = PTS["daily"]
                res["streak"] = streak
            if s["mode"] == "duel":
                d = dict(c.execute(sa.select(duels).where(duels.c.code == s["ref"])).mappings().first())
                side = "1" if d["p1"] == uid else "2"
                d["s" + side], d["t" + side] = score, secs
                vals = {"s" + side: score, "t" + side: secs}
                if d["s1"] is not None and d["s2"] is not None:
                    vals["status"] = "done"
                    k1, k2 = (d["s1"], -d["t1"]), (d["s2"], -d["t2"])
                    win = d["p1"] if k1 > k2 else d["p2"] if k2 > k1 else None
                    if win:
                        add_xp(c, win, PTS["duel"], "duel")
                        if win == uid:
                            res["bonus"] = PTS["duel"]
                    other = d["p2"] if side == "1" else d["p1"]
                    notify.append((other, f"⚔️ Bellashuv yakunlandi! {u['name']}: {score} ta to'g'ri. "
                                          f"Natijani ko'rish uchun ilovani oching."))
                c.execute(duels.update().where(duels.c.id == d["id"]).values(**vals))
            res["badges"] = check_badges(c, uid, s)
        if s["mode"] == "duel":
            res["duel"] = duel_view(c, s["ref"], uid)
        s2 = c.execute(sa.select(sessions).where(sessions.c.id == s["id"])).mappings().first()
        p = session_payload(c, s2, reveal_all=True)
        res.update(score=s2["score"], total=s2["total"], secs=s2["secs"], mode=s2["mode"],
                   xp=sum(a["pts"] for a in ans.values()) + res["bonus"], review=p["questions"])
    for chat, text in notify:
        tg_send(chat, text, app_button=True)
    return res


@app.post("/api/report")
async def report(req: Request, u=Depends(auth)):
    b = await req.json()
    with engine.begin() as c:
        c.execute(reports.insert().values(user_id=u["id"], qid=int(b["qid"]), text=str(b.get("text", ""))[:500],
                                          status="new", ts=now()))
    return {"ok": True}


# ------------------------------------------------------------------ leaderboard
@app.get("/api/top")
def top(period: str = "week", scope: str = "all", u=Depends(auth)):
    with engine.begin() as c:
        if period == "all":
            q = sa.select(users.c.id, users.c.name, users.c.grade, users.c.xp.label("pts")).where(users.c.xp > 0)
        else:
            d = dt.datetime.now(TZ)
            start = (d - dt.timedelta(days=d.weekday())) if period == "week" else d.replace(day=1)
            q = sa.select(users.c.id, users.c.name, users.c.grade, sa.func.sum(xp_log.c.pts).label("pts")) \
                .join(xp_log, xp_log.c.user_id == users.c.id).where(xp_log.c.day >= start.strftime("%Y-%m-%d")) \
                .group_by(users.c.id, users.c.name, users.c.grade)
        if scope == "grade" and u["grade"]:
            q = q.where(users.c.grade == u["grade"])
        elif scope.startswith("g"):
            ids = [r[0] for r in c.execute(sa.select(members.c.user_id).where(members.c.group_id == int(scope[1:] or 0)))]
            q = q.where(users.c.id.in_(ids or [0]))
        rows = sorted([dict(r) for r in c.execute(q).mappings()], key=lambda r: -int(r["pts"]))
        mine = next((i + 1 for i, r in enumerate(rows) if r["id"] == u["id"]), None)
        return {"rows": [{"rank": i + 1, "name": r["name"], "grade": r["grade"], "pts": int(r["pts"]),
                          "me": r["id"] == u["id"], "level": level(int(r["pts"]) if period == "all" else 0)["name"]
                          if period == "all" else None} for i, r in enumerate(rows[:50])],
                "me": {"rank": mine, "pts": next((int(r["pts"]) for r in rows if r["id"] == u["id"]), 0)},
                "count": len(rows)}


# ------------------------------------------------------------------ duels
def duel_view(c, code, uid):
    d = c.execute(sa.select(duels).where(duels.c.code == code)).mappings().first()
    if not d:
        return None
    names = {r[0]: r[1] for r in c.execute(sa.select(users.c.id, users.c.name).where(users.c.id.in_(
        [x for x in (d["p1"], d["p2"]) if x])))}
    mine, other = ("1", "2") if d["p1"] == uid else ("2", "1")
    done = d["status"] == "done"
    win = None
    if done:
        k = {"1": (d["s1"], -d["t1"]), "2": (d["s2"], -d["t2"])}
        win = "me" if k[mine] > k[other] else "other" if k[other] > k[mine] else "draw"
    played = d["s" + mine] is not None
    return {"code": d["code"], "status": d["status"], "total": len(d["qids"]), "win": win, "played": played,
            "is_member": uid in (d["p1"], d["p2"]),
            "me": {"name": names.get(d["p" + mine], ""), "score": d["s" + mine], "secs": d["t" + mine]},
            "other": {"name": names.get(d["p" + other]) if d["p" + other] else None,
                      # raqib natijasi o'zingiz o'ynamaguningizcha ko'rsatilmaydi
                      "score": d["s" + other] if played else None, "secs": d["t" + other] if played else None,
                      "played": d["s" + other] is not None},
            "link": f"https://t.me/{BOT_NAME['v']}?start=duel_{d['code']}"}


@app.post("/api/duel")
async def duel_create(req: Request, u=Depends(auth)):
    b = await req.json()
    rnd = bool(b.get("random"))
    with engine.begin() as c:
        if rnd:
            cutoff = now() - dt.timedelta(days=2)
            d = c.execute(sa.select(duels).where(duels.c.open == sa.true(), duels.c.p2.is_(None), duels.c.p1 != u["id"],
                                                 duels.c.created > cutoff).order_by(duels.c.id).limit(1)).mappings().first()
            if d:
                c.execute(duels.update().where(duels.c.id == d["id"]).values(p2=u["id"], open=False))
                return duel_view(c, d["code"], u["id"])
        qids = pick(c, "test", grade_topics(c, u["grade"]), 10)
        if len(qids) < 5:
            raise HTTPException(404, "Savollar yetarli emas")
        code = secrets.token_hex(4)
        c.execute(duels.insert().values(code=code, grade=u["grade"], p1=u["id"], qids=qids, open=rnd, status="wait",
                                        created=now()))
        return duel_view(c, code, u["id"])


@app.get("/api/duel/{code}")
def duel_get(code: str, u=Depends(auth)):
    with engine.begin() as c:
        d = c.execute(sa.select(duels).where(duels.c.code == code)).mappings().first()
        if not d:
            raise HTTPException(404, "Bellashuv topilmadi")
        v = duel_view(c, code, u["id"])
        if not v["is_member"]:
            n = c.execute(sa.select(users.c.name).where(users.c.id == d["p1"])).scalar()
            return {"code": code, "status": d["status"], "total": len(d["qids"]), "is_member": False,
                    "can_join": d["p2"] is None, "host": n}
        return v


@app.get("/api/duels")
def duel_list(u=Depends(auth)):
    with engine.begin() as c:
        codes = [r[0] for r in c.execute(sa.select(duels.c.code).where(
            sa.or_(duels.c.p1 == u["id"], duels.c.p2 == u["id"])).order_by(duels.c.id.desc()).limit(15))]
        return [duel_view(c, x, u["id"]) for x in codes]


# ------------------------------------------------------------------ groups & teacher
@app.post("/api/join")
async def join_group(req: Request, u=Depends(auth)):
    b = await req.json()
    with engine.begin() as c:
        g = c.execute(sa.select(groups).where(groups.c.code == str(b.get("code", "")).strip().upper())).mappings().first()
        if not g:
            raise HTTPException(404, "Bunday kodli guruh topilmadi")
        if not c.execute(sa.select(members).where(members.c.group_id == g["id"], members.c.user_id == u["id"])).first():
            c.execute(members.insert().values(group_id=g["id"], user_id=u["id"]))
        if g["grade"]:   # guruhga qo'shilgan o'quvchining sinfi guruh sinfiga tenglashadi
            c.execute(users.update().where(users.c.id == u["id"]).values(grade=g["grade"]))
        return {"ok": True, "name": g["name"], "grade": g["grade"]}


def own_group(c, gid, u):
    g = c.execute(sa.select(groups).where(groups.c.id == gid)).mappings().first()
    if not g or (g["teacher_id"] != u["id"] and u["role"] != "admin"):
        raise HTTPException(404, "Guruh topilmadi")
    return g


@app.get("/api/t/groups")
def t_groups(u=Depends(teacher)):
    with engine.begin() as c:
        q = sa.select(groups).order_by(groups.c.id)
        if u["role"] != "admin":
            q = q.where(groups.c.teacher_id == u["id"])
        out = []
        for g in c.execute(q).mappings():
            n = c.execute(sa.select(sa.func.count()).select_from(members).where(members.c.group_id == g["id"])).scalar()
            hw = c.execute(sa.select(sa.func.count()).select_from(homework).where(homework.c.group_id == g["id"])).scalar()
            out.append({"id": g["id"], "name": g["name"], "code": g["code"], "members": n, "homework": hw})
        return out


@app.post("/api/t/group")
async def t_group_create(req: Request, u=Depends(teacher)):
    b = await req.json()
    name = str(b.get("name", "")).strip()[:80]
    if len(name) < 2:
        raise HTTPException(400, "Guruh nomini kiriting")
    grade = b.get("grade") if b.get("grade") in (5, 6, 7, 8, 9, 10, 11) else None
    with engine.begin() as c:
        code = "".join(random.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
        c.execute(groups.insert().values(name=name, teacher_id=u["id"], code=code, grade=grade))
    return {"ok": True, "code": code}


@app.get("/api/t/group/{gid}")
def t_group(gid: int, u=Depends(teacher)):
    with engine.begin() as c:
        g = own_group(c, gid, u)
        ids = [r[0] for r in c.execute(sa.select(members.c.user_id).where(members.c.group_id == gid))]
        wk = (dt.datetime.now(TZ) - dt.timedelta(days=6)).strftime("%Y-%m-%d")
        st = {}
        if ids:
            for uid, ok, n in c.execute(sa.select(answers.c.user_id, answers.c.ok, sa.func.count()).where(
                    answers.c.user_id.in_(ids), answers.c.day >= wk).group_by(answers.c.user_id, answers.c.ok)):
                s = st.setdefault(uid, [0, 0])
                s[1] += n
                s[0] += n if ok else 0
        ms = [{"id": r["id"], "name": r["name"], "xp": r["xp"], "streak": r["streak"] if r["last_daily"] in (today(), today(-1)) else 0,
               "week_total": st.get(r["id"], [0, 0])[1], "week_ok": st.get(r["id"], [0, 0])[0]}
              for r in c.execute(sa.select(users).where(users.c.id.in_(ids or [0]))).mappings()]
        ms.sort(key=lambda m: -m["week_total"])
        hws = []
        for h in c.execute(sa.select(homework).where(homework.c.group_id == gid).order_by(homework.c.id.desc())).mappings():
            done = c.execute(sa.select(sa.func.count()).select_from(sessions).where(
                sessions.c.mode == "hw", sessions.c.ref == str(h["id"]), sessions.c.finished.isnot(None))).scalar()
            hws.append({"id": h["id"], "title": h["title"], "deadline": h["deadline"], "count": len(h["qids"]), "done": done})
        # eng qiyin savollar (guruh bo'yicha, kamida 3 ta javob)
        hard = []
        if ids:
            okc = sa.func.sum(sa.case((answers.c.ok == sa.true(), 1), else_=0))
            rows = c.execute(sa.select(answers.c.qid, sa.func.count().label("n"), okc.label("ok")).where(
                answers.c.user_id.in_(ids)).group_by(answers.c.qid).having(sa.func.count() >= 3)).all()
            rows = sorted(rows, key=lambda r: r[2] / r[1])[:15]
            qs = {q["id"]: q for q in load_qs(c, [r[0] for r in rows])}
            tt = {t[0]: t[1] for t in c.execute(sa.select(topics.c.id, topics.c.title))}
            for qid, n, ok in rows:
                q = qs.get(qid)
                if q and ok / n < 0.7:
                    hard.append({"q": q["data"].get("q") or q["data"].get("t"), "kind": q["kind"], "n": n,
                                 "pct": round(100 * ok / n), "topic": tt.get(q["topic_id"], "")})
        pr = c.execute(sa.select(progress.c.topic_ids).where(progress.c.group_id == gid)).scalar() or []
        prog = [{"id": t["id"], "title": t["title"], "num": t["num"], "subj": t["subj"], "grade": t["grade"]}
                for t in c.execute(sa.select(topics).where(topics.c.id.in_(pr or ["-"])).order_by(topics.c.ord)).mappings()]
        link = f"https://t.me/{BOT_NAME['v']}?start=g_{g['code']}"
        qr = segno.make(link, error="m").svg_data_uri(scale=8, border=2, dark="#001342")
        return {"id": gid, "name": g["name"], "code": g["code"], "grade": g["grade"], "members": ms, "homework": hws,
                "hard": hard, "progress": prog, "link": link, "qr": qr}


@app.post("/api/t/progress")
async def t_progress(req: Request, u=Depends(teacher)):
    """Guruh darsda qaysi mavzugacha yetib kelgani: har fan bo'yicha oxirgi o'tilgan mavzu."""
    b = await req.json()
    with engine.begin() as c:
        g = own_group(c, int(b.get("group_id") or 0), u)
        ids = [t for t in (b.get("topics") or []) if isinstance(t, str)][:10]
        last = {}
        for t in c.execute(sa.select(topics).where(topics.c.id.in_(ids or ["-"]))).mappings():
            last[(t["grade"], t["subj"])] = t["id"]
        c.execute(progress.delete().where(progress.c.group_id == g["id"]))
        if last:
            c.execute(progress.insert().values(group_id=g["id"], topic_ids=list(last.values())))
        # bugungi umumiy to'plam yangi mavzular bo'yicha qayta tuziladi (hali hech kim boshlamagan bo'lsa)
        c.execute(daily_sets.delete().where(daily_sets.c.k == f"g{g['id']}:{today()}"))
    return {"ok": True, "count": len(last)}


@app.post("/api/t/hw")
async def t_hw_create(req: Request, u=Depends(teacher)):
    b = await req.json()
    with engine.begin() as c:
        g = own_group(c, int(b.get("group_id") or 0), u)
        tids = [t for t in (b.get("topics") or []) if isinstance(t, str)][:40]
        qids = pick(c, "test", tids, min(max(int(b.get("count") or 15), 5), 40))
        if not qids:
            raise HTTPException(400, "Mavzu tanlang")
        title = str(b.get("title", "")).strip()[:120] or "Uyga vazifa"
        dl = b.get("deadline") if re.fullmatch(r"\d{4}-\d\d-\d\d", str(b.get("deadline") or "")) else None
        c.execute(homework.insert().values(group_id=g["id"], title=title, topic_ids=tids, qids=qids, deadline=dl, created=now()))
        ids = [r[0] for r in c.execute(sa.select(members.c.user_id).where(members.c.group_id == g["id"]))]
    for uid in ids:
        tg_send(uid, f"📚 Yangi uyga vazifa: «{title}» ({len(qids)} ta savol)" + (f"\nMuddat: {dl}" if dl else ""), app_button=True)
    return {"ok": True, "count": len(qids)}


@app.get("/api/t/hw/{hid}")
def t_hw(hid: int, u=Depends(teacher)):
    with engine.begin() as c:
        h = c.execute(sa.select(homework).where(homework.c.id == hid)).mappings().first()
        if not h:
            raise HTTPException(404, "Vazifa topilmadi")
        own_group(c, h["group_id"], u)
        ids = [r[0] for r in c.execute(sa.select(members.c.user_id).where(members.c.group_id == h["group_id"]))]
        names = {r[0]: r[1] for r in c.execute(sa.select(users.c.id, users.c.name).where(users.c.id.in_(ids or [0])))}
        ss = {s["user_id"]: s for s in c.execute(sa.select(sessions).where(
            sessions.c.mode == "hw", sessions.c.ref == str(hid), sessions.c.finished.isnot(None))).mappings()}
        rows = [{"name": names[i], "done": i in ss, "score": ss[i]["score"] if i in ss else None,
                 "secs": ss[i]["secs"] if i in ss else None,
                 "date": ss[i]["finished"].strftime("%Y-%m-%d") if i in ss else None} for i in ids]
        rows.sort(key=lambda r: (-(r["score"] if r["score"] is not None else -1), r["name"]))
        per = []
        for q in load_qs(c, h["qids"]):
            got = [s["ans"].get(str(q["id"])) for s in ss.values()]
            ok = sum(1 for a in got if a and a["ok"])
            per.append({"q": q["data"]["q"], "right": q["data"]["o"][q["data"]["a"]], "ok": ok, "n": len(ss)})
        per.sort(key=lambda p: p["ok"])
        return {"id": hid, "title": h["title"], "deadline": h["deadline"], "total": len(h["qids"]), "rows": rows, "questions": per}


# ------------------------------------------------------------------ admin
@app.get("/api/a/stats")
def a_stats(u=Depends(admin)):
    with engine.begin() as c:
        cnt = lambda t, *w: c.execute(sa.select(sa.func.count()).select_from(t).where(*w)).scalar()
        return {"users": cnt(users), "students": cnt(users, users.c.role == "student"),
                "teachers": cnt(users, users.c.role == "teacher"),
                "active_today": c.execute(sa.select(sa.func.count(sa.distinct(answers.c.user_id)))
                                          .where(answers.c.day == today())).scalar(),
                "answers_today": cnt(answers, answers.c.day == today()), "answers": cnt(answers),
                "questions": cnt(questions, questions.c.active == sa.true()), "topics": cnt(topics),
                "reports_new": cnt(reports, reports.c.status == "new"), "whitelist": cnt(whitelist)}


@app.get("/api/a/reports")
def a_reports(u=Depends(admin)):
    with engine.begin() as c:
        out = []
        for r in c.execute(sa.select(reports).where(reports.c.status == "new").order_by(reports.c.id.desc()).limit(50)).mappings():
            q = c.execute(sa.select(questions).where(questions.c.id == r["qid"])).mappings().first()
            n = c.execute(sa.select(users.c.name).where(users.c.id == r["user_id"])).scalar()
            out.append({"id": r["id"], "text": r["text"], "by": n, "qid": r["qid"],
                        "q": {"id": q["id"], "kind": q["kind"], "topic": q["topic_id"], "data": q["data"], "active": q["active"]} if q else None})
        return out


@app.post("/api/a/report/{rid}")
def a_report_close(rid: int, u=Depends(admin)):
    with engine.begin() as c:
        c.execute(reports.update().where(reports.c.id == rid).values(status="done"))
    return {"ok": True}


@app.get("/api/a/questions")
def a_questions(topic: str, kind: str = "test", u=Depends(admin)):
    with engine.begin() as c:
        return [{"id": q["id"], "kind": q["kind"], "n": q["n"], "data": q["data"], "active": q["active"]}
                for q in c.execute(sa.select(questions).where(questions.c.topic_id == topic, questions.c.kind == kind)
                                   .order_by(questions.c.n)).mappings()]


@app.put("/api/a/question/{qid}")
async def a_question_save(qid: int, req: Request, u=Depends(admin)):
    b = await req.json()
    with engine.begin() as c:
        q = c.execute(sa.select(questions).where(questions.c.id == qid)).mappings().first()
        if not q:
            raise HTTPException(404, "Savol topilmadi")
        d = dict(q["data"])
        n = b.get("data") or {}
        if q["kind"] == "test":
            if not (isinstance(n.get("q"), str) and n["q"].strip() and isinstance(n.get("o"), list) and len(n["o"]) == 4
                    and all(isinstance(x, str) and x.strip() for x in n["o"]) and n.get("a") in (0, 1, 2, 3)):
                raise HTTPException(400, "Savol, 4 ta variant va to'g'ri javob to'ldirilishi kerak")
            d.update(q=n["q"].strip(), o=[x.strip() for x in n["o"]], a=n["a"])
        elif q["kind"] == "card":
            if not (isinstance(n.get("q"), str) and n["q"].strip() and isinstance(n.get("a"), str) and n["a"].strip()):
                raise HTTPException(400, "Savol va javob to'ldirilishi kerak")
            d.update(q=n["q"].strip(), a=n["a"].strip())
        c.execute(questions.update().where(questions.c.id == qid).values(data=d, active=bool(b.get("active", True))))
    return {"ok": True}


@app.get("/api/a/users")
def a_users(q: str = "", u=Depends(admin)):
    with engine.begin() as c:
        s = sa.select(users).order_by(users.c.xp.desc()).limit(40)
        if q:
            like = f"%{q.lower()}%"
            s = s.where(sa.or_(sa.func.lower(users.c.name).like(like), sa.func.lower(users.c.username).like(like),
                               users.c.phone.like(f"%{re.sub(chr(92) + 'D', '', q) or '~'}%")))
        return [{"id": r["id"], "name": r["name"], "username": r["username"], "role": r["role"], "grade": r["grade"],
                 "xp": r["xp"], "phone": r["phone"]} for r in c.execute(s).mappings()]


@app.post("/api/a/user/{uid}")
async def a_user_role(uid: int, req: Request, u=Depends(admin)):
    b = await req.json()
    if b.get("role") not in ("user", "student", "teacher", "admin"):
        raise HTTPException(400, "Noto'g'ri rol")
    with engine.begin() as c:
        c.execute(users.update().where(users.c.id == uid).values(role=b["role"]))
    return {"ok": True}


@app.post("/api/a/whitelist")
async def a_whitelist(req: Request, u=Depends(admin)):
    """Matn ichidagi barcha telefon raqamlarini (har qatorda bittadan, ixtiyoriy ism bilan) ro'yxatga qo'shadi."""
    b = await req.json()
    added = up = 0
    with engine.begin() as c:
        if b.get("replace"):
            c.execute(whitelist.delete())
        have = {r[0] for r in c.execute(sa.select(whitelist.c.phone))}
        for line in str(b.get("text", "")).splitlines():
            for m in re.finditer(r"\+?\d[\d\s\-()]{7,}\d", line):
                p = norm_phone(m.group(0))
                if p and p not in have:
                    have.add(p)
                    c.execute(whitelist.insert().values(phone=p, name=re.sub(r"[\d+\-()\s,;]+", " ", line).strip()[:120]))
                    added += 1
        for r in c.execute(sa.select(users.c.id, users.c.phone).where(users.c.role == "user", users.c.phone.isnot(None))):
            if norm_phone(r[1]) in have:
                c.execute(users.update().where(users.c.id == r[0]).values(role="student"))
                up += 1
        total = len(have)
    return {"added": added, "upgraded": up, "total": total}


# ------------------------------------------------------------------ telegram bot
def tg(method, **params):
    if not BOT_TOKEN:
        return None
    try:
        r = httpx.post(f"https://api.telegram.org/bot{BOT_TOKEN}/{method}", json=params, timeout=40)
        return r.json()
    except Exception:
        return None


def tg_send(chat, text, app_button=False, markup=None, hash_=""):
    if app_button and PUBLIC_URL:
        markup = {"inline_keyboard": [[{"text": "📖 Ilovani ochish", "web_app": {"url": PUBLIC_URL + "/" + hash_}}]]}
    p = {"chat_id": chat, "text": text, "parse_mode": "HTML"}
    if markup:
        p["reply_markup"] = markup
    return tg("sendMessage", **p)


def handle_update(up):
    m = up.get("message")
    if not m or m.get("chat", {}).get("type") != "private":
        return
    f = m["from"]
    with engine.begin() as c:
        u = ensure_user(c, f)
    text = m.get("text", "")
    if m.get("contact"):
        ct = m["contact"]
        if ct.get("user_id") != f["id"]:
            tg_send(f["id"], "Iltimos, pastdagi tugma orqali <b>o'z</b> raqamingizni yuboring.")
            return
        with engine.begin() as c:
            ok = bool(c.execute(sa.select(whitelist).where(whitelist.c.phone == norm_phone(ct["phone_number"]))).first())
            vals = {"phone": ct["phone_number"]}
            if ok and u["role"] == "user":
                vals["role"] = "student"
            c.execute(users.update().where(users.c.id == f["id"]).values(**vals))
        if ok or u["role"] != "user":
            tg_send(f["id"], "✅ Raqamingiz tasdiqlandi. Siz <b>Adab School o'quvchisi</b> sifatida barcha "
                             "imkoniyatlardan cheklovsiz foydalanasiz!", markup={"remove_keyboard": True})
        else:
            tg_send(f["id"], "Raqamingiz saqlandi, lekin u Adab School o'quvchilari ro'yxatida topilmadi. Hozircha "
                             f"kuniga {FREE_LIMIT} ta savol ishlashingiz mumkin.\n\nAdab School'da o'qisangiz, "
                             "administratorga murojaat qiling — ro'yxatga qo'shilgach to'liq kirish ochiladi.",
                    markup={"remove_keyboard": True})
        tg_send(f["id"], "Boshlash uchun ilovani oching 👇", app_button=True)
        return
    if text.startswith("/start"):
        arg = text[6:].strip()
        if arg.startswith("g_"):
            code = re.sub(r"\W", "", arg[2:]).upper()
            with engine.begin() as c:
                g = c.execute(sa.select(groups.c.name).where(groups.c.code == code)).scalar()
            if g:
                tg_send(f["id"], f"👋 Assalomu alaykum! Siz <b>{g}</b> guruhiga taklif qilindingiz.\n\n"
                                 "Qo'shilish va mashqni boshlash uchun pastdagi tugmani bosing 👇",
                        app_button=True, hash_="?join=" + code)
                return
        if arg.startswith("duel_"):
            tg_send(f["id"], "⚔️ Sizni tarix bo'yicha bellashuvga chaqirishdi! Qabul qilish uchun ilovani oching 👇",
                    app_button=True, hash_="?duel=" + re.sub(r"\W", "", arg[5:]))
            return
        tg_send(f["id"], f"Assalomu alaykum, <b>{f.get('first_name', '')}</b>! 👋\n\n"
                         "Bu — <b>Adab School</b>ning tarix fanidan bilimni mustahkamlash boti.\n\n"
                         "📝 Imtihon rejimi — vaqtga qarshi testlar\n"
                         "🔁 Xatolar ustida ishlash\n"
                         "📅 Har kuni yangi kunlik topshiriq\n"
                         "🧩 Moslashtirish va savol-javob kartochkalari\n"
                         "⚔️ Do'stlar bilan bellashuv va reyting", app_button=True)
        if not u["phone"]:
            tg_send(f["id"], "Adab School o'quvchisimisiz? Cheklovsiz foydalanish uchun telefon raqamingizni yuboring 👇",
                    markup={"keyboard": [[{"text": "📱 Raqamni yuborish", "request_contact": True}]],
                            "resize_keyboard": True, "one_time_keyboard": True})
    elif text.startswith("/id"):
        tg_send(f["id"], f"Sizning ID: <code>{f['id']}</code>")
    else:
        tg_send(f["id"], "Mashq qilish uchun ilovani oching 👇", app_button=True)


@app.post("/tg/{secret}")
async def webhook(secret: str, req: Request):
    if secret != SECRET:
        raise HTTPException(403)
    up = await req.json()
    try:
        handle_update(up)
    except Exception as e:  # webhook hech qachon xato qaytarmasin
        print("update error", repr(e))
    return {"ok": True}


def send_reminders():
    with engine.begin() as c:
        if c.execute(sa.select(kv).where(kv.c.k == "remind", kv.c.v == today())).first():
            return 0
        c.execute(kv.delete().where(kv.c.k == "remind"))
        c.execute(kv.insert().values(k="remind", v=today()))
        rows = c.execute(sa.select(users.c.id, users.c.streak, users.c.last_daily).where(
            users.c.remind == sa.true(), users.c.grade.isnot(None),
            sa.or_(users.c.last_daily.is_(None), users.c.last_daily != today()))).all()
    n = 0
    for uid, streak, last in rows:
        txt = "📅 Bugungi kunlik topshiriq sizni kutmoqda!"
        if last == today(-1) and streak:
            txt += f"\n🔥 {streak} kunlik seriyangizni yo'qotmang."
        r = tg_send(uid, txt, app_button=True)
        n += 1 if r and r.get("ok") else 0
        time.sleep(0.05)
    return n


@app.get("/cron/remind")
def cron_remind(key: str = ""):
    # Kuniga bir marta ishlaydi (takror chaqiruvlar e'tiborsiz qoladi). Kalitsiz chaqiruv faqat
    # eslatma soatidan keyin qabul qilinadi — tashqi jadval (GitHub Actions) shu yo'ldan foydalanadi.
    if key != SECRET and dt.datetime.now(TZ).hour < REMIND_HOUR:
        raise HTTPException(403)
    return {"sent": send_reminders()}


def background():
    offset = 0
    while True:
        try:
            if dt.datetime.now(TZ).hour == REMIND_HOUR:
                send_reminders()
            if not PUBLIC_URL and BOT_TOKEN and os.environ.get("POLLING") == "1":
                r = httpx.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates",
                              params={"offset": offset, "timeout": 25}, timeout=40).json()
                for up in r.get("result", []):
                    offset = up["update_id"] + 1
                    try:
                        handle_update(up)
                    except Exception as e:
                        print("update error", repr(e))
            else:
                time.sleep(60)
        except Exception as e:
            print("background error", repr(e))
            time.sleep(10)


@app.on_event("startup")
def startup():
    db.init(os.path.join(ROOT, "content", "topics.json"))
    if BOT_TOKEN and os.environ.get("NO_TG") != "1":
        r = tg("getMe")
        if r and r.get("ok"):
            BOT_NAME["v"] = r["result"]["username"]
        if PUBLIC_URL:
            tg("setWebhook", url=f"{PUBLIC_URL}/tg/{SECRET}", allowed_updates=["message"])
            tg("setChatMenuButton", menu_button={"type": "web_app", "text": "Tarix", "web_app": {"url": PUBLIC_URL + "/"}})
        tg("setMyCommands", commands=[{"command": "start", "description": "Botni ishga tushirish"}])
        threading.Thread(target=background, daemon=True).start()


@app.get("/healthz")
def health():
    return {"ok": True}


@app.exception_handler(HTTPException)
async def http_err(request, exc):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


app.mount("/media", StaticFiles(directory=os.path.join(ROOT, "content", "media"), check_dir=False), name="media")
app.mount("/static", StaticFiles(directory=os.path.join(ROOT, "web")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(ROOT, "web", "index.html"), headers={"Cache-Control": "no-cache"})
