# Plan v2 Appendix: Decisions, Wireframes, Contracts, Backlog, Risks, Launch

Companion to [MILTON_ECOMMERCE_PLAN_V2.md](./MILTON_ECOMMERCE_PLAN_V2.md). Schema: [packages/db/schema.prisma](./packages/db/schema.prisma) · SQL: the `*_constraints_indexes` migration in [packages/db/migrations/](./packages/db/migrations/).

---

## A. Open questions resolved with defaults

Each default is what the plan assumes until you say otherwise. Change = a config/scope edit, not a redesign.

| # | Question | Default assumed | Impact if changed |
|---|---|---|---|
| 1 | Real store or portfolio? | **Real store, own brand** (`BRAND_NAME`, logo, palette in config). No Milton assets. | If authorised Milton project: swap tokens/logo only |
| 2 | Warehouses | **1 warehouse**, schema supports many | Multi-WH: add allocation rule (nearest-pincode) in `inventory` module |
| 3 | COD | **Allowed**, max ₹5,000, fee ₹49 (admin settings), OTP-confirm required, disabled on high-RTO pincodes | Prepaid-only removes COD flow (~1 wk saved) |
| 4 | Team | 2 full-stack + 1 designer (part-time QA) ≈ 10 weeks to launch | See §F |
| 5 | Hosting | Vercel (web) + Fly/Render/ECS Mumbai (API, workers) + managed PG/Redis | Self-host = +1 wk DevOps |
| 6 | Languages | **English only**; copy kept in message files so Hindi can be added | `next-intl` retrofit ≈ 3 days |
| 7 | Free-shipping rule | Threshold on **subtotal after coupon, before payment offer** | Config |
| 8 | Prices | **Tax-inclusive**; GST split computed for invoice | Standard in Indian B2C |
| 9 | Guest checkout | Yes, phone-OTP verified | |
| 10 | Reviews | Verified buyers only, moderated, Phase B | |

---

## B. Key screen wireframes (ASCII, desktop)

### B1. Collection page
```
┌───────────────────────────────────────────────────────────────────────┐
│ ▓ Free shipping above ₹699  ·  Extra 3% off on UPI            (ticker) │
├───────────────────────────────────────────────────────────────────────┤
│ LOGO   [ 🔍 What are you looking for?        ]  Track ▸  ♡  👤  🛒(2) │
│ Bottles ▾  Tiffins  Casseroles  Cookware  Storage  Gifting  Offers     │
├───────────────────────────────────────────────────────────────────────┤
│ Home › Bottles & Flasks › Vacuum                                      │
│ Vacuum Thermosteel Bottles                       98 products          │
│ [In stock ✕] [500–750 ml ✕]  Clear all        Sort: Featured ▾        │
├──────────────┬────────────────────────────────────────────────────────┤
│ Capacity  ▾  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│  ☑ 500–750   │ │  img   │ │  img   │ │  img   │ │  img   │            │
│  ☐ 750–1000  │ │ 18%OFF │ │        │ │        │ │        │            │
│ Material  ▾  │ │Felice  │ │Sparkle │ │Aura    │ │Copper  │            │
│  ☑ SS 304    │ │₹802 ̶₹̶9̶8̶0̶ │ │₹1,049  │ │...     │ │        │            │
│ Thermal   ▾  │ │●●●●    │ │●●●     │ │        │ │        │            │
│ Color     ▾  │ └────────┘ └────────┘ └────────┘ └────────┘            │
│ Price ━●━━●  │            [ Load more ]  (cursor pagination)          │
└──────────────┴────────────────────────────────────────────────────────┘
```
Mobile: filters → bottom sheet with "Show N results" CTA; 2-col grid; sticky filter/sort bar.

### B2. PDP
```
┌────────────────────────────────┬───────────────────────────────────────┐
│ ▢ ┌───────────────────────┐   │ Home › Bottles › Felice               │
│ ▢ │                       │   │ Felice Thermosteel Bottle             │
│ ▢ │     hero image        │   │ Vacuum insulated, rust-resistant      │
│ ▢ │   (zoom / swipe)      │   │ ★★★★★ 4.8 (124)   [Save 18%]          │
│ ▢ └───────────────────────┘   │ ₹802  ̶₹̶9̶8̶0̶  18% OFF  incl. taxes     │
│                                │ ◎ Get for ₹682 with DIWALI15  ▾       │
│                                │ Capacity  [550ml] [715ml] [880ml]     │
│                                │ Colour    ● ● ● ●   Pink              │
│                                │ [ Add personalisation +₹99 ]          │
│                                │ Qty [- 1 +]  [ Add to cart ]          │
│                                │ [        Buy it now        ]          │
│                                │ Pincode [______] [Check] → 2–4 days   │
│                                │ 🚚 Fast delivery · ↩ 7-day · 🔒 Secure │
├────────────────────────────────┴───────────────────────────────────────┤
│ ▸ Description  ▸ Specifications  ▸ Shipping & returns  ▸ Warranty     │
│ Frequently bought together · Spare parts · Reviews · You may also like │
└────────────────────────────────────────────────────────────────────────┘
```
Mobile: swipe gallery, sticky bottom bar `₹802 · [Add to cart]` after buy box scrolls out.

### B3. Cart drawer
```
┌──────────────────────────────────┐
│ Your cart (2)                  ✕ │
│ ━━━━━●━━━━━━○━━━━━━○━━━━━━○      │
│ 699✓   1,499   1,999   2,999     │
│ Add ₹697 more for a chance to    │
│ WIN a gold/silver coin           │
│ ┌ img  Felice Bottle  ₹802       │
│ │ [550 ml][Pink]   [- 1 +] 🗑    │
│ Coupon: DIWALI15  Save ₹80  [Apply]│
│ You may also like: Brush +₹149 [+Add]│
│ Subtotal ₹951 · Savings ₹178     │
│ [ Checkout · ₹784  (UPI −3%) ]   │
│ UPI GPay Paytm Cards             │
└──────────────────────────────────┘
```

### B4. Checkout (single page, 3 accordions)
```
1 Contact   [+91 ______] [Send OTP] → [ ○○○○○○ ]  (✓ verified)
2 Address   Pincode [110001] → City/State autofill · saved addresses
            ☐ Billing same · ☐ I have a GSTIN
3 Payment   ◉ UPI (−3%)  ○ Cards  ○ Netbanking  ○ COD (+₹49)
Right: order summary (lines, coupon, shipping, GST included, total) · [ Pay ₹784 ]
```

### B5. Admin: product editor & order detail
```
Product ▸ Felice Thermosteel Bottle            [Draft ▾] [Preview] [Save]
Tabs: General | Options & Variants | Media | Specs | SEO | Related
Options & Variants:
  Options: [Capacity: 550,715,880] [Colour: Pink,Ivory,Black,Olive] [+ option]
  [Generate 12 variants]
  ┌ SKU            550/Pink  ₹802  MRP ₹980  Stock 45  Barcode … ┐ editable grid
Order ML-100245  [PLACED ▾]   ₹784  UPI ✓ captured
  Timeline ● Placed ● Paid ○ Confirmed ○ Shipped
  Items · Address (edit before ship) · Payment · Shipments
  Actions [Confirm] [Create shipment] [Cancel] [Refund ▾] [Add note]
```

---

## C. API contract examples

### C1. Add to cart: `POST /v1/cart/items`
```json
// request
{ "variantId": "clx...", "qty": 1, "engraving": "" }
// response 200: always the full priced cart
{
  "id": "cart_1", "currency": "INR",
  "items": [{
    "id": "ci_1", "variantId": "clx...", "sku": "MIL-FEL-550-PNK",
    "title": "Felice Thermosteel Bottle", "variantTitle": "550 ml / Pink",
    "qty": 1, "unitPricePaise": 80200, "mrpPaise": 98000, "lineTotalPaise": 80200,
    "imageUrl": "https://cdn…/felice-pink.webp", "isGift": false, "available": true
  }],
  "subtotalPaise": 80200, "discountPaise": 0, "shippingPaise": 7900, "totalPaise": 88100,
  "coupon": null, "bestCoupon": { "code": "DIWALI15", "savesPaise": 12030 },
  "milestones": {
    "progressPct": 100, "nextThresholdPaise": 149900, "remainingPaise": 69700,
    "tiers": [{ "thresholdPaise": 69900, "label": "Free shipping", "unlocked": true }]
  }
}
```
Error (RFC 7807): `409 { "type":"…/out-of-stock", "title":"Only 2 left", "availableQty":2 }`.

### C2. Create order: `POST /v1/checkout/orders` (header `Idempotency-Key: <uuid>`)
```json
{ "cartId":"cart_1", "addressId":"adr_1", "paymentMethod":"UPI", "gstin":null }
// 201
{ "orderNumber":"ML-100245", "publicId":"o_9f3k…", "totalPaise":78410,
  "razorpay": { "orderId":"order_Nx…", "keyId":"rzp_live_…" } }
```
The client never sends prices; the server re-prices from `variantId`, `qty` and coupon.

### C3. Razorpay webhook: `POST /v1/webhooks/razorpay`
Handler order: verify `X-Razorpay-Signature` on the raw body → insert `WebhookEvent(provider,eventId)` (unique violation = already handled, return 200) → enqueue job → return 200 within 1 s. The job runs in a transaction: lock order → check `amount == order.totalPaise` → `Payment.CAPTURED`, `Order.PLACED`, convert reservation to sale, write `OrderEvent`, enqueue notifications and analytics.

### C4. Pincode: `GET /v1/pincode/110001`
```json
{ "serviceable": true, "codAllowed": true, "etaDaysMin": 2, "etaDaysMax": 4,
  "estimatedDate": "2026-10-30", "city": "New Delhi", "state": "DL" }
```

### C5. Catalog listing: `GET /v1/categories/bottles/products?capacity=500-750&material=ss304&sort=price_asc&cursor=…`
Returns `items[]`, `nextCursor`, `total`, and `facets: { capacity:[{value,count}], material:[…], price:{min,max} }`. Facet counts exclude the facet's own selection, so multi-select behaves correctly.

---

## D. Worked pricing example (becomes the golden unit test)

Cart: Felice 550 ml/Pink ₹802.00 ×1 + Cleaning Brush ₹149.00 ×1. Coupon `DIWALI15` (15%, all items). UPI offer 3%. Delivery in Delhi, warehouse in Delhi (intra-state). GST 18% inclusive.

| Step | Line 1 (Felice) | Line 2 (Brush) | Total |
|---|---|---|---|
| Subtotal (paise) | 80,200 | 14,900 | 95,100 |
| Coupon 15% | −12,030 | −2,235 | −14,265 |
| After coupon | 68,170 | 12,665 | **80,835** (≥ 69,900, so shipping = 0) |
| UPI 3% on 80,835 = 2,425.05 → 2,425, allocated pro-rata with remainder to the largest line | −2,045 | −380 | −2,425 |
| Net payable | 66,125 | 12,285 | **78,410 (₹784.10)** |
| GST inclusive, per line `round(net×18/118)` | 10,087 | 1,874 | **11,961** |
| Intra-state split (CGST 9%/SGST 9%; odd paise to SGST) | 5,043/5,044 | 937/937 | 5,980/5,981 |

Invariants asserted by property tests: `Σ net lines == total`; `Σ tax lines == order tax`; no line < 0; re-pricing the same cart is deterministic.

---

## E. State machines & catalogs

**Order transitions (allowed only):**

| From | To | Trigger |
|---|---|---|
| PENDING_PAYMENT | PLACED | `payment.captured` webhook / COD verified |
| PENDING_PAYMENT | CANCELLED | payment failed 30 min, user cancel |
| PLACED | CONFIRMED | auto (prepaid) or staff (COD) |
| CONFIRMED | PROCESSING | picking started |
| PROCESSING | SHIPPED / PARTIALLY_SHIPPED | shipment created |
| SHIPPED | DELIVERED | courier webhook |
| PLACED–PROCESSING | CANCELLED | staff/customer; releases stock, auto-refund |
| DELIVERED | RETURNED | return received + QC |
| DELIVERED / RETURNED | CLOSED | return window elapsed / refund done |

**Notifications:** OTP · order placed · payment failed · COD confirm · shipped (tracking) · out for delivery · delivered + review ask (day 7) · refund processed · back in stock · abandoned cart (1 h, 24 h; consent-gated) · low-stock (staff).

**Background jobs:** reservation expiry (1 min) · payment reconciliation (10 min) · COD auto-cancel (hourly) · abandoned-cart scan (15 min) · search/cache invalidation (event) · sitemap + Google feed (nightly) · pincode sync (nightly) · report exports (on demand) · DB backup verify (daily).

**SEO spec:** one H1 per page; `Product`, `Offer`, `AggregateRating`, `BreadcrumbList`, `Organization`, `WebSite+SearchAction` JSON-LD; canonical on unfiltered URL; `noindex` on search, cart, checkout, account and faceted URLs (except curated landing pages); 301s from the admin redirect table; `hreflang` not needed (single language); image `alt` mandatory; sitemaps split by type (products, categories, pages).

---

## F. Backlog (epics → estimates, person-days)

| Epic | Key stories | Days |
|---|---|---|
| E0 Foundation | Monorepo, CI/CD, envs, lint/test, tokens, UI primitives, docker-compose | 8 |
| E1 Auth | OTP service, JWT/refresh rotation, staff login + TOTP, RBAC guard, rate limits | 8 |
| E2 Catalog (API+admin) | Category tree, attribute builder, product/variant CRUD, generator, media upload, CSV import, audit log | 18 |
| E3 Storefront browse | Header/mega-menu, collection + facets, PDP + variant matrix + gallery, search, SEO | 18 |
| E4 Inventory | Levels, ledger, reservations, expiry job, adjust UI, low-stock alerts | 8 |
| E5 Pricing/cart | Pricing engine + property tests, coupons, milestones, cart API, drawer UI, upsells, pincode | 14 |
| E6 Checkout/payments | Address book, checkout UI, Razorpay, COD flow, webhooks, reconciliation, invoices (PDF) | 16 |
| E7 Orders/fulfilment | Order admin, state machine, Shiprocket, tracking page, cancel/refund | 14 |
| E8 Notifications | Template engine, SMS/WA/email adapters, queue, DLT setup | 6 |
| E9 Returns | Request flow, admin queue, reverse pickup, refund | 8 |
| E10 CMS & marketing | Pages, banners, ticker, redirects, bulk enquiry | 6 |
| E11 Analytics | GA4/CAPI events, dashboards, reports + GSTR-1 export | 7 |
| E12 Hardening | Security review, load test, a11y, perf, backup drill, runbooks, UAT | 10 |
| **Total** | | **≈141 person-days** (≈ 10 weeks for 2 engineers + designer/QA, with ~15% buffer) |

Post-launch (Phase B/C): reviews, wishlist, personalization preview, abandoned-cart tuning, loyalty, new categories, multi-WH, Meilisearch (≈ 30 days).

**Definition of done (every story):** typed contract updated · unit/integration tests · permission + audit checked · a11y pass · analytics event · docs/runbook if operational · behind flag if risky.

---

## G. Risk register

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Overselling at peak (sales) | M | H | DB row locks + CHECK + reservation TTL + race test | Backend |
| Payment/stock mismatch from lost webhook | M | H | Reconciliation job + replay UI + alerts | Backend |
| High COD RTO (return-to-origin) cost | H | M | OTP confirm, pincode risk list, COD cap/fee, prepaid incentive | Product |
| SMS pumping fraud | M | M | Rate limits, captcha, daily budget alarm | Backend |
| GST mistakes | M | H | CA review of HSN/rates + invoice template before launch | Founder/CA |
| Trademark/asset infringement | M | H | Own brand and assets (§A1) | Founder |
| Scope creep (marketplace feeds, loyalty) | H | M | Phase gates; Phase A scope frozen | PM |
| Courier API instability | M | M | Aggregator + retry/backoff + manual AWB fallback in admin | Backend |
| Slow mobile performance | M | H | Budgets in CI, image pipeline, minimal client JS | Frontend |
| Key-person dependency | M | M | Docs, ADRs, runbooks, code review | Lead |
| Catalog data entry burden | H | M | CSV import w/ dry-run, variant generator | Ops |

---

## H. Infrastructure cost estimate (monthly, launch scale ≈ 1–3k orders/mo)

| Item | ₹ / month (approx.) |
|---|---|
| Vercel Pro (storefront + admin) | 3,500 |
| API + worker (2 small containers, Mumbai) | 4,000 |
| Managed Postgres (2 vCPU/4 GB + PITR) | 6,000 |
| Redis (managed small) | 1,500 |
| S3 + CDN | 1,500 |
| Sentry/monitoring | 2,500 |
| Email (SES) + SMS (≈ 10k @ ₹0.2) + WhatsApp | 4,000 |
| **Infra total** | **≈ ₹23k** |
| Razorpay | ~2% of prepaid GMV (UPI/RuPay lower) |
| Shiprocket | per-shipment (~₹40–80 by weight/zone) |

These are estimates and should be re-checked against current vendor pricing before budgeting.

---

## I. Launch checklist (go / no-go)

**Product:** all Phase A acceptance tests (V2 §11) green on staging · UAT signed by ops · catalog loaded and spot-checked (MRP, weight, HSN).
**Payments:** Razorpay live keys, webhook URL + secret set, ₹1 live test order + refund · COD flow tested · reconciliation job verified.
**Compliance:** GSTIN + invoice series configured, CA sign-off · MRP/origin/manufacturer on PDP · grievance officer + policies pages · consent banner works, marketing opt-in unchecked by default · DLT templates approved.
**Security:** pen-test checklist / dependency audit clean · admin 2FA enforced · default accounts removed · secrets rotated · CSP enforced · rate limits on.
**Reliability:** load test passed (target 50 checkouts/s) · backups + restore drill done · alerts routed to on-call · runbooks written · rollback tested.
**SEO/Analytics:** sitemap submitted · redirects in place · GA4/Meta purchase events deduped and match order count · Search Console verified.
**Soft launch:** 5% traffic or invite list for 3 days → fix → full launch; war-room first 72 h.

## J. Success metrics (first 90 days)

Conversion ≥ 2.0% · add-to-cart rate ≥ 8% · checkout completion ≥ 55% · payment success ≥ 92% · COD share ≤ 35% · RTO ≤ 15% of COD · LCP p75 < 2.5 s · stock-out cancellations < 1% · support tickets/100 orders < 8. These are targets to calibrate with real data, not benchmarks from this research.
