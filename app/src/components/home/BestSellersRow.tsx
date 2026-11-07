// "Best sellers in cement, steel and sand" product row (prototype, buildgrid-shop.html:413).
import { getBestSellersRow } from "@/lib/api/catalogDb";
import ProductRow from "./ProductRow";

export default async function BestSellersRow() {
  const items = await getBestSellersRow();
  return <ProductRow title="Best sellers in cement, steel and sand" items={items} />;
}
