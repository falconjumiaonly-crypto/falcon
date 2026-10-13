import { getInventoryProductsAction } from "@/app/actions/inventory";
import { DEFAULT_INVENTORY_PRODUCTS } from "@/lib/inventory/inventoryEngine";
import { InventoryManagementView } from "@/components/inventory/InventoryManagementView";

export const metadata = {
  title: "إدارة المخزون وعهدة البضاعة | فلكون للشحن",
  description: "متابعة دقيقة للأصناف المتاحة للبيع، المحجوز للأوردرات، المشحون في السوق، وتنبيهات نواقص المخزن.",
};

export default async function InventoryPage() {
  const res = await getInventoryProductsAction();
  const products = res.success && res.data ? res.data : DEFAULT_INVENTORY_PRODUCTS;

  return <InventoryManagementView initialProducts={products} />;
}
