/**
 * Mock Seller Hub data — transcribed from buildgrid-seller-dashboard.html's
 * `seed()` (store profile, products, orders, vehicles, transfers, reviews).
 * Names, prices and specs are the prototype's, not invented.
 *
 * Deadline/date fields are fixed display labels, not live timestamps — this
 * is a static preview (no 30s timer tick, no demo time-travel controls; the
 * project's own prototype audit flags those as dev-only, never a production
 * surface), so "Accept within 2h 10m" is sample content here, not a real,
 * ticking deadline. Swap point: when seller auth/backend lands, this file is
 * replaced by real per-seller data from the database.
 */
import type { SellerState } from "@/lib/seller/types";

export function createSellerSeed(): SellerState {
  return {
    store: {
      name: "UltraBuild Co.",
      owner: "Imran Shaikh",
      gstin: "29AABCU9603R1ZX",
      phone: "9845012345",
      city: "Bengaluru",
      address: "Plot 22, Yeshwanthpur Industrial Suburb",
      bank: "HDFC Bank •••• 4821",
      kyc: { gst: "Verified", pan: "Verified", cheque: "Pending" },
    },
    stats: { offered: 120, accepted: 116, dispatched: 114, ontime: 109, delivered: 112, issues: 3 },
    vacationMode: false,
    rules: { freeAbove: 5000, fee: 199, slotsPerDay: [3, 3, 2] },
    serviceAreas: ["560001", "560003", "560022", "560066", "560064", "562107"],
    vehicles: [
      { id: "v1", regNumber: "KA01AB4521", type: "Tata 407, 2.5 tonne", driverId: "d1" },
      { id: "v2", regNumber: "KA05MH7788", type: "Eicher 14 ft, 6 tonne", driverId: "d2" },
      { id: "v3", regNumber: "KA03CD9012", type: "Mahindra Bolero Pickup, 1.5 tonne", driverId: "d3" },
    ],
    drivers: [
      { id: "d1", name: "Ramesh Kumar", phone: "9845012345" },
      { id: "d2", name: "Imtiyaz Khan", phone: "9886011122" },
      { id: "d3", name: "Naveen R", phone: "9900112233" },
    ],
    products: [
      { id: "p1", name: "OPC 53 Grade Cement, 50 kg bag", category: "Cement", unit: "bag", weightKg: 50, mrp: 460, price: 390, stock: 420, reorderLevel: 100, minOrderQty: 10, status: "active", bulk: true, sold: 1840 },
      { id: "p2", name: "PPC Cement, 50 kg bag", category: "Cement", unit: "bag", weightKg: 50, mrp: 430, price: 365, stock: 86, reorderLevel: 100, minOrderQty: 10, status: "active", bulk: true, sold: 1210 },
      { id: "p3", name: "White Cement, 5 kg pack", category: "White", unit: "pack", weightKg: 5, mrp: 520, price: 430, stock: 34, reorderLevel: 40, minOrderQty: 2, status: "active", bulk: false, sold: 310 },
      { id: "p4", name: "Rapid-Set Cement, 25 kg bag", category: "Cement", unit: "bag", weightKg: 25, mrp: 980, price: 820, stock: 14, reorderLevel: 30, minOrderQty: 2, status: "active", bulk: false, sold: 96 },
      { id: "p5", name: "Wall Putty, 40 kg bag", category: "Mortar", unit: "bag", weightKg: 40, mrp: 1550, price: 1250, stock: 260, reorderLevel: 60, minOrderQty: 5, status: "active", bulk: false, sold: 640 },
      { id: "p6", name: "Dry Mortar Plaster Mix, 40 kg", category: "Mortar", unit: "bag", weightKg: 40, mrp: 460, price: 380, stock: 500, reorderLevel: 80, minOrderQty: 10, status: "active", bulk: false, sold: 720 },
      { id: "p7", name: "Tile Adhesive, 20 kg bag", category: "Mortar", unit: "bag", weightKg: 20, mrp: 640, price: 520, stock: 0, reorderLevel: 50, minOrderQty: 5, status: "paused", bulk: false, sold: 410 },
      { id: "p8", name: "Non-Shrink Grout, 25 kg bag", category: "Mortar", unit: "bag", weightKg: 25, mrp: 1700, price: 1450, stock: 90, reorderLevel: 20, minOrderQty: 2, status: "active", bulk: false, sold: 88 },
    ],
    orders: [
      { id: "BG-50238", buyer: "Rahul M.", city: "Bengaluru", pin: "560066", productId: "p1", productName: "OPC 53 Grade Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 390, qty: 200, weightKg: 50, bulk: true, createdLabel: "42 minutes ago", status: "new", acceptByLabel: "3h 18m left", withdrawn: false, events: [{ at: "42 minutes ago", message: "Order paid by customer, amount held in escrow" }] },
      { id: "BG-50237", buyer: "Sunita K.", city: "Bengaluru", pin: "560022", productId: "p5", productName: "Wall Putty, 40 kg bag", productCategory: "Mortar", unit: "bag", price: 1250, qty: 40, weightKg: 40, bulk: false, createdLabel: "1h 48m ago", status: "new", acceptByLabel: "2h 12m left", withdrawn: false, events: [{ at: "1h 48m ago", message: "Order paid by customer, amount held in escrow" }] },
      { id: "BG-50236", buyer: "Harish B.", city: "Hosur", pin: "562107", productId: "p1", productName: "OPC 53 Grade Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 390, qty: 120, weightKg: 50, bulk: true, createdLabel: "2h 42m ago", status: "new", acceptByLabel: "1h 18m left", withdrawn: false, events: [{ at: "2h 42m ago", message: "Order paid by customer, amount held in escrow" }] },
      { id: "BG-50233", buyer: "Lakshmi V.", city: "Bengaluru", pin: "560003", productId: "p1", productName: "OPC 53 Grade Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 390, qty: 60, weightKg: 50, bulk: true, createdLabel: "6 hours ago", status: "accepted", dispatchByLabel: "17h left", withdrawn: false, events: [{ at: "6 hours ago", message: "Order paid by customer, amount held in escrow" }, { at: "5 hours ago", message: "Accepted" }] },
      { id: "BG-50232", buyer: "Ajay D.", city: "Bengaluru", pin: "560064", productId: "p6", productName: "Dry Mortar Plaster Mix, 40 kg", productCategory: "Mortar", unit: "bag", price: 380, qty: 150, weightKg: 40, bulk: false, createdLabel: "27 hours ago", status: "packed", dispatchByLabel: "overdue 1h", late: true, withdrawn: false, events: [{ at: "27 hours ago", message: "Order paid by customer, amount held in escrow" }, { at: "26 hours ago", message: "Accepted" }, { at: "8 hours ago", message: "Packed and ready for pickup" }] },
      { id: "BG-50231", buyer: "Rahul M.", city: "Bengaluru", pin: "560066", productId: "p1", productName: "OPC 53 Grade Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 390, qty: 100, weightKg: 50, bulk: true, createdLabel: "18 hours ago", status: "dispatched", slot: "Today, 2 to 6 pm", vehicleId: "v1", docs: { challan: true, invoice: true }, withdrawn: false, events: [{ at: "17 hours ago", message: "Accepted" }, { at: "2 hours ago", message: "Dispatched with KA01AB4521, customer OTP generated" }] },
      { id: "BG-50229", buyer: "Priyanka T.", city: "Bengaluru", pin: "560001", productId: "p2", productName: "PPC Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 365, qty: 80, weightKg: 50, bulk: true, createdLabel: "30 hours ago", status: "dispatched", slot: "Tomorrow, 2 to 6 pm", vehicleId: "v3", docs: { challan: true, invoice: true }, withdrawn: false, events: [{ at: "28 hours ago", message: "Accepted" }, { at: "3 hours ago", message: "Dispatched with KA03CD9012, customer OTP generated" }] },
      { id: "BG-50226", buyer: "Mohammed A.", city: "Mysuru", pin: "570001", productId: "p5", productName: "Wall Putty, 40 kg bag", productCategory: "Mortar", unit: "bag", price: 1250, qty: 60, weightKg: 40, bulk: false, createdLabel: "2 days ago", status: "review", slot: "Yesterday", vehicleId: "v2", docs: { challan: true, invoice: true }, deliveredAtLabel: "6 hours ago", reviewEndsLabel: "18h left", withdrawn: false, events: [{ at: "6 hours ago", message: "Delivered with OTP and photo proof" }] },
      { id: "BG-50225", buyer: "Karthik N.", city: "Tumakuru", pin: "572101", productId: "p6", productName: "Dry Mortar Plaster Mix, 40 kg", productCategory: "Mortar", unit: "bag", price: 380, qty: 300, weightKg: 40, bulk: false, createdLabel: "2 days ago", status: "review", slot: "Yesterday", vehicleId: "v1", docs: { challan: true, invoice: true }, deliveredAtLabel: "18 hours ago", reviewEndsLabel: "6h left", withdrawn: false, events: [{ at: "18 hours ago", message: "Delivered with OTP and photo proof" }] },
      { id: "BG-50221", buyer: "Deepa R.", city: "Bengaluru", pin: "560022", productId: "p3", productName: "White Cement, 5 kg pack", productCategory: "White", unit: "pack", price: 430, qty: 40, weightKg: 5, bulk: false, createdLabel: "3 days ago", status: "disputed", slot: "Yesterday", vehicleId: "v3", docs: { challan: true, invoice: true }, deliveredAtLabel: "10 hours ago", issue: { type: "Damaged goods", note: "4 packs had broken seals.", claim: 1720 }, withdrawn: false, events: [{ at: "10 hours ago", message: "Delivered" }, { at: "9 hours ago", message: "Customer reported damaged goods, payout frozen" }] },
      { id: "BG-50219", buyer: "Rohit S.", city: "Bengaluru", pin: "560003", productId: "p1", productName: "OPC 53 Grade Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 390, qty: 150, weightKg: 50, bulk: true, createdLabel: "5 days ago", status: "settled", slot: "Delivered", vehicleId: "v1", docs: { challan: true, invoice: true }, deliveredAtLabel: "5 days ago", paidAtLabel: "4 days ago", withdrawn: false, events: [{ at: "4 days ago", message: "Review window closed, payout released" }] },
      { id: "BG-50217", buyer: "Anita K.", city: "Bengaluru", pin: "560003", productId: "p2", productName: "PPC Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 365, qty: 100, weightKg: 50, bulk: true, createdLabel: "8 days ago", status: "settled", slot: "Delivered", vehicleId: "v1", docs: { challan: true, invoice: true }, deliveredAtLabel: "8 days ago", paidAtLabel: "7 days ago", withdrawn: false, events: [{ at: "7 days ago", message: "Review window closed, payout released" }] },
      { id: "BG-50214", buyer: "Vikram P.", city: "Bengaluru", pin: "560003", productId: "p5", productName: "Wall Putty, 40 kg bag", productCategory: "Mortar", unit: "bag", price: 1250, qty: 30, weightKg: 40, bulk: false, createdLabel: "9 days ago", status: "settled", slot: "Delivered", vehicleId: "v1", docs: { challan: true, invoice: true }, deliveredAtLabel: "9 days ago", paidAtLabel: "8 days ago", withdrawn: true, events: [{ at: "8 days ago", message: "Review window closed, payout released" }] },
      { id: "BG-50211", buyer: "Sunita K.", city: "Bengaluru", pin: "560003", productId: "p6", productName: "Dry Mortar Plaster Mix, 40 kg", productCategory: "Mortar", unit: "bag", price: 380, qty: 200, weightKg: 40, bulk: false, createdLabel: "12 days ago", status: "settled", slot: "Delivered", vehicleId: "v1", docs: { challan: true, invoice: true }, deliveredAtLabel: "12 days ago", paidAtLabel: "11 days ago", withdrawn: true, events: [{ at: "11 days ago", message: "Review window closed, payout released" }] },
      { id: "BG-50208", buyer: "Harish B.", city: "Bengaluru", pin: "560003", productId: "p1", productName: "OPC 53 Grade Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 390, qty: 80, weightKg: 50, bulk: true, createdLabel: "16 days ago", status: "settled", slot: "Delivered", vehicleId: "v1", docs: { challan: true, invoice: true }, deliveredAtLabel: "16 days ago", paidAtLabel: "15 days ago", withdrawn: true, events: [{ at: "15 days ago", message: "Review window closed, payout released" }] },
      { id: "BG-50204", buyer: "Lakshmi V.", city: "Bengaluru", pin: "560003", productId: "p2", productName: "PPC Cement, 50 kg bag", productCategory: "Cement", unit: "bag", price: 365, qty: 250, weightKg: 50, bulk: true, createdLabel: "20 days ago", status: "settled", slot: "Delivered", vehicleId: "v1", docs: { challan: true, invoice: true }, deliveredAtLabel: "20 days ago", paidAtLabel: "19 days ago", withdrawn: true, events: [{ at: "19 days ago", message: "Review window closed, payout released" }] },
    ],
    transfers: [
      { id: "T-2231", dateLabel: "8 days ago", amount: 182400, bank: "HDFC Bank •••• 4821" },
      { id: "T-2198", dateLabel: "15 days ago", amount: 164950, bank: "HDFC Bank •••• 4821" },
    ],
    reviews: [
      { name: "Rohit S.", stars: 5, title: "Cement bags were intact and the truck arrived on time. Good packing.", daysAgo: 2, productName: "OPC 53 Grade Cement" },
      { name: "Anita K.", stars: 5, title: "Fast dispatch and clear documents. Will order again.", daysAgo: 4, productName: "Wall Putty" },
      { name: "Vikram P.", stars: 4, title: "Good quality. Delivery was a few hours late.", daysAgo: 6, productName: "PPC Cement" },
      { name: "Deepa R.", stars: 5, title: "Accurate quantity and a helpful driver.", daysAgo: 9, productName: "Dry Mortar Plaster Mix" },
      { name: "Karthik N.", stars: 3, title: "Two bags had small tears, but the vendor replied quickly.", daysAgo: 12, productName: "OPC 53 Grade Cement" },
      { name: "Farhan Q.", stars: 5, title: "Best price in Yeshwanthpur with bulk discount.", daysAgo: 15, productName: "PPC Cement" },
    ],
    dailySales: buildDailySales(),
    notifications: [
      { id: "n1", atLabel: "42 minutes ago", message: "New order BG-50238: 200 bags OPC 53 cement", read: false },
      { id: "n2", atLabel: "1h 48m ago", message: "New order BG-50237: 40 bags wall putty", read: false },
      { id: "n3", atLabel: "2h 42m ago", message: "New order BG-50236: 120 bags OPC 53 cement", read: false },
      { id: "n4", atLabel: "6 hours ago", message: "Dispute opened on BG-50221 (damaged goods). Payout frozen.", read: true },
    ],
    preferences: { newOrder: true, deadlineReminders: true, lowStock: true, payouts: true },
  };
}

/** Deterministic 180-day daily-sales series (prototype's seeded weekday-weighted trend), seeded — not random noise on every load. */
function buildDailySales(): number[] {
  let seed = 11;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const weekdayWeight = [0.7, 1.05, 1.1, 1.05, 1.1, 1.15, 0.8];
  const days: number[] = [];
  for (let i = 0; i < 180; i++) {
    const weight = weekdayWeight[i % 7];
    const trend = 0.6 + (i / 180) * 0.9;
    days.push(Math.round(((52000 + rand() * 30000) * weight * trend) / 100) * 100);
  }
  return days;
}
