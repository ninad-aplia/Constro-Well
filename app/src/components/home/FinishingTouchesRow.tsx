// "Finishing touches: tiles, paint, doors and fittings" product row (prototype, buildgrid-shop.html:414).
import { getFinishingTouchesRow } from "@/lib/api/catalogDb";
import ProductRow from "./ProductRow";

export default async function FinishingTouchesRow() {
  const items = await getFinishingTouchesRow();
  return <ProductRow title="Finishing touches: tiles, paint, doors and fittings" items={items} />;
}
