import { OrdersTable } from "@/components/orders/OrdersTable";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <OrdersTable pageTitle="إدارة الطلبات" />
    </div>
  );
}
