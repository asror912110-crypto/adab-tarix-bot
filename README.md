# Adab School · Tarix boti

Tarix fanidan bilimni mustahkamlash uchun Telegram bot va Mini App.

- **Bot:** `/start`, telefon raqamini tasdiqlash, kunlik eslatma, vazifa va bellashuv xabarlari
- **Mini App:** kunlik topshiriq, imtihon rejimi, xatolar ustida ishlash, moslashtirish, savol-javob
  kartochkalari, bellashuv, reyting, yutuqlar, o‘qituvchi paneli, admin paneli

## Tuzilishi

| Papka | Vazifasi |
|---|---|
| `app/` | Server: API, Telegram bot, ma’lumotlar bazasi (FastAPI + SQLAlchemy) |
| `web/` | Mini App interfeysi (HTML/CSS/JS, yig‘ish bosqichisiz) |
| `content/topics.json` | PDF’lardan ajratib olingan barcha savollar |
| `content/media/` | Savollardagi rasmlar |
| `tools/` | PDF’dan savollarni ajratuvchi skriptlar |

## Ishga tushirish (bepul bulut: Render + Neon)

1. **GitHub.** Shu papkani yopiq (private) GitHub repozitoriyasiga yuklang.
2. **Baza.** [neon.tech](https://neon.tech) da bepul loyiha oching va `postgresql://...` ko‘rinishidagi
   ulanish manzilini nusxalang.
3. **Server.** [render.com](https://render.com) → *New → Web Service* → repozitoriyani tanlang
   (Docker avtomatik aniqlanadi, tarif: Free). *Environment* bo‘limiga quyidagilarni kiriting:

   | O‘zgaruvchi | Qiymat |
   |---|---|
   | `BOT_TOKEN` | @BotFather bergan token |
   | `DATABASE_URL` | Neon manzili |
   | `PUBLIC_URL` | Render bergan manzil, masalan `https://adab-tarix-bot.onrender.com` |
   | `ADMIN_IDS` | Admin(lar)ning Telegram ID si (botga `/id` yozsangiz ko‘rsatadi) |

4. Xizmat ishga tushgach bot o‘zi webhook va «Tarix» menyu tugmasini sozlaydi. Botga `/start` yozing.
5. **Uxlab qolmasligi uchun** (bepul tarif 15 daqiqa harakatsizlikdan keyin uxlaydi):
   [uptimerobot.com](https://uptimerobot.com) da `PUBLIC_URL/healthz` manzilini har 5 daqiqada
   tekshiradigan monitor qo‘shing. Shunda kunlik eslatmalar ham o‘z vaqtida ketadi.

O‘z serveringizda (VPS): `docker build -t tarix . && docker run -d --env-file .env -p 8000:8000 tarix`,
oldiga HTTPS (masalan Caddy) qo‘ying.

## Rollar

| Rol | Kim | Imkoniyat |
|---|---|---|
| Mehmon | Istalgan kishi | Kuniga `FREE_LIMIT` (20) ta savol |
| O‘quvchi | Telefoni ro‘yxatda bor | Cheklovsiz |
| O‘qituvchi | Admin tayinlaydi | Guruh, uyga vazifa, natijalar |
| Admin | `ADMIN_IDS` | Savollarni tahrirlash, rollar, ro‘yxat, shikoyatlar |

**O‘quvchilar ro‘yxati:** Admin paneli → «O‘quvchilar ro‘yxati» ga EduTizim’dan olingan telefon
raqamlarini joylashtiring. O‘quvchi botda «📱 Raqamni yuborish» tugmasini bossa, avtomatik tasdiqlanadi.

## Ball tizimi

Test — 10 ball, moslashtirishdagi har bir to‘g‘ri juftlik — 5, kunlik topshiriq — +30,
bellashuv g‘alabasi — +50. Kartochkalar (savol-javob) o‘zini sinash uchun — ball berilmaydi. Darajalar: Shogird → Tolib → Mirzo → Bek → Amir → Vazir → Sohibqiron.

Xatolar intervalli takrorlanadi: xato savol 1, 3 va 7 kundan keyin qayta so‘raladi; uch marta
to‘g‘ri javob berilgach ro‘yxatdan chiqadi.

## Yangi savollar qo‘shish

```bash
pip install pymupdf
python tools/build_db.py /papka/PDFlar   # content/topics.json va content/media/ ni yangilaydi
```

Server qayta ishga tushganda yangi savollar bazaga qo‘shiladi; mavjud (admin tahrirlagan) savollar
o‘zgarmaydi. PDF’lar hozirgi shablonda bo‘lishi kerak: `NN-mavzu_1_Test_kitobcha.pdf`,
`NN-mavzu_2_Savollar_varagi.pdf`, `NN-mavzu_3_Oqituvchi_kaliti.pdf`.

## Lokal sinov

```bash
pip install -r requirements.txt
DEV_AUTH=1 NO_TG=1 ADMIN_IDS=1 uvicorn app.main:app --port 8000
# brauzerda: http://localhost:8000/?dev=1
```
