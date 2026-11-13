"""Ma'lumotlar bazasi: SQLite (lokal) yoki PostgreSQL (DATABASE_URL orqali)."""
import json
import os
import time
import sqlalchemy as sa

URL = os.environ.get("DATABASE_URL", "sqlite:///data.db")
if URL.startswith("postgres://"):
    URL = URL.replace("postgres://", "postgresql://", 1)
_kw = {} if URL.startswith("sqlite") else {"pool_size": 10, "max_overflow": 10, "pool_recycle": 900}
engine = sa.create_engine(URL, future=True, **_kw)
RO = engine.execution_options(isolation_level="AUTOCOMMIT")   # o'qish uchun: COMMIT so'rovisiz


@sa.event.listens_for(engine, "checkout")
def _ping(dbapi_con, rec, proxy):
    """Ulanish 20 soniyadan ko'p bo'sh turgan bo'lsagina tirikligini tekshiramiz (har safar emas)."""
    if time.time() - rec.info.get("t", 0) > 20:
        try:
            cur = dbapi_con.cursor()
            cur.execute("SELECT 1")
            cur.close()
        except Exception:
            raise sa.exc.DisconnectionError()
    rec.info["t"] = time.time()


@sa.event.listens_for(engine, "checkin")
def _seen(dbapi_con, rec):
    rec.info["t"] = time.time()
md = sa.MetaData()
BigInt = sa.BigInteger().with_variant(sa.Integer, "sqlite")


def T(name, *cols):
    return sa.Table(name, md, *cols)


users = T("users",
          sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=False),
          sa.Column("name", sa.String(120)), sa.Column("username", sa.String(64)),
          sa.Column("phone", sa.String(20)), sa.Column("grade", sa.Integer), sa.Column("book", sa.String(12)),
          sa.Column("role", sa.String(12), default="user"),  # user | student | teacher | admin
          sa.Column("xp", sa.Integer, default=0), sa.Column("streak", sa.Integer, default=0),
          sa.Column("best_streak", sa.Integer, default=0), sa.Column("last_daily", sa.String(10)),
          sa.Column("remind", sa.Boolean, default=True), sa.Column("created", sa.DateTime))
whitelist = T("whitelist", sa.Column("phone", sa.String(20), primary_key=True), sa.Column("name", sa.String(120)))
topics = T("topics", sa.Column("id", sa.String(24), primary_key=True), sa.Column("subj", sa.String(8)),
           sa.Column("grade", sa.Integer), sa.Column("num", sa.String(12)), sa.Column("title", sa.String(300)),
           sa.Column("ord", sa.Integer))
questions = T("questions", sa.Column("id", BigInt, primary_key=True, autoincrement=True),
              sa.Column("topic_id", sa.String(24), index=True), sa.Column("kind", sa.String(6)),  # test|match|card
              sa.Column("n", sa.Integer), sa.Column("data", sa.JSON), sa.Column("active", sa.Boolean, default=True),
              sa.UniqueConstraint("topic_id", "kind", "n"))
answers = T("answers", sa.Column("id", BigInt, primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.BigInteger, index=True), sa.Column("qid", sa.BigInteger, index=True),
            sa.Column("ok", sa.Boolean), sa.Column("mode", sa.String(10)), sa.Column("day", sa.String(10), index=True),
            sa.Column("ts", sa.DateTime))
xp_log = T("xp_log", sa.Column("id", BigInt, primary_key=True, autoincrement=True),
           sa.Column("user_id", sa.BigInteger, index=True), sa.Column("pts", sa.Integer),
           sa.Column("day", sa.String(10), index=True), sa.Column("why", sa.String(16)))
mistakes = T("mistakes", sa.Column("user_id", sa.BigInteger, primary_key=True, autoincrement=False),
             sa.Column("qid", sa.BigInteger, primary_key=True, autoincrement=False),
             sa.Column("box", sa.Integer, default=0), sa.Column("due", sa.String(10)))
sessions = T("sessions", sa.Column("id", BigInt, primary_key=True, autoincrement=True),
             sa.Column("user_id", sa.BigInteger, index=True), sa.Column("mode", sa.String(10)),
             sa.Column("qids", sa.JSON), sa.Column("ans", sa.JSON), sa.Column("ref", sa.String(24)),
             sa.Column("day", sa.String(10)), sa.Column("started", sa.DateTime), sa.Column("finished", sa.DateTime),
             sa.Column("limit_sec", sa.Integer), sa.Column("score", sa.Integer), sa.Column("total", sa.Integer),
             sa.Column("secs", sa.Integer))
groups = T("groups", sa.Column("id", BigInt, primary_key=True, autoincrement=True), sa.Column("name", sa.String(80)),
           sa.Column("teacher_id", sa.BigInteger, index=True), sa.Column("code", sa.String(8), unique=True),
           sa.Column("grade", sa.Integer))
members = T("members", sa.Column("group_id", sa.BigInteger, primary_key=True, autoincrement=False),
            sa.Column("user_id", sa.BigInteger, primary_key=True, autoincrement=False))
homework = T("homework", sa.Column("id", BigInt, primary_key=True, autoincrement=True),
             sa.Column("group_id", sa.BigInteger, index=True), sa.Column("title", sa.String(120)),
             sa.Column("topic_ids", sa.JSON), sa.Column("qids", sa.JSON), sa.Column("deadline", sa.String(10)),
             sa.Column("created", sa.DateTime))
duels = T("duels", sa.Column("id", BigInt, primary_key=True, autoincrement=True),
          sa.Column("code", sa.String(10), unique=True), sa.Column("grade", sa.Integer),
          sa.Column("p1", sa.BigInteger), sa.Column("p2", sa.BigInteger), sa.Column("qids", sa.JSON),
          sa.Column("s1", sa.Integer), sa.Column("t1", sa.Integer), sa.Column("s2", sa.Integer),
          sa.Column("t2", sa.Integer), sa.Column("open", sa.Boolean, default=False),
          sa.Column("status", sa.String(8), default="wait"), sa.Column("created", sa.DateTime))
reports = T("reports", sa.Column("id", BigInt, primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.BigInteger), sa.Column("qid", sa.BigInteger), sa.Column("text", sa.String(500)),
            sa.Column("status", sa.String(8), default="new"), sa.Column("ts", sa.DateTime))
badges = T("badges", sa.Column("user_id", sa.BigInteger, primary_key=True, autoincrement=False),
           sa.Column("code", sa.String(20), primary_key=True), sa.Column("ts", sa.DateTime))


kv = T("kv", sa.Column("k", sa.String(40), primary_key=True), sa.Column("v", sa.String(200)))

progress = T("progress", sa.Column("group_id", sa.BigInteger, primary_key=True, autoincrement=False),
             sa.Column("topic_ids", sa.JSON))   # har fan bo'yicha oxirgi o'tilgan mavzu
daily_sets = T("daily_sets", sa.Column("k", sa.String(40), primary_key=True), sa.Column("qids", sa.JSON))


def migrate():
    """Mavjud jadvallarga keyin qo'shilgan ustunlar."""
    insp = sa.inspect(engine)
    if "grade" not in {c["name"] for c in insp.get_columns("groups")}:
        with engine.begin() as c:
            c.execute(sa.text("ALTER TABLE groups ADD COLUMN grade INTEGER"))
    if "book" not in {c["name"] for c in insp.get_columns("users")}:
        with engine.begin() as c:
            c.execute(sa.text("ALTER TABLE users ADD COLUMN book VARCHAR(12)"))


def init(content_path):
    md.create_all(engine)
    migrate()
    seed(content_path)


def seed(content_path, force=False):
    """content/topics.json dagi savollarni bazaga yuklaydi. Mavjud savollar (admin tahrirlagan
    bo'lishi mumkin) o'zgartirilmaydi, faqat yangilari qo'shiladi."""
    if not os.path.exists(content_path):
        return 0
    data = json.load(open(content_path, encoding="utf-8"))
    added = 0
    with engine.begin() as c:
        have_t = {r[0] for r in c.execute(sa.select(topics.c.id))}
        have_q = {(r[0], r[1], r[2]) for r in c.execute(sa.select(questions.c.topic_id, questions.c.kind, questions.c.n))}
        rows = []
        for i, t in enumerate(data):
            if t["id"] not in have_t:
                c.execute(topics.insert().values(id=t["id"], subj=t["subj"], grade=t["grade"], num=t["num"],
                                                 title=t["title"][:300], ord=i))
            for kind, key in (("test", "tests"), ("match", "matches"), ("card", "cards")):
                for q in t[key]:
                    if (t["id"], kind, q["n"]) in have_q:
                        continue
                    d = {k: v for k, v in q.items() if k != "n"}
                    rows.append(dict(topic_id=t["id"], kind=kind, n=q["n"], data=d, active=True))
        for i in range(0, len(rows), 500):
            c.execute(questions.insert(), rows[i:i + 500])
        added = len(rows)
    return added
