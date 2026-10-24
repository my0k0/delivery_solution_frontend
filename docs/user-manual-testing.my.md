# Delivery Solution — လက်ဖြင့်စမ်းသပ်ခြင်း နှင့် တင်ဆက်မှု လမ်းညွှန်

**ဘာသာစကား:** မြန်မာ · [English version →](./user-manual-testing.en.md)
**အကျုံးဝင်မှု:** frontend ၏ မျက်နှာပြင်အားလုံး — local dev ပတ်ဝန်းကျင် (`http://localhost:5173` နှင့် `delivery_solution_api` `:3000`) တွင် စမ်းသပ်ရန်။
**အသုံးပြုပုံ:** အပိုင်း ၃ သည် တင်ဆက်သူ လုပ်ဆောင်ရမည့် အစီအစဉ် (run-sheet)၊ အပိုင်း ၄ သည် ပရိသတ်/အစမ်းသပ်သူ ကိုယ်တိုင်စမ်းသပ်ရန် checklist ဖြစ်သည်။ နှစ်ခုစလုံး တူညီသော ပတ်ဝန်းကျင်နှင့် အကောင့်များကို အသုံးပြုသည်။

> ၂၀၂၆ ခုနှစ် အောက်တိုဘာ ၂၄ ရက်နေ့ လည်ပတ်နေသော local stack ပေါ်တွင် စစ်ဆေးထားသည်။ အပိုင်း ၅ ရှိ အရေအတွက်များသည် ထိုအချိန်က **ဤ** ဒေတာဘေ့စ်၏ အခြေအနေဖြစ်ပြီး စမ်းသပ်မှု ပြုလုပ်သည်နှင့် ပြောင်းလဲသွားမည်။ စင်ပေါ်တွင် ကိန်းဂဏန်း ကိုးကားမည်ဆိုပါက ထပ်မံစစ်ဆေးပါ။

---

## ၁. ဘာကို သရုပ်ပြမည်နည်း

ကုမ္ပဏီတစ်ခု၏ ပို့ဆောင်ရေး လုပ်ငန်းစနစ်ကို မျက်နှာပြင် ၄ ခုဖြင့် ပြသမည်။

| မျက်နှာပြင် | အသုံးပြုသူ | သရုပ်ပြသည့်အချက် |
|---|---|---|
| ရုံးခန်း (`/dashboard`, `/orders`, `/rider-handovers`, `/shops`, `/customers`, `/riders`, `/townships`, `/partners`, `/users`, `/roles`, `/permissions`, `/reports/*`) | OWNER, ADMIN, OFFICER | အော်ဒါ လုပ်ငန်းစဉ်၊ ငွေကြေး ခြေရာခံမှု၊ အစီရင်ခံစာများ၊ ရာထူးအလိုက် ခွင့်ပြုချက် |
| Rider မျက်နှာပြင် (`/rider-board`, `/rider-dashboard`) | RIDER | ကိုယ်ပိုင် အော်ဒါများသာ၊ delivered တင်သွင်းခြင်း၊ commission နှင့် ကိုင်ထားရမည့် COD |
| ဆိုင် portal (`/shop`, `/shop/orders`, `/shop/statement`) | SHOP | ကိုယ့်ဆိုင် အော်ဒါနှင့် ငွေရှင်းလင်းမှုသာ၊ Rider/Partner အထောက်အထားနှင့် အတွင်းမှတ်ချက် မပါ |
| အကောင့်ဝင်ခြင်း (`/login`, `/settings/password`) | အားလုံး | session ပြန်လည်ရယူခြင်း၊ ခွင့်ပြုချက်အလိုက် menu၊ စကားဝှက်ပြောင်းလျှင် အတင်းထွက်ခြင်း |

အဓိက ပြောရမည့် ဇာတ်လမ်း — **Rider ပို့ပြီးသည်နှင့် အော်ဒါ မပြီးသေးပါ။ ရုံးမှ အတည်ပြုမှသာ ပြီးသည်။** အတည်ပြုခြင်းက မျှော်မှန်း COD ကို ဝင်ငွေအဖြစ် ပြောင်းလဲပေးပြီး၊ commission ကို pending မှ earned သို့ ရွှေ့ကာ၊ Rider ငွေပြန်အပ်မှုနှင့် ပိတ်သိမ်းမည့် ငွေစီးကြောင်းကို စတင်စေသည်။

---

## ၂. ပတ်ဝန်းကျင် နှင့် အကောင့်များ

### ၂.၁ စနစ်စတင်ခြင်း

```bash
# terminal 1 — ဒေတာဘေ့စ် + API
cd ../delivery_solution_api
docker compose up -d          # Postgres "healthy" ဖြစ်သည်အထိ စောင့်ပါ
pnpm db:migrate               # ဒေတာဘေ့စ် အသစ်ဖြစ်မှသာ လိုအပ်သည်
pnpm db:seed                  # ရာထူးများ၊ ခွင့်ပြုချက် ၄၆ ခု၊ owner နှင့် admin ၂ ဦး
pnpm db:seed:demo             # demo ဆိုင်များ၊ rider များ၊ ဖောက်သည်များ၊ township များ၊ partner များ၊ အော်ဒါ ၂၀
pnpm start:dev                # API :3000

# terminal 2 — frontend
cd ../delivery_solution_frontend
pnpm dev                      # http://localhost:5173
```

ကျန်းမာရေး စစ်ဆေးမှု —

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/v1/docs-json   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173                    # 200
```

### ၂.၂ အကောင့်များ

စမ်းသပ်စဉ် ပြောင်းထားခြင်း မရှိပါက seed အကောင့်အားလုံး၏ စကားဝှက်မှာ `Password1234` ဖြစ်သည်။

| အီးမေးလ် | ရာထူး | အသုံးပြုရန် |
|---|---|---|
| `owner@mail.com` | OWNER | အားလုံး၊ system ရာထူးဖြစ်ပြီး ခွင့်ပြုချက် ၄၆ ခုလုံး ရှိကာ ပြင်ဆင်၍ မရ |
| `admin1@mail.com` | ADMIN | Users, Roles, Permissions (OWNER/ADMIN အတန်းများကို မထိနိုင်) |
| `admin2@mail.com` | ADMIN | ဒုတိယ admin — "တစ်ချိန်တည်း နှစ်ဦး လုပ်ဆောင်ခြင်း" ပြရန် |
| `shop1@demo.delivery.local` | SHOP | ဆိုင် portal၊ Demo Shop One သာ |
| `shop2@demo.delivery.local` | SHOP | ဆိုင် portal၊ Demo Shop Two သာ |
| `shop3@demo.delivery.local` | SHOP | ဆိုင် portal၊ Demo Shop Three သာ |
| `rider1@demo.delivery.local` | RIDER | Rider မျက်နှာပြင်၊ ငွေပြန်အပ်ရန် လက်ကျန် ရှိသည် |
| `rider2@demo.delivery.local` | RIDER | Rider မျက်နှာပြင်၊ **လက်ရှိ ပို့ရန် အော်ဒါများ ဤသူ့တွင်ရှိသည်** |
| `finance@mail.com` | FINANCE | စမ်းသပ်စဉ် ဖန်တီးထားသော အကောင့်။ ခွင့်ပြုချက်များကို seed တွင် မသတ်မှတ်ထား — ခွင့်ပြုချက် မစစ်ဆေးဘဲ ဤအကောင့်ဖြင့် သရုပ်ပြခြင်း မပြုပါနှင့်။ |

- Seed တွင် **OFFICER အကောင့် မပါ**။ ခွင့်ပြုချက်အလိုက် menu ကန့်သတ်မှုကို ပြမည်ဆိုပါက **Users → New user** မှ ရာထူး `OFFICER` ဖြင့် ဖန်တီးပါ။
- Login မျက်နှာပြင်ရှိ `owner@delivery.local` သည် ဥပမာ စာသားသာဖြစ်သည်၊ အကောင့် မဟုတ်ပါ။ `owner@mail.com` ဟု ရိုက်ပါ။

### ၂.၃ ကြိုတင်ပြင်ဆင်မှု (စင်မတက်မီ ၁၀ မိနစ်)

| # | စစ်ဆေးရန် | အကြောင်းရင်း |
|---|---|---|
| ၁ | `owner@mail.com` ဖြင့် ဝင်ပြီး dashboard ပွင့်ခြင်း၊ KPI ကတ် ၅ ခုနှင့် chart ၄ ခု မြင်ရခြင်း | API + DB + session အားလုံး အလုပ်လုပ်ကြောင်း အတည်ပြု |
| ၂ | **Confirm deliveries စာမျက်နှာ ဗလာမဖြစ်ခြင်း** — "Queue is clear" ဖြစ်နေပါက `rider2` ဖြင့်ဝင်ပြီး **My deliveries** → အတန်းတစ်ခုတွင် `Submit delivered` နှိပ်ကာ အခြေအနေ ဖန်တီးပါ။ ပြီးလျှင် owner ဖြင့် ပြန်ဝင်ပါ | အတည်ပြုခြင်း သရုပ်ပြမှုသည် အဓိကဖြစ်ပြီး ဗလာ queue ဖြင့် မပြနိုင် |
| ၃ | `/orders` ဖွင့်ပြီး tracking code ၂–၃ ခုနှင့် status မှတ်ထားပါ | တင်ဆက်စဉ် ကိုးကားရန် |
| ၄ | `PENDING` အော်ဒါတစ်ခု ဖွင့်ပြီး **Assign / clear**, **Postpone**, **Cancel** ပေါ်ကြောင်း စစ်ပါ | Assignment သရုပ်ပြရန် `PENDING` အတန်း လိုသည် |
| ၅ | `/rider-handovers` ဖွင့်ပြီး rider နှစ်ဦးစလုံး ပမာဏများဖြင့် ပေါ်ကြောင်း စစ်ပါ | ငွေပြန်အပ်မှု သရုပ်ပြရန် |
| ၆ | `/reports/orders` မှ CSV တစ်ခု export လုပ်ပါ | ဒေါင်းလုဒ်လမ်းကြောင်းနှင့် `reports.export` စစ်ဆေးရန် |
| ၇ | ရာထူးတစ်ခုစီအတွက် browser profile ဒုတိယခု (သို့) incognito သုံးပါ | ထပ်ခါတလဲလဲ ထွက်ဝင်ရန် မလိုအပ် |
| ၈ | Browser zoom ကို 100% ထားပြီး devtools ပိတ်ပါ | Dialog အမြင့်ဆိုင်ရာ ပြဿနာများသည် မျက်နှာပြင် သေးငယ်မှသာ ပေါ်သည် |

**သရုပ်ပြမတိုင်မီ ဆုံးဖြတ်ရန်:** လက်ရှိ `AWAITING_APPROVAL` အော်ဒါ **၀** ခု ဖြစ်သည်။ Queue ဗလာဖြစ်နေပါက "Confirm deliveries" တွင် `Queue is clear` ပြမည်။ ရှင်းပြပါက မှန်ကန်သော အခြေအနေတစ်ခု ဖြစ်သော်လည်း အဓိက သရုပ်ပြမှုအဖြစ် အားနည်းသည်။

---

## ၃. တင်ဆက်သူ လုပ်ဆောင်ရမည့် အစီအစဉ် (၅၀ မိနစ်ခန့်၊ module အားလုံး)

အတန်းတစ်ခုစီ — **လုပ်ဆောင်ရန်** → **ပရိသတ် မြင်ရမည့်အရာ** → **ပြောရန်**။ အချိန်မလုံပါက အပိုင်း ၇ နှင့် ၉ ကို ဦးစွာ ဖြုတ်ပါ။

### ၃.၁ အဖွင့် — အကောင့်ဝင်ခြင်း နှင့် မျက်နှာပြင် (၂ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| `http://localhost:5173` ဖွင့်ပါ — `/login` သို့ ရောက်မည် | "Delivery Solution — Sign in to the operations console" ကတ် | "လမ်းကြောင်းတိုင်း authentication နောက်တွင် ရှိသည်။ စတင်ချိန်တွင် `GET /auth/me` ဖြင့် session ကို စစ်ဆေးသည်။" |
| `owner@mail.com` / `Password1234` ဖြင့် ဝင်ပါ | `/dashboard` သို့ ရောက်သည်၊ sidebar တွင် group အားလုံး ပေါ်သည် | "Sidebar သည် ခွင့်ပြုချက်မှ ထုတ်ယူထားသည်၊ hardcode မဟုတ်ပါ။ ဤသည် OWNER မြင်ကွင်း။" |

### ၃.၂ ရုံး dashboard (၅ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| KPI ကတ် ၅ ခုကို ကြည့်ပါ | Today's orders · Awaiting approval · COD to collect today · Fee income today · Delayed orders | "ဤကတ်နှစ်ခုသည် ယနေ့ လုပ်ဆောင်မှု မဟုတ်ဘဲ လက်ရှိ အခြေအနေ snapshot ဖြစ်သည် — awaiting approval နှင့် delayed orders။" |
| ရက်အပိုင်းအခြား ထိန်းချုပ်မှုကို ညွှန်ပါ (မူလက နောက်ဆုံး ၇ ရက်) | `From` / `To`၊ ပြောင်းလျှင် chart များ ပြန်လည် query လုပ်သည် | "Chart များသည် ရွေးထားသော entry-date အပိုင်းအခြားကို သုံးသည်၊ KPI အတန်းကမူ ယနေ့/snapshot အဓိပ္ပာယ်ကို ထိန်းထားသည်။ ဤကွာဟမှုသည် တမင်ရည်ရွယ်သည်။" |
| Chart ၄ ခုနှင့် pending-age bar ကို ဆွဲကြည့်ပါ | Status အလိုက် အော်ဒါ၊ fee income vs partner cost vs commission၊ top shops၊ township ရလဒ်၊ ပျမ်းမျှ pending အသက် | "Township success rate = delivered ÷ (delivered + cancelled) — cancelled အော်ဒါသည် township အတွက် ဆန့်ကျင်ဘက် အရေအတွက်ဖြစ်သည်။" |
| Bar တစ်ခုပေါ် hover လုပ်ပါ / legend ဖတ်ပါ | Tooltip နှင့် status အမည်များ ပါသော legend | "Chart များကို SVG ဖြင့် ကိုယ်တိုင်ရေးထားသည် — chart package မသုံး၊ ပြင်ပ ဒေတာ မရှိ။" |

**တင်ဆက်စဉ် သတိထားရန်:** ဤ dashboard ရှိ COD သည် **မျှော်မှန်း** ငွေဖြစ်သည်၊ လက်ခံရရှိပြီး ငွေ မဟုတ်ပါ။ ဤနေရာတွင် "collected" ဟု မပြောပါနှင့်။

### ၃.၃ အော်ဒါ — ဖန်တီးခြင်း၊ စစ်ထုတ်ခြင်း၊ ကြည့်ရှုခြင်း (၈ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| **Orders** သို့ သွားပါ | filter ၁၀ ခု၊ ဇယားတွင် Tracking / Status / Created / Est. delivery / COD / Shop settlement၊ အောက်တွင် pagination | "Search သည် tracking၊ အမည်၊ ဖုန်း၊ လိပ်စာ အားလုံးကို ရှာသည်။ Date basis က entry date နှင့် delivered date ကို ပြောင်းနိုင်သည်။" |
| `Status = PENDING`၊ ထို့နောက် `Shop advance = Advance still due` စစ်ထုတ်ပါ | အတန်းအရေအတွက် ပြောင်းသည်၊ အောက်တွင် `n orders · Page x of y` | "Filter များသည် server-side ဖြစ်ပြီး စာမျက်နှာကို အလိုအလျောက် ပထမစာမျက်နှာသို့ ပြန်ပို့သည်။" |
| **Create order** နှိပ်ပါ | Dialog — ဆိုင်၊ ဖောက်သည်၊ township၊ assignee အမျိုးအစား၊ ငွေပမာဏများ၊ ဆိုင်သို့ ပေးပြီးသည့် အမှတ်ခြစ်များ၊ လိပ်စာ၊ မှတ်ချက် | "Dialog သည် အတွင်းတွင်သာ scroll ဖြစ်သည် — footer ခလုတ်ကို အမြဲနှိပ်နိုင်သည်။" |
| Township တစ်ခု ရွေးပါ | Delivery fee၊ rider commission နှင့် ခန့်မှန်း ပို့ဆောင်ရက် အလိုအလျောက် ဖြည့်သည် | "Township သည် ငွေနှင့် ရက်သတ်မှတ်ချက် မူလတန်ဖိုးများကိုသာ ပေးသည်။ Assignee ကို မပေးပါ။" |
| Assignee အမျိုးအစား = Rider၊ `rider2` ရွေးပြီး သိမ်းပါ | အော်ဒါသည် **ASSIGNED** အဖြစ် ဖန်တီးသည်၊ toast ပြသည်၊ စာရင်း ပြန်လည် ဖြစ်သည် | "Assignee မရှိလျှင် PENDING။ Assignee ရှိလျှင် ASSIGNED။ Delivered အဖြစ် တိုက်ရိုက် ဖန်တီး၍ မရပါ။" |
| အော်ဒါအသစ်၏ အသေးစိတ် စာမျက်နှာ ဖွင့်ပါ | Tracking code + status badge၊ လုပ်ဆောင်ချက် ခလုတ်များ၊ ဆိုင်/ဖောက်သည်/township/assignee၊ ငွေ၊ ပါကင်/မှတ်ချက်၊ history အပိုင်းများ | "မည်သည့် မျက်နှာပြင်မှာမှ ကိုယ်ပိုင် id အကြမ်း မပြပါ — API က အမည်များကို server-side တွင် ဖြေရှင်းပေးသည်၊ အကြောင်းမှာ OFFICER တွင် shops/customers/riders read မရှိနိုင်သောကြောင့်။" |

### ၃.၄ Assignment၊ Rider တင်သွင်းခြင်း၊ အတည်ပြုခြင်း (၇ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| `ASSIGNED` အော်ဒါတွင် **Postpone** နှိပ်ပြီး အကြောင်းပြချက် ထည့်ပါ | Status သည် `PENDING` သို့ ပြန်သွားသည်၊ assignee ရှင်းသွားသည်၊ history အတန်း ထပ်တိုးသည်၊ toast ပြသည် | "Postpone လုပ်တိုင်း အော်ဒါသည် ခွဲဝေမထားသော အစုသို့ ပြန်ရောက်သည်။" |
| `PENDING` အော်ဒါတွင် **Assign / clear** → rider ရွေးပါ | Status `ASSIGNED`၊ history တွင် assignee ပြောင်းလဲမှု ပြသည် | "တူညီသော status သို့ ပြန်ခွဲဝေလျှင်ပင် history ရေးသည် — ပြန်ခွဲဝေမှုကို စစ်ဆေးနိုင်သည်။" |
| Browser profile ပြောင်း → `rider2` ဖြင့် ဝင်ပါ | `/rider-board`၊ "My deliveries" တွင် ကိုယ်ပိုင် `ASSIGNED` အော်ဒါများသာ | "Rider ၏ API သည် JWT မှ ကိုယ်တိုင်အတွက်သာ ကန့်သတ်သည်။ mine/all filter မရှိသဖြင့် မှားယွင်းနိုင်မည့်အရာ မရှိ။" |
| အတန်းတစ်ခုတွင် **Submit delivered** နှိပ်ပါ | အတန်း ပျောက်သွားသည်၊ toast "Delivery submitted for office approval" | "ဤသည် အော်ဒါကို AWAITING_APPROVAL သို့ ရွှေ့ပြီး ပို့ဆောင်ချိန်ကို မှတ်သည်။ ဝင်ငွေ မရသေးပါ။" |
| Owner ပြန်ဖြစ်ပြီး **Confirm deliveries** ဖွင့်ပါ | တင်သွင်းထားသော အော်ဒါသည် တင်ချိန်၊ assignee၊ COD to collect၊ Review ခလုတ်များနှင့် ပေါ်သည် | "ဤ queue က ပို့ဆောင်မှုကို အမှန်ဖြစ်စေသည်။" |
| **Approve** နှိပ်ပါ | Dialog "Approve delivered order?" → အတည်ပြု → status `DELIVERED`၊ toast | "အတည်ပြုခြင်းက commission ကို pending → earned၊ COD ကို expected → collected သို့ ပြောင်းသည်။ သို့သော် ငွေလက်ခံမှု မှတ်တမ်း မရေးပါ။" |
| နောက်အော်ဒါတစ်ခုကို `AWAITING_APPROVAL` ရောက်အောင် လုပ်ပြီး **Send back** — ဆိုင်မြင်ရမည့် အကြောင်းပြချက် + အတွင်းမှတ်ချက် | Status `ASSIGNED`၊ ဆိုင်က အကြောင်းပြချက်ကို မြင်သည်၊ အတွင်းမှတ်ချက်ကို ရုံးသာ မြင်သည် | "Send back သည် ပြင်ဆင်ရေး လမ်းကြောင်း၊ Rider ပြန်ကြိုးစားသည်။ Rider တွင် fail ခလုတ် မရှိပါ။" |

### ၃.၅ အော်ဒါ အသေးစိတ် — audit trail၊ terminal စည်းမျဉ်း၊ ဆိုင်သို့ ကြိုတင်ပေးငွေ (၅ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| `DELIVERED` အော်ဒါတစ်ခု ဖွင့်ပါ | **Edit order ခလုတ် မရှိ**၊ Approve/Send back လည်း မရှိ | "DELIVERED နှင့် CANCELLED သည် terminal — API က ပြင်ဆင်မှုကို 409 ဖြင့် ငြင်းသည်၊ ထို့ကြောင့် UI တွင် မကမ်းလှမ်းပါ။" |
| History အပိုင်းသို့ ဆွဲပါ | ပြောင်းလဲမှုတိုင်း လုပ်ဆောင်သူအမည်၊ မှတ်ချက်၊ အကြောင်းပြချက်ဖြင့် | "Status history ကို state service က ရေးသည်၊ client မဟုတ်ပါ။" |
| ဖွင့်နေသော အော်ဒါတွင် **Edit order** နှိပ်ပြီး delivery fee ပြောင်းပါ | Audit တွင် အိုဟောင်း → အသစ်၊ လုပ်ဆောင်သူ၊ အကြောင်းပြချက် ပြသည် | "ဖွင့်နေသော အော်ဒါ၏ ငွေပြင်ဆင်မှုကို အကွက်အလိုက် audit မှတ်သည်။" |
| Delivered အော်ဒါတွင် **Record advance** (`orders.shop_settlement` လိုသည်၊ delivered ဖြစ်လျှင် `orders.update_after_approval` + အကြောင်းပြချက်ပါ လိုသည်) | Shop advance အပိုင်းတွင် ပမာဏနှင့် ရက်စွဲ ပြသည်၊ shop settlement badge က `Paid`/`Partly paid` သို့ ပြောင်းသည် | "Advance သည် အတည်ပြုပြီးနောက် ငွေပြောင်းလဲမှု တစ်ခုတည်းဖြစ်ပြီး snapshot ယူထားသည် — လက်ဖြင့် ရိုက်ထည့်ခြင်း မဟုတ်ပါ။" |
| **Orders** သို့ ပြန်ပြီး Shop settlement ကော်လံ ဖတ်ပါ | `Paid`၊ `Partly paid · amount`၊ `Unpaid`၊ `Customer paid`၊ `Shop owes company · amount`၊ cancelled အတွက် `—` | "ဤကော်လံသည် အော်ဒါ အကွက်များမှ ထုတ်ယူထားသည်။ ငွေပေးချေမှု မှတ်တမ်း မဟုတ်ပါ။" |
| `PENDING`/`ASSIGNED` အော်ဒါတစ်ခုကို **Cancel** — အကြောင်းပြချက်ဖြင့် | Status `CANCELLED`၊ အကြောင်းပြချက် ပြသည်၊ ငွေစာရင်း စုစုပေါင်းများမှ ထွက်သွားသည် | "Cancelled တွင် ဖျက်သိမ်းခြင်းနှင့် ဆိုင်သို့ ပြန်ပို့ခြင်း နှစ်မျိုးလုံး ပါသည် — ပြန်အမ်းငွေ/reclaim လုပ်ငန်းစဉ်သည် Phase 2 ဖြစ်ပြီး မတည်ဆောက်ရသေးပါ။" |

### ၃.၆ Rider ငွေပြန်အပ်မှု (၅ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| **Rider handovers** ဖွင့်ပါ | "Outstanding balances" ဇယား — Rider / Delivered COD / Handed back / Outstanding / Oldest unsettled / Last handover၊ အောက်တွင် "Handover history" | "လက်ကျန်များသည် အချိန်အားလုံး စုစုပေါင်းဖြစ်သည် — delivered COD အနုတ် လက်ခံထားသမျှ။ ရက်အပိုင်းအခြား မဟုတ်ပါ။" |
| **Only riders who still owe** ကို ဖွင့်ပါ | လက်ကျန် ၀ ဖြစ်သော rider များ ပျောက်သည် | "အနုတ်လက်ကျန်လည်း မြင်နိုင်သည် — ကုမ္ပဏီက ငွေကိုင်ထားခြင်းသည် တကယ့် အခြေအနေဖြစ်သည်။" |
| Rider အတန်းရှိ မှတ်တမ်းတင်ခလုတ်ကို နှိပ်ပါ | Dialog — rider (ပိတ်ထား)၊ ပမာဏ၊ received on၊ received by၊ မှတ်ချက် | "မှတ်တမ်းတင်ခြင်းသည် rider ၏ အတန်းမှ စတင်သည်၊ ထို့ကြောင့် ပမာဏကို ထို rider ၏ လက်ကျန်နှင့် တိုက်စစ်နိုင်သည်။" |
| လက်ကျန်ထက် **ပိုသော** ပမာဏ ရိုက်ပြီး သိမ်းပါ | "Record more than this rider owes?" အတည်ပြု dialog — လက်ကျန်၊ ပမာဏ၊ ကွာဟမှု ဖော်ပြသည် | "ငြင်းမည့်အစား အတည်ပြုခိုင်းသည်။ သက်ဆိုင်ရာ အော်ဒါ မအတည်ပြုရသေးမီ ငွေ ရောက်လာနိုင်သည်။ ဤသတိပေးချက်က ရိုက်မှားမှုကို လက်ကျန်ကြီးထဲတွင် ဝှက်မထားစေရန် ဖြစ်သည်။" |
| အတည်ပြုပြီး history တွင် **Edit** နှိပ်၊ ပမာဏပြောင်း၊ အကြောင်းပြချက် မထည့်ဘဲ သိမ်းကြည့်ပါ | အကြောင်းပြချက် မထည့်မချင်း သိမ်း၍ မရ | "ပြင်ဆင်မှုသည် နေရာတွင်တင် ပြင်သည်၊ အကြောင်းပြချက် မဖြစ်မနေ လိုသည်၊ အကွက်အလိုက် audit ရေးသည်။ ဖျက်ခြင်း မရှိဟု တမင်ချန်ထားသည်။" |
| ပြင်ဆင်မှု သိမ်းပြီး audit trail ဖွင့်ပါ | ပြောင်းလဲသည့် အကွက်တိုင်း အိုဟောင်း → အသစ်၊ လုပ်ဆောင်သူ၊ အကြောင်းပြချက် | "ထပ်နေသော မှတ်တမ်းကို ဖျက်မည့်အစား 0.00 သို့ ပြင်သည် — အတန်းသည် history အဖြစ် ကျန်သည်။" |

### ၃.၇ အစီရင်ခံစာများ နှင့် export (၆ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| `/reports/orders` | အော်ဒါအလိုက် package price၊ fee၊ COD၊ net owed၊ shop advance၊ filter များ၊ `Export CSV` / `Export XLSX` | "ကိန်းဂဏန်းတိုင်းကို ဖတ်ချိန်တွင် အော်ဒါများမှ တွက်သည် — ledger ဇယား မရှိပါ။" |
| `/reports/shop-statement` → ဆိုင်တစ်ခု ရွေးပါ | status အရေအတွက်၊ package/fee စုစုပေါင်း၊ COD collected နှင့် expected၊ net owed delivered/pending၊ advanced to shop | "ဤစာမျက်နှာရှိ သတိပေးချက်ကို အသံထွက်ဖတ်ပါ — net owed သည် အနုတ်ဖြစ်နိုင်သည်၊ advance များကို advance ရက်စွဲဖြင့် ရေတွက်သည်၊ COD သည် မျှော်မှန်းချက်သာ ဖြစ်သည်။" |
| `/reports/rider-collection` | Rider အလိုက်၊ ရက်အလိုက် — delivered အော်ဒါ၊ awaiting approval အော်ဒါ၊ ပြန်အပ်ရမည့် မျှော်မှန်း COD | "ဤသည် rider ကိုင်ထားသင့်သည့် ငွေကို ပြသည် — handover က အမှန်တကယ် ပြန်အပ်သည်ကို မှတ်သည်။" |
| `/reports/rider-payout` | Rider တစ်ဦးလျှင် အတန်းတစ်ခု — delivered အော်ဒါ၊ earned၊ pending approval | "Commission သည် အော်ဒါအလိုက်၊ pending = အတည်ပြုရန် စောင့်ဆဲ၊ earned = ပို့ပြီး။" |
| CSV တစ်ခု export လုပ်ပြီး ဖွင့်ပါ | ဖိုင် ဒေါင်းလုဒ်ကျသည်၊ toast "CSV download started" | "Export ကို reports.export ဖြင့် ကန့်သတ်သည် — မရှိသူတွင် ခလုတ် မပေါ်ပါ။" |

### ၃.၈ ဆိုင် portal — တူညီသော အော်ဒါကို ဆိုင်ဘက်မှ ကြည့်ခြင်း (၅ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| Profile အသစ် → `shop1@demo.delivery.local` | `/shop` သို့ ရောက်သည်၊ အပေါ်တွင် Overview / Orders / Statement၊ ကိုယ့်ဆိုင်သာ | "ဆိုင် အတိုင်းအတာကို server က အသုံးပြုသူ၏ shopId မှ သတ်မှတ်သည်၊ query parameter မှ မဟုတ်ပါ။" |
| `/shop/orders` → အော်ဒါတစ်ခု ဖွင့်ပါ | အော်ဒါ အသေးစိတ်၊ ငွေပမာဏ၊ ဖောက်သည်၊ township၊ လိပ်စာ၊ history | "Rider/Partner အထောက်အထား မပါ၊ partner cost မပါ၊ အတွင်းမှတ်ချက် မပါ။" |
| Status ဝေါဟာရကို ညွှန်ပါ | `Received` / `Out for delivery` / `Delivered` / `Cancelled` | "ဆိုင်ဘက် ဝေါဟာရသည် အတွင်းပိုင်း status များနှင့် တမင်ကွဲပြားသည်။" |
| `/shop/statement` → အပိုင်းအခြား ရွေးပြီး export လုပ်ပါ | status အရေအတွက် + ငွေရှင်းလင်းမှု စုစုပေါင်း၊ CSV/XLSX | "ဆိုင်သည် ကိုယ့် ငွေရှင်းလင်းမှု ခန့်မှန်းချက်ကိုသာ မြင်သည် — အခြားဆိုင်ကို မဟုတ်၊ rider ငွေကို မဟုတ်။" |

### ၃.၉ စီမံခန့်ခွဲမှု နှင့် ခွင့်ပြုချက် (RBAC) (၇ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| Owner အနေဖြင့် **Users** → **New user**၊ ရာထူး `OFFICER` | အသုံးပြုသူ ဖန်တီးပြီး စာရင်းတွင် ပေါ်သည် | "ရာထူးများသည် ဒေတာ၊ code မဟုတ်ပါ။ OFFICER သည် လုပ်ငန်း ရာထူး။" |
| **Roles** → **New role** (`MANAGER` စသဖြင့်) | အတန်း ပေါ်သည်၊ Type `Standard`၊ OWNER တွင် `System` နှင့် lock | "ဖန်တီးပြီးနောက် ရာထူးအမည် ပြောင်း၍ မရပါ၊ ဖော်ပြချက်သာ ပြင်နိုင်သည်။" |
| **Permissions** → `MANAGER` ရွေးပါ | Module ၁၄ ခု × တကယ့် action များ၊ `Select all`၊ `Save changes` သည် ပြောင်းမှသာ အသက်ဝင်သည် | "ခွင့်ပြုချက် ၄၆ ခု၊ module တစ်ခုစီတွင် တကယ် ကာကွယ်ထားသော action များသာ။ endpoint မရှိသော key မရှိပါ။" |
| `orders.read` + `orders.update` သာ ပေးပြီး သိမ်းပါ | Toast "Permissions updated" | "`PUT` သည် ခွင့်ပြုချက် အစုတစ်ခုလုံးကို အစားထိုးသည်။" |
| `OWNER` ရွေးပါ | Grid အားလုံး အမှန်ခြစ်ထား၊ ပြင်၍ မရ၊ system-role မှတ်ချက် ပြသည် | "System ရာထူးသည် အားလုံးကို ကိုင်ထားပြီး grant အတန်း သုည ရှိသည် — `isSystem` မှ ဖတ်ပါ၊ grants endpoint မှ မဟုတ်ပါ။" |
| OFFICER အသစ် (သို့) `admin1` ဖြင့် ဝင်ပါ | Sidebar တွင် Shops/Customers/Riders/Users/Roles မပေါ်၊ ခွင့်ပြုထားသည့် နေရာများသာ | "UI က API ကို ထင်ဟပ်သည်။ ဖျောက်ခြင်းက အဆင်ပြေရေးသာ၊ API က အစစ်အမှန် ကန့်သတ်ချက်။" |
| OFFICER အနေဖြင့် ခွင့်မပြုထားသော URL ကို တိုက်ရိုက် ရိုက်ပါ (`/users`) | **403 စာမျက်နှာ** "Back to dashboard" ဖြင့် | "လင့် ဖျောက်ထားခြင်းသာ မဟုတ်၊ လမ်းကြောင်း အဆင့် ကန့်သတ်ချက်။" |
| ADMIN အနေဖြင့် **Roles** ဖွင့်ပါ | OWNER နှင့် ADMIN အတန်းများ ဖတ်သာ၊ ကိုယ့်ရာထူးလည်း ဖတ်သာ | "ADMIN သည် ကိုယ့်ကိုယ်ကို တိုးမြှင့်ခွင့် မရှိ၊ system ရာထူးကို မပြင်နိုင်။" |

### ၃.၁၀ စကားဝှက် ပြောင်းခြင်း နှင့် နိဂုံး (၃ မိနစ်)

| လုပ်ဆောင်ရန် | မြင်ရမည့်အရာ | ပြောရန် |
|---|---|---|
| `/settings/password` → လက်ရှိ စကားဝှက် မှားထည့်ပါ | Inline error၊ session မပြောင်း | "Server ဘက်တွင် စစ်ဆေးသည်။" |
| စကားဝှက် အောင်မြင်စွာ ပြောင်းပါ | Toast "Password changed. Please sign in again." → `/login` သို့ အတင်းပို့ | "Backend က token အဟောင်းများကို ပယ်ဖျက်သည်၊ ထို့ကြောင့် frontend က အတင်းထွက်ပေးရသည်။" |

> **Seed အကောင့်တစ်ခုတွင် စကားဝှက်ပြောင်းခြင်းကို တကယ် သရုပ်ပြပါက ချက်ချင်း ပြန်ပြောင်းထားပါ (သို့) ပြန်လည် seed လုပ်ပါ။** မဟုတ်ပါက နောက် တင်ဆက်သူ ဝင်၍ မရတော့ပါ။

---

## ၄. အစမ်းသပ်သူ checklist (module အားလုံး)

ကော်လံများ — **ID**၊ **လုပ်ဆောင်ရန်**၊ **မျှော်မှန်းချက်**၊ **ရလဒ်**။ `☐ Pass ☐ Fail` ဟု အမှတ်ခြစ်ပါ။ မအောင်မြင်ပါက အောက်ပါအချက်များ ပါဝင်စွာ တင်ပြပါ — module၊ အကောင့်၊ tracking code / record id၊ မျှော်မှန်းချက်နှင့် တကယ်ဖြစ်ခဲ့သည့်အရာ၊ screenshot၊ မအောင်မြင်သော request ၏ status code။

### ၄.၁ အကောင့်ဝင်ခြင်း နှင့် session

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| AUTH-01 | မဝင်ထားဘဲ `/` သို့ သွားပါ | `/login` သို့ ပြန်ပို့သည် | ☐ Pass ☐ Fail |
| AUTH-02 | `owner@mail.com` / စကားဝှက် မှားဖြင့် ဝင်ပါ | Inline error၊ session မဖန်တီး၊ login တွင်သာ ကျန်သည် | ☐ Pass ☐ Fail |
| AUTH-03 | မှန်ကန်သော အကောင့်ဖြင့် ဝင်ပါ | `/dashboard` သို့ ရောက်သည်၊ sidebar ပြည့်စုံသည် | ☐ Pass ☐ Fail |
| AUTH-04 | စာမျက်နှာ reload လုပ်ပါ | Session ပြန်လည်ရယူသည် (`/auth/me`)， login သို့ ပြန်မတွန်းပါ | ☐ Pass ☐ Fail |
| AUTH-05 | `rider1@demo.delivery.local` ဖြင့် ဝင်ပါ | `/rider-board` သို့ ရောက်သည်၊ ရုံး နေရာများ မပေါ် | ☐ Pass ☐ Fail |
| AUTH-06 | `shop1@demo.delivery.local` ဖြင့် ဝင်ပါ | `/shop` သို့ ရောက်သည်၊ ရုံး/rider နေရာများ မရှိ | ☐ Pass ☐ Fail |
| AUTH-07 | အပေါ် menu မှ ထွက်ပါ | Session ရှင်းသည်၊ `/login` သို့ ပြန်ရောက်သည်၊ back ခလုတ်ဖြင့် app ပြန်မဝင်နိုင် | ☐ Pass ☐ Fail |

### ၄.၂ ရုံး dashboard

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| DASH-01 | Owner အနေဖြင့် `/dashboard` ဖွင့်ပါ | KPI ကတ် ၅ ခု တကယ့် ကိန်းဂဏန်းများဖြင့် ပေါ်သည် | ☐ Pass ☐ Fail |
| DASH-02 | KPI အမည်များ ဖတ်ပါ | Today's orders, Awaiting approval, COD to collect today, Fee income today, Delayed orders | ☐ Pass ☐ Fail |
| DASH-03 | `From`/`To` ကို ရက် ၃၀ အတွင်း ပြောင်းပါ | Chart ၄ ခုနှင့် pending age ပြန်လည် query၊ ရွေးထားသော အပိုင်းအခြား မြင်နေရသည် | ☐ Pass ☐ Fail |
| DASH-04 | `From` ကို `To` ထက် နောက်ကျအောင် ထားပါ | "The start date must not be after the end date." ပြသည်၊ query error banner မပေါ် | ☐ Pass ☐ Fail |
| DASH-05 | Chart တစ်ခုစီကို ဖတ်ပါ | Status အလိုက် အော်ဒါ၊ fee vs partner cost vs commission၊ top shops၊ township ရလဒ် — label/legend ပြည့်စုံ | ☐ Pass ☐ Fail |
| DASH-06 | OFFICER ဖြင့် `/dashboard` ဖွင့်ပါ | ပွင့်သည် (OFFICER တွင် `reports.read` ရှိ) | ☐ Pass ☐ Fail |
| DASH-07 | SHOP ဖြင့် `/dashboard` ကြိုးစားပါ | မရ — ဆိုင် portal သို့ ပြန်ပို့သည် | ☐ Pass ☐ Fail |

### ၄.၃ အော်ဒါ — စာရင်းနှင့် filter

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| ORD-01 | `/orders` ဖွင့်ပါ | ဇယားတွင် Tracking, Status, Created, Est. delivery, COD to collect, Shop settlement | ☐ Pass ☐ Fail |
| ORD-02 | **Search** တွင် tracking code ရိုက်ပါ | ထို အော်ဒါသာ ကျန်သည်၊ စာမျက်နှာ ၁ သို့ ပြန်သည် | ☐ Pass ☐ Fail |
| ORD-03 | Status `PENDING` စစ်ထုတ်ပါ | Pending အော်ဒါများသာ၊ footer အရေအတွက် ကိုက်ညီသည် | ☐ Pass ☐ Fail |
| ORD-04 | Shop + Township + Assignee ကို တွဲစစ်ပါ | အားလုံး တစ်ပြိုင်နက် သက်ရောက်သည်၊ မကိုက်ညီပါက empty state | ☐ Pass ☐ Fail |
| ORD-05 | `Shop advance = Advance still due` စစ်ထုတ်ပါ | ကြိုတင်ပေးငွေ မမှတ်ထားသော၊ package မပေးရသေးသော အော်ဒါများသာ | ☐ Pass ☐ Fail |
| ORD-06 | **Date basis** ကို `Delivered date` သို့ ပြောင်းပါ | ရွေးထားသည့် ကာလအတွင်း ပို့ပြီးသော အော်ဒါများ ပြသည် | ☐ Pass ☐ Fail |
| ORD-07 | ရှေ့/နောက် စာမျက်နှာ ရွှေ့ပါ | `Previous`/`Next` သည် `meta` အတိုင်း၊ ပထမ/နောက်ဆုံး စာမျက်နှာတွင် ပိတ်သည် | ☐ Pass ☐ Fail |
| ORD-08 | Shop settlement badge များ ဖတ်ပါ | Paid / Partly paid + ပမာဏ / Unpaid / Customer paid / Shop owes company + ပမာဏ / cancelled တွင် `—` | ☐ Pass ☐ Fail |
| ORD-09 | tracking code ကို နှိပ်ပါ | `/orders/:id` အသေးစိတ် ပွင့်သည် | ☐ Pass ☐ Fail |

### ၄.၄ အော်ဒါ — ဖန်တီးခြင်းနှင့် ပြင်ဆင်ခြင်း

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| ORD-10 | **Create order**၊ လိုအပ်သော အကွက်များ ဖြည့်ပြီး သိမ်းပါ | ဖန်တီးပြီး၊ toast ပြ၊ စာရင်း ပြန်လည် | ☐ Pass ☐ Fail |
| ORD-11 | Township မရွေးဘဲ ဖန်တီးပါ | သိမ်းသည်၊ fee/commission/ခန့်မှန်းရက် မူလတန်ဖိုးတွင် ကျန်သည် | ☐ Pass ☐ Fail |
| ORD-12 | Township ရွေးပြီး ဖန်တီးပါ | Delivery fee၊ commission၊ ခန့်မှန်းရက် အလိုအလျောက် ဖြည့်သည် | ☐ Pass ☐ Fail |
| ORD-13 | Assignee မပါဘဲ ဖန်တီးပါ | Status `PENDING` | ☐ Pass ☐ Fail |
| ORD-14 | Rider ဖြင့် ဖန်တီးပါ | Status `ASSIGNED`၊ assignee အမည် ပြသည် | ☐ Pass ☐ Fail |
| ORD-15 | Partner ဖြင့် ဖန်တီးပါ | `partnerFee`/`partnerTrackingNo` သက်ဆိုင်လာသည်၊ commission ကို `0.00` သို့ အတင်းသတ်မှတ်သည် | ☐ Pass ☐ Fail |
| ORD-16 | **Package price paid** / **Delivery fee paid** ကို အမှတ်ခြစ်ပြီး COD preview ကြည့်ပါ | COD preview သည် ပေးပြီးသော အပိုင်းအတိုင်း လျော့သည် | ☐ Pass ☐ Fail |
| ORD-17 | အနုတ်ပမာဏ (သို့) ကိန်းမဟုတ်သော စာသား ထည့်ပါ | အကွက် error ပြ၊ သိမ်း၍ မရ | ☐ Pass ☐ Fail |
| ORD-18 | ဖန်တီး dialog ကို ရိုက်နေရင်းပိတ်၊ ပြန်ဖွင့်ပါ | အကွက်များ ပြန်လည် သတ်မှတ်သည်၊ error banner အဟောင်း မကျန် | ☐ Pass ☐ Fail |
| ORD-19 | ဖွင့်နေသော အော်ဒါ၏ fee ကို ပြင်ပါ | သိမ်းသည်၊ audit တွင် အိုဟောင်း → အသစ် + လုပ်ဆောင်သူ + အကြောင်းပြချက် | ☐ Pass ☐ Fail |
| ORD-20 | ဖွင့်နေသော အော်ဒါ၏ township ပြောင်းပါ | လက်ရှိငွေ ထိန်းမလား / township မူလတန်ဖိုး သုံးမလား မေးသည်၊ assignee မထိခိုက် | ☐ Pass ☐ Fail |
| ORD-21 | `DELIVERED` (သို့) `CANCELLED` အော်ဒါ ဖွင့်ပါ | **Edit order ခလုတ် မရှိ** | ☐ Pass ☐ Fail |
| ORD-22 | ရှည်သော form တွင် အမြင့် ~700px အောင် ချုံ့ပါ | Dialog အတွင်းသာ scroll ဖြစ်သည်၊ submit ခလုတ်ကို အမြဲနှိပ်နိုင် | ☐ Pass ☐ Fail |

### ၄.၅ အော်ဒါ လုပ်ငန်းစဉ် လုပ်ဆောင်ချက်များ

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| LIFE-01 | `PENDING` အော်ဒါကို rider သို့ ခွဲဝေပါ | Status `ASSIGNED`၊ history တွင် assignee မှတ်သည် | ☐ Pass ☐ Fail |
| LIFE-02 | အခြား rider သို့ ပြန်ခွဲဝေပါ | `ASSIGNED` အတိုင်း၊ history အတန်းအသစ် ပေါ်သည် | ☐ Pass ☐ Fail |
| LIFE-03 | Assignee ကို ရှင်းပါ | Status `PENDING` သို့ ပြန်၊ history "Order unassigned" | ☐ Pass ☐ Fail |
| LIFE-04 | `ASSIGNED` အော်ဒါကို အကြောင်းပြချက်ဖြင့် postpone လုပ်ပါ | Status `PENDING`၊ assignee ရှင်း၊ အကြောင်းပြချက် သိမ်း | ☐ Pass ☐ Fail |
| LIFE-05 | `PENDING` အော်ဒါကို အကြောင်းပြချက်ဖြင့် cancel လုပ်ပါ | Status `CANCELLED`၊ အကြောင်းပြချက် မြင်ရ၊ terminal | ☐ Pass ☐ Fail |
| LIFE-06 | `CANCELLED` အော်ဒါတွင် လုပ်ဆောင်ချက်အားလုံး ကြိုးစားပါ | ခလုတ်တစ်ခုမှ မကမ်းလှမ်း | ☐ Pass ☐ Fail |
| LIFE-07 | Partner အော်ဒါ ခွဲဝေပြီး **Mark delivered** နှိပ်ပါ | Dialog "Mark partner order delivered?" → တိုက်ရိုက် `DELIVERED`၊ အတည်ပြု အဆင့် မလို | ☐ Pass ☐ Fail |
| LIFE-08 | Tab တစ်ခုတွင် rider delivery တင်ပြီး အခြားတစ်ခုတွင် approve လုပ်ပါ | တစ်ခု အောင်မြင်၊ အခြားတစ်ခု 409 toast ("not in status …")၊ history နှစ်ခါ မရေး | ☐ Pass ☐ Fail |
| LIFE-09 | အော်ဒါ၏ history အပိုင်း ဖတ်ပါ | လုပ်ဆောင်သူအမည်၊ မှတ်ချက်၊ အကြောင်းပြချက်၊ အတွင်းမှတ်ချက် (ရုံးသာ) | ☐ Pass ☐ Fail |

### ၄.၆ ပို့ဆောင်မှု အတည်ပြုခြင်း (approval queue)

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| APPR-01 | Rider တစ်ဦး delivery တင်ပြီး `/orders/approval` ဖွင့်ပါ | အော်ဒါသည် Tracking, Submitted, Assignee, COD to collect, Review ဖြင့် ပေါ်သည် | ☐ Pass ☐ Fail |
| APPR-02 | Queue ၏ ဖော်ပြချက် ဖတ်ပါ | COD ကို rider ထံမှ ပြန်ရမည့် မျှော်မှန်းငွေအဖြစ် ရေတွက်ကြောင်း ရှင်းပြသည် | ☐ Pass ☐ Fail |
| APPR-03 | **Approve** နှိပ်ပါ | Dialog "Approve delivered order?" → အတည်ပြု → `DELIVERED`，toast "Delivery approved"，အတန်း ထွက်သွား | ☐ Pass ☐ Fail |
| APPR-04 | အကြောင်းပြချက် + အတွင်းမှတ်ချက်ဖြင့် **Send back** | Dialog "Send order back" → `ASSIGNED`，toast，အတန်း ထွက်သွား | ☐ Pass ☐ Fail |
| APPR-05 | ပြန်ပို့ထားသော အော်ဒါကို ဆိုင်အကောင့်ဖြင့် ဖွင့်ပါ | ဆိုင်မြင်ရမည့် အကြောင်းပြချက် ပြသည်၊ အတွင်းမှတ်ချက် **မပြ** | ☐ Pass ☐ Fail |
| APPR-06 | တင်သွင်းမှု မရှိဘဲ queue ဖွင့်ပါ | "Queue is clear" empty state၊ error မရှိ | ☐ Pass ☐ Fail |
| APPR-07 | `deliveries.approve` မရှိသူဖြင့် ဝင်ပါ | Confirm deliveries menu မပေါ်၊ Approve/Send back ခလုတ် မရှိ | ☐ Pass ☐ Fail |

### ၄.၇ Rider မျက်နှာပြင်

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| RDR-01 | `rider2` ဖြင့် **My deliveries** ဖွင့်ပါ | ကိုယ်ပိုင် `ASSIGNED` အော်ဒါများသာ၊ ကော်လံ — Tracking, Customer, Delivery address, Township, COD to collect, Action | ☐ Pass ☐ Fail |
| RDR-02 | Delivery တင်ပါ | အတန်း ပျောက်၊ toast "Delivery submitted for office approval" | ☐ Pass ☐ Fail |
| RDR-03 | အော်ဒါ မရှိသော `rider1` ဖြင့် ဝင်ပါ | "No assigned orders" empty state၊ ရုံးဒေတာ မပါ | ☐ Pass ☐ Fail |
| RDR-04 | Rider အနေဖြင့် `/orders` သို့ ကြိုးစားပါ | 403 စာမျက်နှာ၊ ဗလာ အော်ဒါစာရင်း မဟုတ် | ☐ Pass ☐ Fail |
| RDR-05 | **My dashboard** ဖွင့်ပါ | ယနေ့/ဤအပတ်/ဤလ delivered၊ commission earned၊ commission pending approval၊ COD to hand back၊ ရက်အလိုက် chart | ☐ Pass ☐ Fail |
| RDR-06 | Dashboard ၏ pending ကိန်းကို `AWAITING_APPROVAL` အော်ဒါနှင့် နှိုင်းယှဉ်ပါ | Pending commission တွင် ပါသည်၊ approve လုပ်လျှင် earned သို့ ရွှေ့သည် | ☐ Pass ☐ Fail |
| RDR-07 | Rider မျက်နှာပြင်တွင် အခြား rider/partner အထောက်အထား ရှိမရှိ စစ်ပါ | ကိုယ်ပိုင် အထောက်အထားသာ၊ လုပ်ဖော်ကိုင်ဖက် ဒေတာ မပါ | ☐ Pass ☐ Fail |

### ၄.၈ Rider ငွေပြန်အပ်မှု

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| HND-01 | `/rider-handovers` ဖွင့်ပါ | "Outstanding balances" နှင့် "Handover history" နှစ်ပိုင်းလုံး ပေါ်သည် | ☐ Pass ☐ Fail |
| HND-02 | လက်ကျန်အတန်း ဖတ်ပါ | Rider, Delivered COD, Handed back, Outstanding, Oldest unsettled delivery, Last handover | ☐ Pass ☐ Fail |
| HND-03 | Rider တစ်ဦး၏ တွက်ချက်မှု စစ်ပါ | Outstanding = Delivered COD − Handed back (ဒသမ တိကျစွာ) | ☐ Pass ☐ Fail |
| HND-04 | **Only riders who still owe** ဖွင့်ပါ | လက်ကျန် ၀ သူများ ထွက်၊ အနုတ်လက်ကျန် ကျန်သည် | ☐ Pass ☐ Fail |
| HND-05 | Rider အမည်ဖြင့် ရှာပါ | စာရင်း စစ်ထုတ်သည် | ☐ Pass ☐ Fail |
| HND-06 | လက်ကျန်ထက် **နည်း** သော ပမာဏ မှတ်တမ်းတင်ပါ | အတည်ပြုချက် မလိုဘဲ သိမ်းသည်၊ လက်ကျန် လျော့သည် | ☐ Pass ☐ Fail |
| HND-07 | လက်ကျန်ထက် **ပို** သော ပမာဏ မှတ်တမ်းတင်ပါ | လက်ကျန်၊ ပမာဏ၊ ကွာဟမှု ဖော်ပြသော အတည်ပြု dialog၊ ပယ်ဖျက်လျှင် မသိမ်း | ☐ Pass ☐ Fail |
| HND-08 | ပိုသော ပမာဏကို အတည်ပြုပါ | သိမ်းသည်၊ လက်ကျန် အနုတ်ဖြစ် ("ကုမ္ပဏီက ငွေကိုင်ထား") | ☐ Pass ☐ Fail |
| HND-09 | အနာဂတ် **Received on** ထည့်ပါ | အကွက် error ဖြင့် ပိတ်သည် | ☐ Pass ☐ Fail |
| HND-10 | ပမာဏ `0` (သို့) ဗလာ ထည့်ပါ | အကွက် error ဖြင့် ပိတ်သည် | ☐ Pass ☐ Fail |
| HND-11 | လက်ခံနည်းလမ်း အားလုံး (KPAY / CASH / BANK TRANSFER) စမ်းပါ | အားလုံး လက်ခံပြီး history တွင် ပြသည် | ☐ Pass ☐ Fail |
| HND-12 | မှတ်တမ်းကို Edit လုပ်ပြီး ပမာဏပြောင်း၊ အကြောင်းပြချက် မထည့်ပါ | အကြောင်းပြချက် မထည့်မချင်း သိမ်း၍ မရ | ☐ Pass ☐ Fail |
| HND-13 | ပြင်ဆင်မှု သိမ်းပြီး audit trail ဖွင့်ပါ | အကွက်တိုင်း အိုဟောင်း → အသစ်၊ လုပ်ဆောင်သူ၊ အကြောင်းပြချက် | ☐ Pass ☐ Fail |
| HND-14 | မှတ်တမ်းတွင် ဖျက်ခြင်း ရှိမရှိ ရှာပါ | မရှိ — ပြင်ဆင်ခြင်းသာ | ☐ Pass ☐ Fail |
| HND-15 | ပြင်ဆင်မှု မရှိသော မှတ်တမ်း ဖွင့်ပါ | "No corrections — this handover reads as it was recorded." | ☐ Pass ☐ Fail |
| HND-16 | History ကို rider၊ နည်းလမ်း၊ ရက်အပိုင်းအခြားဖြင့် စစ်ထုတ်ပါ | ကိုက်ညီသော အတန်းများ၊ Reset က ရှင်းသည် | ☐ Pass ☐ Fail |
| HND-17 | `rider-handovers.update` မရှိသူဖြင့် ဝင်ပါ | History အတန်းများတွင် Edit မပေါ် | ☐ Pass ☐ Fail |

### ၄.၉ ဆိုင်များ နှင့် ဖောက်သည်များ

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| DIR-01 | `/shops` → **New shop** — အမည်၊ channel၊ channel name၊ ဖုန်း၊ လိပ်စာ | ဖန်တီးပြီး၊ toast ပြ၊ စာရင်း ပြန်လည် | ☐ Pass ☐ Fail |
| DIR-02 | အမည်/ဖုန်း/channel ဖြင့် ရှာ၊ channel ဖြင့် စစ်ထုတ် | ကိုက်ညီသူများသာ၊ Reset က ရှင်းသည် | ☐ Pass ☐ Fail |
| DIR-03 | ဆိုင် ပြင်ပါ | ပြောင်းလဲမှု ကျန်သည်၊ toast "Shop updated" | ☐ Pass ☐ Fail |
| DIR-04 | အော်ဒါ မရှိသော ဆိုင် ဖျက်ပါ | အတည်ပြု dialog ပြီး ဖျက်သည် | ☐ Pass ☐ Fail |
| DIR-05 | အော်ဒါ ရှိနေသော ဆိုင် ဖျက်ပါ | Backend message (409) ဖြင့် ငြင်း၊ အတန်း ကျန် | ☐ Pass ☐ Fail |
| DIR-06 | `/customers` → ဖန်တီး၊ ပြင်၊ ဖျက် | အလားတူ၊ ဇယားတွင် Name, Phone, Address, Created | ☐ Pass ☐ Fail |
| DIR-07 | အော်ဒါက ကိုးကားနေသော ဖောက်သည် ဖျက်ပါ | Backend message ဖြင့် ငြင်း | ☐ Pass ☐ Fail |

### ၄.၁၀ Rider၊ Township၊ Partner

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| SET-01 | `/riders` → **New rider** (အကောင့် + profile အပိုင်း) | RIDER အဖြစ် ဖန်တီးပြီး ပေးထားသော စကားဝှက်ဖြင့် ဝင်နိုင်သည် | ☐ Pass ☐ Fail |
| SET-02 | ဖန်တီးရာတွင် အီးမေးလ်/စကားဝှက် ဗလာထား | Inline error၊ သိမ်း၍ မရ | ☐ Pass ☐ Fail |
| SET-03 | Rider ကို `INACTIVE` ပြောင်း | Status badge ပြောင်း၊ အော်ဒါ form ၏ rider စာရင်းတွင် မပါ (ခွဲဝေ၍ မရ) | ☐ Pass ☐ Fail |
| SET-04 | `/townships` → delivery fee၊ rider commission၊ lead time ဖြင့် ဖန်တီး | သိမ်းသည်၊ ဇယားတွင် Township, Default delivery fee, Rider commission, Lead time | ☐ Pass ☐ Fail |
| SET-05 | Lead time တွင် ကိန်းပြည့်မဟုတ်သော `2.5` ထည့် | အကွက် error၊ သိမ်း၍ မရ | ☐ Pass ☐ Fail |
| SET-06 | Township ၏ commission ပြင် | သိမ်းသည်၊ ထို township ၏ အော်ဒါအသစ်များ တန်ဖိုးအသစ် ဖြည့်သည် | ☐ Pass ☐ Fail |
| SET-07 | အော်ဒါများ ကိုးကားနေသော township ဖျက် | ငြင်း (409)，အတန်း ကျန် | ☐ Pass ☐ Fail |
| SET-08 | `/partners` → ဖန်တီး၊ ပြင်၊ active ပြောင်း | ကျန်သည်၊ inactive partner ကို ခွဲဝေ၍ မရ | ☐ Pass ☐ Fail |
| SET-09 | အော်ဒါက ကိုးကားနေသော partner ဖျက် | Backend message ဖြင့် ငြင်း | ☐ Pass ☐ Fail |
| SET-10 | Rider တွင် township coverage UI မရှိ၊ township တွင် assignee UI မရှိ စစ်ပါ | နှစ်မျိုးလုံး မပေါ် | ☐ Pass ☐ Fail |

### ၄.၁၁ အသုံးပြုသူ၊ ရာထူး၊ ခွင့်ပြုချက်

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| ADM-01 | `/users` → **New user** — အမည်၊ အီးမေးလ်၊ ရာထူး၊ status၊ စကားဝှက် | ဖန်တီးပြီး ဇယားတွင် ပေါ်သည် | ☐ Pass ☐ Fail |
| ADM-02 | ရာထူးနှင့် status ဖြင့် စစ်ထုတ် | မှန်ကန်သော အစု၊ Apply/Reset အလုပ်လုပ် | ☐ Pass ☐ Fail |
| ADM-03 | ထပ်နေသော အီးမေးလ်ဖြင့် ဖန်တီး | Backend error ပြသည်၊ ထပ်တူ အတန်း မဖန်တီး | ☐ Pass ☐ Fail |
| ADM-04 | အသုံးပြုသူကို `INACTIVE` ပြောင်းပြီး ထိုသူဖြင့် ဝင်ကြည့် | ဝင်၍ မရ | ☐ Pass ☐ Fail |
| ADM-05 | `admin1` ဖြင့်ဝင်ပြီး **New user** ဖွင့် | ရာထူးစာရင်းတွင် OWNER နှင့် ADMIN မပါ | ☐ Pass ☐ Fail |
| ADM-06 | ADMIN အနေဖြင့် မစီမံနိုင်သော ရာထူး ဖွင့် | ဖတ်သာ၊ ပြင်ခလုတ် မရှိ | ☐ Pass ☐ Fail |
| ADM-07 | `/roles` → **New role** | Type `Standard` ဖြင့် ဖန်တီး၊ OWNER အတန်းတွင် `System` + lock | ☐ Pass ☐ Fail |
| ADM-08 | ရာထူး၏ ဖော်ပြချက် ပြင် | သိမ်းသည်၊ အမည် အကွက် ပြင်၍ မရ | ☐ Pass ☐ Fail |
| ADM-09 | အသုံးပြုသူ ရှိသော ရာထူး ဖျက် | ငြင်း (409)၊ backend message ပြ | ☐ Pass ☐ Fail |
| ADM-10 | အသုံးမပြုသော ရာထူး ဖျက် | အတည်ပြု dialog ပြီး ဖျက်သည် | ☐ Pass ☐ Fail |
| ADM-11 | `/permissions` → သာမန် ရာထူးတစ်ခု ရွေး | Module ၁၄ ခု၊ module တစ်ခုစီတွင် တကယ့် action များသာ၊ `import` ကော်လံ မရှိ | ☐ Pass ☐ Fail |
| ADM-12 | Key တစ်ခု ပြောင်းပြီး သိမ်း | Toast "Permissions updated"，reload ပြီးလည်း ကျန်သည် | ☐ Pass ☐ Fail |
| ADM-13 | **Select all** ပြီး သိမ်း | ထို ရာထူးအတွက် အားလုံး ပေးပြီး | ☐ Pass ☐ Fail |
| ADM-14 | `OWNER` ရာထူး ရွေး | အားလုံး အမှန်ခြစ်၊ ဖတ်သာ၊ system-role မှတ်ချက် မြင် | ☐ Pass ☐ Fail |
| ADM-15 | `orders.read` သာ ပေးပြီး ထိုသူဖြင့် ဝင် | Orders မြင်၊ အခြား module မပေါ်၊ ဖျောက်ထားသော module URL သည် 403 | ☐ Pass ☐ Fail |
| ADM-16 | `permissions.update` မရှိသူဖြင့် ဝင် | Grid ဖတ်သာ၊ "saving grants needs the permissions.update key" မှတ်ချက် | ☐ Pass ☐ Fail |
| ADM-17 | ရာထူးတစ်ခု၏ ခွင့်ပြုချက် ပြောင်းစဉ် ထိုရာထူးဖြင့် အခြားနေရာတွင် ဝင်ထားသူ | နောက် session/boot တွင် menu ပြောင်း၊ ပယ်ဖျက်ထားသော call များကို API က ငြင်း | ☐ Pass ☐ Fail |

### ၄.၁၂ အစီရင်ခံစာများ နှင့် export

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| RPT-01 | `/reports/orders` → status နှင့် ဆိုင်ဖြင့် စစ်ထုတ် | ဇယားနှင့် စုစုပေါင်းများ filter နှင့် ကိုက် | ☐ Pass ☐ Fail |
| RPT-02 | `Export CSV` ပြီး `Export XLSX` | နှစ်ခုလုံး ဒေါင်းလုဒ်ကျ၊ toast တွင် format အမည် | ☐ Pass ☐ Fail |
| RPT-03 | `/reports/shop-statement` → ဆိုင်နှင့် ကာလ ရွေး | Status အရေအတွက် + ငွေစုစုပေါင်း ပေါ်သည်၊ ကတ်ဗလာ မရှိ | ☐ Pass ☐ Fail |
| RPT-04 | Statement ၏ သတိပေးချက် ဖတ် | အနုတ် net owed၊ advance ရက်စွဲဖြင့် ရေတွက်မှု၊ COD သည် မျှော်မှန်းချက်၊ handover သည် အော်ဒါအလိုက် မဟုတ် — ပါသည် | ☐ Pass ☐ Fail |
| RPT-05 | `/reports/rider-collection` → rider စစ်ထုတ် | ရက်အလိုက် delivered vs awaiting approval၊ ပြန်အပ်ရမည့် မျှော်မှန်း COD၊ report total | ☐ Pass ☐ Fail |
| RPT-06 | `/reports/rider-payout` | Rider တစ်ဦးလျှင် အတန်းတစ်ခု — delivered အော်ဒါ၊ earned၊ pending approval | ☐ Pass ☐ Fail |
| RPT-07 | မည်သည့် report တွင်မဆို မှားသော ကာလ ထည့် | Inline "start date must not be after end date"，crash မရှိ | ☐ Pass ☐ Fail |
| RPT-08 | `reports.export` မရှိသူဖြင့် ဝင် | မည်သည့်နေရာတွင်မှ export ခလုတ် မပေါ် | ☐ Pass ☐ Fail |
| RPT-09 | Report ရှိ အော်ဒါ COD ကို အော်ဒါစာရင်းနှင့် နှိုင်းယှဉ် | ကိန်းဂဏန်း တူညီ၊ ဒသမ နေရာအရေအတွက် တူညီ | ☐ Pass ☐ Fail |

### ၄.၁၃ ဆိုင် portal

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| SHOP-01 | `shop1` ဖြင့် ဝင် | Overview ပွင့်သည်၊ menu တွင် Overview / Orders / Statement သာ | ☐ Pass ☐ Fail |
| SHOP-02 | Overview ကြည့် | ဆိုင်ဘက် status အလိုက် အော်ဒါ chart + ငွေရှင်းလင်းမှု အနှစ်ချုပ် (COD collected, net settlement) | ☐ Pass ☐ Fail |
| SHOP-03 | `/shop/orders` → status၊ ကာလ၊ ရှာဖွေမှုဖြင့် စစ်ထုတ် | ကိုယ့်အော်ဒါများသာ၊ pagination အလုပ်လုပ် | ☐ Pass ☐ Fail |
| SHOP-04 | အော်ဒါများမှ CSV/XLSX export | ဒေါင်းလုဒ်ကျ၊ SHOP အတွက် ခလုတ်နှစ်ခုလုံး ပေါ် | ☐ Pass ☐ Fail |
| SHOP-05 | အော်ဒါ အသေးစိတ် ဖွင့် | ဖောက်သည်၊ township၊ လိပ်စာ၊ ငွေပမာဏ၊ history — **rider/partner အမည်၊ partner cost၊ အတွင်းမှတ်ချက် မပါ** | ☐ Pass ☐ Fail |
| SHOP-06 | Status အမည်များ ဖတ် | `Received`, `Out for delivery`, `Delivered`, `Cancelled` | ☐ Pass ☐ Fail |
| SHOP-07 | `/shop/statement` → ကာလရွေး၊ အရေအတွက်နှင့် စုစုပေါင်း ဖတ် | ကိုယ့် ငွေရှင်းလင်းမှုသာ၊ export အလုပ်လုပ် | ☐ Pass ☐ Fail |
| SHOP-08 | `shop2` ဖြင့်ဝင်ပြီး `shop1` အော်ဒါ URL ဖွင့် | "This order is unavailable in your shop account." | ☐ Pass ☐ Fail |
| SHOP-09 | ဆိုင်အကောင့်ဖြင့် `/orders` (သို့) `/dashboard` ကြိုးစား | ရုံး လမ်းကြောင်းများသို့ မရောက်နိုင် | ☐ Pass ☐ Fail |

### ၄.၁၄ ဆက်တင်၊ error နှင့် အထွေထွေ

| ID | လုပ်ဆောင်ရန် | မျှော်မှန်းချက် | ရလဒ် |
|---|---|---|---|
| UI-01 | `/settings/password` → လက်ရှိ စကားဝှက် မှား | အကွက် error၊ session မထိခိုက် | ☐ Pass ☐ Fail |
| UI-02 | စကားဝှက် အောင်မြင်စွာ ပြောင်း | Toast + အတင်းထွက်၊ စကားဝှက်ဟောင်း မရ၊ အသစ် ရ | ☐ Pass ☐ Fail |
| UI-03 | ခွင့်မရှိသော URL သွား | 403 စာမျက်နှာ "Back to dashboard" | ☐ Pass ☐ Fail |
| UI-04 | `/does-not-exist` သွား | 404 စာမျက်နှာ "Back to dashboard" | ☐ Pass ☐ Fail |
| UI-05 | API ကို ရပ် (`Ctrl-C`) ပြီး စာမျက်နှာ reload | ဖတ်နိုင်သော error state၊ မျက်နှာပြင် ဗလာ/crash မဖြစ် | ☐ Pass ☐ Fail |
| UI-06 | API ပြန်စပြီး ထပ်ကြိုးစား | ဒေတာ ပြန်တင်သည် | ☐ Pass ☐ Fail |
| UI-07 | စာမျက်နှာအားလုံးကို 375px အကျယ်သို့ ချုံ့ | စာမျက်နှာ အလျားလိုက် scroll မရှိ၊ ဇယားများ ကိုယ့်ဘောင်အတွင်း scroll | ☐ Pass ☐ Fail |
| UI-08 | Dialog နှင့် ဇယားကို Tab ဖြင့် သွား | Focus ring မြင်၊ အစီအစဉ်အတိုင်း ရောက်၊ dialog က focus ကို ထိန်း | ☐ Pass ☐ Fail |
| UI-09 | အကွက်တိုင်းတွင် label မြင်ရ၊ error သည် အကွက်အောက်တွင် ပေါ် | Label မြင်၊ inline error၊ အရောင်တစ်ခုတည်းဖြင့် မဆိုလို | ☐ Pass ☐ Fail |
| UI-10 | Status badge ကို အသံထွက်ဖတ် / screen reader | Status စာသား ပါသည်၊ အရောင်တစ်ခုတည်း မဟုတ် | ☐ Pass ☐ Fail |

---

## ၅. ဒေတာ အခြေအနေ (ဤဒေတာဘေ့စ်၊ ၂၀၂၆-၁၀-၂၄)

| အချက် | တန်ဖိုး |
|---|---|
| အော်ဒါ | စုစုပေါင်း ၃၉ — PENDING ၅၊ ASSIGNED ၄၊ AWAITING_APPROVAL **၀**၊ DELIVERED ၁၃၊ CANCELLED ၁၇ |
| ဆိုင် | ၄ (demo ၃ + စမ်းသပ်စဉ် ဖန်တီးထားသော ၁) |
| Rider | Demo Rider One, Demo Rider Two |
| Rider ငွေပြန်အပ်မှု | ၆ မှတ်တမ်း |
| Rider One လက်ကျန် | Delivered COD ၂၃၀,၀၀၀.၀၀ − ပြန်အပ် ၁၇၉,၅၀၀.၀၀ = လက်ကျန် **၅၀,၅၀၀.၀၀** |
| Rider Two board | ခွဲဝေထားသော အော်ဒါ ၂ ခု — `DEMO-ORD-004`, `DEMO-ORD-016` |
| Rider One board | ဗလာ — ခွဲဝေထားသော အော်ဒါ မရှိ |
| Township | Demo Central (fee ၃,၅၀၀ / commission ၅၀၀ / ၁ ရက်)၊ Demo North (၄,၅၀၀ / ၇၀၀ / ၂)၊ Demo South (၅,၀၀၀ / ၆၀၀ / ၃) |
| Partner | Demo Swift Partner, Demo Rapid Partner |

တင်ဆက်မှုအတွက် အကျိုးသက်ရောက်မှုများ —

1. Rider တစ်ဦး တင်သွင်းမချင်း approval queue သည် **ဗလာ** ဖြစ်သည် — ကြိုတင်ပြင်ဆင်မှုတွင် အခြေအနေ ဖန်တီးထားပါ။
2. Rider အပိုင်းအတွက် **rider2** ကို သုံးပါ၊ rider1 တွင် ပို့ရန် အော်ဒါ မရှိ။
3. ငွေပြန်အပ်မှု အပိုင်းအတွက် **rider1** ကို သုံးပါ (လက်ကျန် ၅၀,၅၀၀)။
4. အော်ဒါ ၃၉ ခုအနက် ၁၇ ခု cancelled ဖြစ်သောကြောင့် dashboard/report စုစုပေါင်းများတွင် ဖျက်သိမ်းမှု များနေမည်။ တစ်စုံတစ်ဦး bug ဟု မထင်မီ ကြိုပြောထားပါ။

---

## ၆. ပြောသင့်/မပြောသင့်သည့် အချက်များ

ဤအရာများသည် တမင်ထားရှိသော ကန့်သတ်ချက်များဖြစ်ပြီး တောင်းပန်ရမည့် ချို့ယွင်းချက်များ မဟုတ်ပါ။ ကန့်သတ်ချက်ကို ပြောပြီး အကြောင်းရင်းကို ရှင်းပြပါ။

| မပြောသင့် | ပြောသင့် |
|---|---|
| Dashboard/အော်ဒါစာရင်းတွင် "COD collected" | "COD **မျှော်မှန်း** — Rider ငွေပြန်အပ်မှသာ ရုံးက ငွေလက်ခံမှတ်တမ်း ရေးသည်။" |
| "Handover လက်ကျန်က ဤအော်ဒါများနှင့် ကိုက်ညီသည်" | "ဤသည် Rider တစ်ဦးချင်း အချိန်အားလုံး စုစုပေါင်း ဖြစ်သည်၊ ledger မဟုတ်၊ အော်ဒါတိတိကျကျနှင့် မကိုက်ညီပါ။" |
| "ငွေပေးချေမှုများ ရှင်းလင်းပြီး / ဆိုင်များ ပိတ်သိမ်းပြီး" | "Net owed သည် အော်ဒါအကွက်များမှ တွက်ထားသည်၊ payment ledger နှင့် settlement event မရှိပါ (Phase 6)။" |
| "ပြန်အမ်းမှုများ ကိုင်တွယ်ပြီး" | "ဆိုင်သို့ ပြန်ရောက်သော ပါကင်ကို `CANCELLED` အဖြစ် မှတ်သည်။ ပြန်အမ်းငွေ/reclaim လုပ်ငန်းစဉ်သည် Phase 2၊ မတည်ဆောက်ရသေး။" |
| "အချိန်မှန် ပို့ဆောင်မှုနှုန်း" | "ကတိပြု ပို့ဆောင်ချိန် နှင့် စတင်ချိန် timestamp မရှိသဖြင့် on-time နှင့် transit မက်ထရစ် တွက်၍ မရပါ။" |
| "Dashboard သည် real-time" | "ဖတ်ချိန်တွင် အော်ဒါများမှ တွက်သည်၊ ရွေးထားသော ရက်အပိုင်းအခြားအတွင်း။" |
| "Rider များက delivery ကို ငြင်းနိုင်" | "Rider တွင် fail လုပ်ဆောင်ချက် မရှိ၊ ရုံးက cancel/postpone/send back လုပ်သည်။" |
| "Rider က ဖောက်သည်၏ ငွေပေးချေမှုကို မြင်" | "Rider သည် ကောက်ခံရမည့် COD ကိုသာ မြင်၊ commission နှင့် settlement သည် ရုံး ကိန်းဂဏန်းများ။" |

---

## ၇. ပြဿနာ ဖြစ်လျှင် ပြန်လည် ကိုင်တွယ်ခြင်း

| လက္ခဏာ | ဖြစ်နိုင်သော အကြောင်းရင်း | ဖြေရှင်းနည်း |
|---|---|---|
| Confirm deliveries တွင် "Queue is clear" | `AWAITING_APPROVAL` အော်ဒါ မရှိ | Rider တစ်ဦး delivery တင်ပါ၊ သို့မဟုတ် ပြန် seed လုပ်ပြီး အခြေအနေ ဖန်တီးပါ |
| အားလုံး 401 / login သို့ တွန်း | Token သက်တမ်းကုန် (သို့) backend secret အသစ်ဖြင့် ပြန်စ | ပြန်ဝင်ပါ |
| 409 "Order … is not in status …" | အခြားသူက ရွှေ့ပြီးသား (tab နှစ်ခု၊ tester နှစ်ဦး) | အသေးစိတ် စာမျက်နှာ reload လုပ်ပါ၊ ဤသည် guard အလုပ်လုပ်နေခြင်း |
| အော်ဒါ form ၏ select များ ဗလာ (ဆိုင်/ဖောက်သည် မရှိ) | Seed မ run၊ သို့မဟုတ် `INACTIVE` များ စစ်ထုတ်ခံရ | `pnpm db:seed:demo` ပြန်လုပ်ပါ၊ status စစ်ပါ |
| Export နှိပ်လျှင် ဘာမှ မဖြစ် | အကောင့်တွင် `reports.export` / `shop-reports.export` မရှိ | Owner သုံးပါ၊ သို့မဟုတ် key ပေးပါ |
| Seed အကောင့် ဝင်၍ မရ | စကားဝှက်ပြောင်းစမ်းသပ်မှု ကျန်နေ | ပြန် seed လုပ်ပါ၊ သို့မဟုတ် owner အကောင့်ဖြင့် စကားဝှက် ပြန်သတ်မှတ်ပါ |
| ဒေတာ ရှုပ်နေပြီး သရုပ်ပြရန် မသင့် | စမ်းသပ်စဉ် အော်ဒါများ စုပုံ | `delivery_solution_api` တွင် `pnpm db:reset` — **အန္တရာယ်ရှိသည်၊ schema ကို ဖျက်သည်**၊ ပြီးလျှင် `pnpm db:seed && pnpm db:seed:demo`။ မ run မီ အတိအကျ ခွင့်ပြုချက် ရယူပါ။ |

`pnpm db:seed:demo` သည် demo အတန်းများအတွက် ထပ်ကာထပ်ကာ run နိုင်သည် (အမည်/tracking code အလိုက် upsert လုပ်ပြီး history ပြန်ရေးသည်)၊ သို့သော် စမ်းသပ်စဉ် ဖန်တီးထားသော အော်ဒါ၊ အသုံးပြုသူ သို့မဟုတ် handover များကို **မဖျက်ပါ**။

---

## ၈. အတည်ပြု လက်မှတ်ထိုးခြင်း

| Module | စမ်းသပ်သူ | Pass / Fail | မှတ်ချက် |
|---|---|---|---|
| အကောင့်ဝင်ခြင်း နှင့် session | | | |
| ရုံး dashboard | | | |
| အော်ဒါ (စာရင်း၊ ဖန်တီး၊ ပြင်) | | | |
| လုပ်ငန်းစဉ် (assign, postpone, cancel, approve, send-back) | | | |
| Rider မျက်နှာပြင် | | | |
| Rider ငွေပြန်အပ်မှု | | | |
| ဆိုင်များ နှင့် ဖောက်သည်များ | | | |
| Rider, township, partner | | | |
| အသုံးပြုသူ၊ ရာထူး၊ ခွင့်ပြုချက် | | | |
| အစီရင်ခံစာများ နှင့် export | | | |
| ဆိုင် portal | | | |
| ဆက်တင်၊ error၊ responsive | | | |

**စမ်းသပ်ခဲ့သော build:** frontend `feature/main_v2` @ `490f38d` · API `delivery_solution_api` working tree အတိုင်း · ရက်စွဲ — ____________
