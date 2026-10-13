import { DeliveryStatus, Order } from "@/types/database";

export type CarrierType = "bosta" | "jnt" | "aramex" | "generic";

export interface CarrierTrackingEvent {
  carrier: CarrierType;
  trackingNumber: string; // Carrier waybill or merchant order ID
  merchantOrderId?: string;
  status: DeliveryStatus;
  rawStatus: string;
  statusReason?: string;
  eventTimestamp?: string;
  recipientPhone?: string;
  codAmount?: number;
  notes?: string;
}

export interface CarrierStatusMappingResult {
  status: DeliveryStatus;
  labelAr: string;
  isDelivered: boolean;
  isReturn: boolean;
  isOutForDelivery: boolean;
}

export interface WebhookProcessingResult {
  success: boolean;
  message: string;
  orderId?: string;
  matchedBy?: "id" | "short_id" | "phone" | "notes";
  previousStatus?: string;
  newStatus?: DeliveryStatus;
  updatedOrder?: Order;
}
