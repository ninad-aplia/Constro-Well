// "Today's deals" product row (prototype `dl.slice(0,10)`, buildgrid-shop.html:412).
import { getTodaysDealsRow } from "@/lib/api/catalog";
import ProductRow from "./ProductRow";

export default async function TodaysDealsRow() {
  const items = await getTodaysDealsRow();
  return <ProductRow title="Today’s deals" items={items} />;
}
