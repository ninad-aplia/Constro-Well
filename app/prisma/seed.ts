/**
 * TASK 2.2 — Constro Well idempotent seed.
 *
 * Runs only when explicitly invoked (`npm run db:seed` / `prisma db seed`)
 * — never imported by runtime code (PROJECT_CONTEXT §8). All sample content
 * comes from the existing mock data modules (`data/catalog.ts`,
 * `data/seller.ts`), whose names/prices/specs are the prototypes' — nothing
 * re-authored here. The data modules are imported, not modified.
 *
 * Idempotency: static entities (users, sellers, categories, products,
 * vehicles, drivers, pincodes, reviews) upsert on stable `code`/unique keys;
 * each demo Order with its line, Shipment, ShipmentEvents, ShipmentIssue and
 * EscrowEntries is created atomically in a single transaction and skipped on
 * re-run when its `code` already exists — repeated runs never duplicate.
 *
 * MONEY (DECISIONS.md D16): every amount is built through `Prisma.Decimal`
 * (exact decimals); no monetary value is ever produced by, or converted to,
 * JavaScript float arithmetic. Products of integers and literal rates happen
 * inside `Prisma.Decimal`.
 *
 * Demo passwords: bcrypt-hashed at run time (D2). The shared demo password
 * comes from `DEMO_PASSWORD` (env, owner-controlled); the fallback is a
 * throwaway demo value, not a secret. The database receives bcrypt hashes
 * only — nothing plaintext is stored. Delivery OTP digests likewise never
 * store the 4-digit plaintext (DECISIONS.md D17).
 */
import { Prisma, PrismaClient, OrderStage, ShipmentActor, ShipmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createSellerSeed } from "@/data/seller";
import { PRODUCTS } from "@/data/catalog";
import { CATEGORIES } from "@/lib/shop/types";
import { ACCEPT_WINDOW_HOURS, DISPATCH_WINDOW_HOURS, REVIEW_WINDOW_HOURS } from "@/lib/seller/rules";
import { deriveOtp } from "@/lib/delivery/rules";

const db = new PrismaClient();

/** Exact decimal constructor for money — the only numeric path for amounts. */
const D = (n: number | string) => new Prisma.Decimal(n);

/** Platform delivery-fee rule (PROJECT_CONTEXT §1: free ≥ ₹5,000 else ₹199). */
const FREE_ABOVE = D(5000);
const DELIVERY_FEE = D(199);
const COMMISSION_RATE = D("0.05");
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Demo email convention: slugged display name at the reserved `.test` domain. */
function demoEmail(displayName: string): string {
  return (
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "") + "@demo.constrowell.test"
  );
}

/**
 * Parses the mock data's relative labels ("42 minutes ago", "1h 48m ago",
 * "6 hours ago", "3 days ago", "Just now") into instants relative to seed
 * time, so seeded history reads coherently and review windows line up with
 * the approved REVIEW_WINDOW_HOURS. Returns null for unknown labels (caller
 * falls back to the entity's own timestamp). These patterns cover every
 * relative label present in `data/seller.ts`.
 */
function parseAgo(label: string, now: number): Date | null {
  let m = /^(\d+)h\s*(\d+)m ago$/.exec(label);
  if (m) return new Date(now - ((+m[1] * 60 + +m[2]) * 60_000));
  if (/^just now$/i.test(label)) return new Date(now);
  m = /^(\d+)\s*min(?:ute)?s? ago$/i.exec(label);
  if (m) return new Date(now - +m[1] * 60_000);
  m = /^(\d+)\s*hours? ago$/i.exec(label);
  if (m) return new Date(now - +m[1] * HOUR_MS);
  m = /^(\d+)\s*days? ago$/i.exec(label);
  if (m) return new Date(now - +m[1] * DAY_MS);
  return null;
}

/** Actor for a prototype event message (vendor / driver / customer / system). */
function actorFor(message: string): ShipmentActor {
  if (/^delivered/i.test(message)) return "driver";
  if (/^(order paid|customer reported)/i.test(message)) return "customer";
  if (/^(review window|shortfall|payout)/i.test(message)) return "system";
  if (/^(accepted|packed|dispatched|rescheduled)/i.test(message)) return "vendor";
  return "system";
}

/** Seller order status → Prisma ShipmentStatus (same approved vocabulary). */
function shipmentStatus(status: string): ShipmentStatus {
  return status as ShipmentStatus;
}

/** Customer-facing order lifecycle = buildgrid-shop.html `STAGES`. */
function orderStage(status: string): OrderStage {
  if (["review", "disputed", "settled"].includes(status)) return "delivered";
  if (status === "dispatched") return "shipped";
  if (status === "packed") return "packed";
  return "ordered";
}

// Catalog product codes ("0".."47") owned by the demo seller whose mock
// orders reference the `p#` ids (D11 namespace reconciliation): each seller
// product matches the catalog row with the identical name and price —
// p1→"0", p2→"1", p3→"2", p4→"3", p5→"38" (Wall Putty), p6→"22" (Dry Mortar),
// p7→"27" (Tile Adhesive), p8→"23" (Non-Shrink Grout).
const SELLER_PRODUCT_CODES: Record<string, string> = {
  p1: "0", p2: "1", p3: "2", p4: "3", p5: "38", p6: "22", p7: "27", p8: "23",
};

// Demo pool sellers = the prototype's synthesized offer pool (data/catalog.ts
// POOL) promoted to real vendor rows (D11). GSTINs are synthetic fixtures.
const POOL_SELLERS = [
  { name: "Bharat Build Mart", gstin: "29BBHBM1234P1Z5" },
  { name: "Metro Supplies", gstin: "29CCMTS5678Q2Z1" },
  { name: "Southern Traders", gstin: "29DDSOT9012R3Z3" },
  { name: "Prime Materials", gstin: "29EEPM3456S4Z1" },
  { name: "Vijay Hardware", gstin: "29FFVH7890T5Z4" },
  { name: "KBR Distributors", gstin: "29GGKBD2345U6Z1" },
];

async function main() {
  const now = Date.now();
  const seller = createSellerSeed();

  // Demo password: env-controlled (owner sets it locally), bcrypt at runtime.
  const demoPassword = process.env.DEMO_PASSWORD ?? "constrowell-demo";
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const upsertUser = (name: string, role: "customer" | "seller" | "driver" | "admin") =>
    db.user.upsert({
      where: { email: demoEmail(name) },
      create: { email: demoEmail(name), passwordHash, role, name },
      update: {},
    });

  // --- 1. Users: store owners, drivers, admin, buyers, admin console user. ---
  const sellerOwnerUserId = (await upsertUser(seller.store.owner, "seller")).id;
  const poolOwnerIds: string[] = [];
  for (const s of POOL_SELLERS) poolOwnerIds.push((await upsertUser(s.name, "seller")).id);
  await upsertUser("Constro Well Admin", "admin"); // stopgap console / backend admin role (D7)
  const buyerIds = new Map<string, string>();
  for (const name of new Set(seller.orders.map((o) => o.buyer)))
    buyerIds.set(name, (await upsertUser(name, "customer")).id);
  const driverUserIds = new Map<string, string>();
  for (const dr of seller.drivers) driverUserIds.set(dr.id, (await upsertUser(dr.name, "driver")).id);

  // --- 2. Categories — all 13 names incl. the empty Interior Design (D15). ---
  const categoryIds = new Map<string, string>();
  for (const name of CATEGORIES) {
    const row = await db.category.upsert({ where: { name }, create: { name }, update: {} });
    categoryIds.set(name, row.id);
  }

  // --- 3. Sellers: UltraBuild (the mock store) + the prototype offer pool. ---
  const ultra = await db.seller.upsert({
    where: { code: "ultrabuild" },
    create: {
      code: "ultrabuild",
      ownerUserId: sellerOwnerUserId,
      storeName: seller.store.name,
      gstin: seller.store.gstin,
      phone: seller.store.phone,
      city: seller.store.city,
      pickupAddress: seller.store.address,
      bankRef: seller.store.bank,
      kycGst: seller.store.kyc.gst === "Verified" ? "verified" : "pending",
      kycPan: seller.store.kyc.pan === "Verified" ? "verified" : "pending",
      kycCheque: seller.store.kyc.cheque === "Verified" ? "verified" : "pending",
      vacationMode: seller.vacationMode,
      freeAbove: D(seller.rules.freeAbove),
      fee: D(seller.rules.fee),
      slotsPerDay: seller.rules.slotsPerDay,
    },
    update: {},
  });
  const sellers: string[] = [ultra.id];
  for (let i = 0; i < POOL_SELLERS.length; i++) {
    const code = POOL_SELLERS[i].name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const s = await db.seller.upsert({
      where: { code },
      create: {
        code,
        ownerUserId: poolOwnerIds[i],
        storeName: POOL_SELLERS[i].name,
        gstin: POOL_SELLERS[i].gstin,
        phone: `98000000${String(i).padStart(2, "0")}`,
        city: "Bengaluru",
        pickupAddress: "Demo listing hub",
        bankRef: "Demo bank",
        kycGst: "verified",
        kycPan: "verified",
        kycCheque: "pending",
        freeAbove: FREE_ABOVE,
        fee: DELIVERY_FEE,
        slotsPerDay: [3, 3, 2],
      },
      update: {},
    });
    sellers.push(s.id);
    for (const pin of ["560001", "560066"])
      await db.sellerPincode.upsert({
        where: { sellerId_pin: { sellerId: s.id, pin } },
        create: { sellerId: s.id, pin },
        update: {},
      });
  }
  for (const pin of seller.serviceAreas)
    await db.sellerPincode.upsert({
      where: { sellerId_pin: { sellerId: ultra.id, pin } },
      create: { sellerId: ultra.id, pin },
      update: {},
    });

  // --- 4. Drivers + vehicles for UltraBuild (codes "d#"/"v#" from the mock). ---
  const driverIds = new Map<string, string>();
  for (const dr of seller.drivers) {
    const row = await db.driver.upsert({
      where: { sellerId_code: { sellerId: ultra.id, code: dr.id } },
      create: { sellerId: ultra.id, code: dr.id, name: dr.name, phone: dr.phone, userId: driverUserIds.get(dr.id) },
      update: {},
    });
    driverIds.set(dr.id, row.id);
  }
  const vehicleIds = new Map<string, string>();
  for (const v of seller.vehicles) {
    const row = await db.vehicle.upsert({
      where: { regNumber: v.regNumber },
      create: { sellerId: ultra.id, code: v.id, regNumber: v.regNumber, type: v.type, driverId: driverIds.get(v.driverId) },
      update: { driverId: driverIds.get(v.driverId) },
    });
    vehicleIds.set(v.id, row.id);
  }

  // --- 5. Products: the 48-row catalogue + UltraBuild's inventory fields. ---
  const sellerProductByCode = new Map(seller.products.map((sp) => [SELLER_PRODUCT_CODES[sp.id], sp]));
  for (const p of PRODUCTS) {
    const code = String(p.id);
    const sp = sellerProductByCode.get(code);
    await db.product.upsert({
      where: { code },
      create: {
        code,
        sellerId: sp ? ultra.id : sellers[1 + (p.id % POOL_SELLERS.length)],
        categoryId: categoryIds.get(p.cat) as string,
        name: p.name,
        unit: p.unit,
        mrp: D(p.mrp),
        price: D(p.price), // GST-inclusive per D8
        stock: sp ? sp.stock : p.stock,
        minOrderQty: sp?.minOrderQty ?? 1,
        // Catalog rows carry no weight figure; 0.0 is the documented demo
        // default until real listings supply weights (Phase 5).
        unitWeightKg: sp?.weightKg ?? 0,
        bulkFlag: sp?.bulk ?? false,
        reorderLevel: sp?.reorderLevel ?? 0,
        status: sp?.status === "paused" ? "paused" : "active",
        soldCount: sp?.sold ?? 0,
        specs: p.specs,
      },
      update: {},
    });
  }
  const ultraProductIds = new Map(
    (await db.product.findMany({ where: { sellerId: ultra.id }, select: { id: true, code: true } })).map((p) => [p.code, p.id]),
  );

  // --- 6. Demo orders → OrderLine → Shipment (+ events, issue, escrow). ---
  // Coverage mirrors data/seller.ts exactly (verified): 3 new, 1 accepted,
  // 1 packed, 2 dispatched, 2 review, 1 disputed, 6 settled. `failed` remains
  // runtime-generated, matching the preview design. The docs' earlier "5
  // settled" was an undercount of the source data — seed follows the source.
  for (const o of seller.orders) {
    const code = o.id;
    const existing = await db.order.findUnique({ where: { code } });
    if (existing) continue; // created atomically below; re-runs skip in full

    const createdAt = parseAgo(o.createdLabel, now) ?? new Date(now);
    const lineValue = D(o.price).times(o.qty); // exact decimal, no float math
    const deliveryFee = lineValue.greaterThanOrEqualTo(FREE_ABOVE) ? D(0) : DELIVERY_FEE;
    const gross = lineValue.plus(deliveryFee);
    const deliveredAt = o.deliveredAtLabel ? (parseAgo(o.deliveredAtLabel, now) ?? null) : null;
    const paidAt = o.paidAtLabel ? (parseAgo(o.paidAtLabel, now) ?? null) : null;
    const vehicleRow = o.vehicleId ? seller.vehicles.find((v) => v.id === o.vehicleId) : undefined;
    const vehicleId = o.vehicleId ? (vehicleIds.get(o.vehicleId) ?? null) : null;
    const driverId = vehicleRow ? (driverIds.get(vehicleRow.driverId) ?? null) : null;
    // Settled payouts: commission + release computed in exact decimals.
    const commission = o.status === "settled" ? lineValue.times(COMMISSION_RATE) : null;
    const payout = commission ? lineValue.plus(deliveryFee).minus(commission) : null;
    const releaseAt = paidAt ?? createdAt;

    await db.$transaction(async (tx) => {
      const productId = ultraProductIds.get(SELLER_PRODUCT_CODES[o.productId]) as string;
      const order = await tx.order.create({
        data: {
          code,
          userId: buyerIds.get(o.buyer) as string,
          itemValue: lineValue,
          deliveryFee,
          grossTotal: gross,
          stage: orderStage(o.status),
          // The mock carries city + pin but no street line — an honest snapshot.
          addressSnapshot: { city: o.city, pin: o.pin },
        },
      });
      const shipment = await tx.shipment.create({
        data: {
          code,
          orderId: order.id,
          sellerId: ultra.id,
          status: shipmentStatus(o.status),
          slot: o.slot ?? null,
          vehicleId,
          driverId,
          docsChallan: o.docs?.challan ?? false,
          docsInvoice: o.docs?.invoice ?? false,
          docsEway: o.docs?.eway ?? null,
          docsWeighbridge: o.docs?.weighbridge ?? null,
          late: o.late ?? false,
          acceptBy:
            ["new", "accepted", "packed"].includes(o.status)
              ? new Date(createdAt.getTime() + ACCEPT_WINDOW_HOURS * HOUR_MS)
              : null,
          dispatchBy:
            ["accepted", "packed"].includes(o.status)
              ? new Date(createdAt.getTime() + DISPATCH_WINDOW_HOURS * HOUR_MS)
              : null,
          deliveredAt,
          deliveredQty: deliveredAt ? o.qty : null, // mock's dispute is quality damage, full qty arrived
          reviewEnds:
            o.status === "review" && deliveredAt
              ? new Date(deliveredAt.getTime() + REVIEW_WINDOW_HOURS * HOUR_MS)
              : null,
          // OTP digest only (D17): demo code = the preview's deterministic
          // deriveOtp(orderId) so DB and UI agree; stored bcrypt-hashed, never
          // plaintext. No expiry field — expiry policy unresolved (D5 OPEN).
          otpHash:
            o.status === "dispatched" && deliveredAt === null
              ? await bcrypt.hash(deriveOtp(o.id), 10)
              : null,
          events: {
            create: o.events.map((e) => ({
              actor: actorFor(e.message),
              message: e.message,
              at: parseAgo(e.at, now) ?? createdAt,
            })),
          },
        },
      });
      await tx.orderLine.create({
        data: {
          orderId: order.id,
          productId,
          sellerId: ultra.id,
          name: o.productName, // buyer-facing display text, point-in-time snapshot
          unit: o.unit,
          unitPrice: D(o.price),
          qty: o.qty,
          lineValue,
          shipmentId: shipment.id,
        },
      });
      // Escrow ledger: HELD at payment; settled orders release + commission.
      await tx.escrowEntry.create({
        data: {
          orderId: order.id,
          shipmentId: shipment.id,
          sellerId: ultra.id,
          type: "held",
          amount: gross,
          note: "Order paid by customer, amount held in escrow",
          createdAt,
        },
      });
      if (o.status === "settled" && commission && payout) {
        await tx.escrowEntry.create({ data: { orderId: order.id, shipmentId: shipment.id, sellerId: ultra.id, type: "commission", amount: commission, note: "Platform commission 5% at payout", createdAt: releaseAt } });
        await tx.escrowEntry.create({ data: { orderId: order.id, shipmentId: shipment.id, sellerId: ultra.id, type: "released", amount: payout, note: "Review window closed, payout released", createdAt: releaseAt } });
      }
      // Mock dispute (data/seller.ts BG-50221): customer-reported damaged goods.
      if (o.issue) {
        await tx.shipmentIssue.create({
          data: {
            shipmentId: shipment.id,
            type:
              o.issue.type === "Damaged goods" ? "damaged_goods"
              : o.issue.type === "Short quantity" ? "short_quantity"
              : "failed_attempt",
            note: o.issue.note,
            claim: o.issue.claim != null ? D(o.issue.claim) : null,
            auto: false, // customer-reported, not the auto shortfall flow
            createdAt: o.events[1] ? (parseAgo(o.events[1].at, now) ?? createdAt) : createdAt,
          },
        });
      }
    });
  }

  // --- 7. Seller reviews → Review rows (mapped to their product-name twins). ---
  const reviewProduct = new Map([
    ["OPC 53 Grade Cement", "0"],
    ["Wall Putty", "38"],
    ["PPC Cement", "1"],
    ["Dry Mortar Plaster Mix", "22"],
  ]);
  const orderedProductByUser = new Map(seller.orders.map((o) => [o.buyer, SELLER_PRODUCT_CODES[o.productId]] as const));
  for (const r of seller.reviews) {
    const code = reviewProduct.get(r.productName);
    if (!code) continue;
    const userId = (await upsertUser(r.name, "customer")).id;
    const productId = ultraProductIds.get(code) as string;
    await db.review.upsert({
      where: { userId_productId: { userId, productId } },
      create: {
        productId,
        userId,
        stars: r.stars,
        title: r.title,
        body: r.title, // the mock review has a headline only — body mirrors it (documented demo limitation)
        verifiedPurchase: orderedProductByUser.get(r.name) === code,
        createdAt: new Date(now - r.daysAgo * DAY_MS),
      },
      update: {},
    });
  }

  // --- 8. Seller notifications + bank transfers → ledger withdrawals. ---
  for (const n of seller.notifications) {
    const exists = await db.notification.findFirst({ where: { sellerId: ultra.id, message: n.message } });
    if (!exists)
      await db.notification.create({
        data: {
          sellerId: ultra.id,
          message: n.message,
          read: n.read,
          createdAt: parseAgo(n.atLabel, now) ?? new Date(now),
        },
      });
  }
  for (const t of seller.transfers) {
    const exists = await db.escrowEntry.findFirst({ where: { sellerId: ultra.id, note: { contains: t.id } } });
    if (!exists)
      await db.escrowEntry.create({
        data: {
          sellerId: ultra.id,
          type: "withdrawn",
          amount: D(t.amount), // exact decimal from the integer mock amount
          note: `Bank transfer ${t.id} to ${t.bank}`,
          createdAt: parseAgo(t.dateLabel, now) ?? new Date(now),
        },
      });
  }

  // --- 9. Self-check summary (acts as the acceptance hook for 2.2). ---
  const [orders, products, categories, users, shipments] = await Promise.all([
    db.order.count(), db.product.count(), db.category.count(), db.user.count(), db.shipment.count(),
  ]);
  const byStatus = await db.shipment.groupBy({ by: ["status"], _count: { _all: true } });
  console.log(
    `Seed OK: orders=${orders} products=${products} categories=${categories} users=${users} shipments=${shipments} statuses=${byStatus
      .map((s) => `${s.status}:${s._count._all}`)
      .join(",")}`,
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
