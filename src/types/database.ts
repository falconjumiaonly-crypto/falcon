export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PaymentStatus = "unpaid" | "partially_paid" | "fully_paid";
export type PrintStatus = "pending" | "printed";
export type DeliveryStatus = "new" | "handed_to_carrier" | "delivered" | "returned";
export type SettlementStatus = "pending" | "settled";

export type Database = {
  public: {
    Tables: {
      api_idempotency_keys: {
        Row: {
          created_at: string;
          id: string;
          idempotency_key: string;
          request_path: string;
          response_body: Json;
          response_status: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idempotency_key: string;
          request_path: string;
          response_body: Json;
          response_status: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          request_path?: string;
          response_body?: Json;
          response_status?: number;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          address: string;
          cod_amount: number;
          created_at: string;
          customer_name: string;
          delivery_status: DeliveryStatus;
          governorate: string;
          id: string;
          important_notes: string | null;
          landmark: string | null;
          net_profit: number;
          order_date: string;
          order_total: number;
          paid_amount: number;
          payment_status: PaymentStatus;
          phone_primary: string;
          phone_secondary: string | null;
          print_status: PrintStatus;
          printed_at: string | null;
          settled_at: string | null;
          settlement_status: SettlementStatus;
          shipping_cost: number;
          updated_at: string;
        };
        Insert: {
          address: string;
          cod_amount?: number;
          created_at?: string;
          customer_name: string;
          delivery_status?: DeliveryStatus;
          governorate: string;
          id?: string;
          important_notes?: string | null;
          landmark?: string | null;
          net_profit?: number;
          order_date?: string;
          order_total: number;
          paid_amount?: number;
          payment_status?: PaymentStatus;
          phone_primary: string;
          phone_secondary?: string | null;
          print_status?: PrintStatus;
          printed_at?: string | null;
          settled_at?: string | null;
          settlement_status?: SettlementStatus;
          shipping_cost: number;
          updated_at?: string;
        };
        Update: {
          address?: string;
          cod_amount?: number;
          created_at?: string;
          customer_name?: string;
          delivery_status?: DeliveryStatus;
          governorate?: string;
          id?: string;
          important_notes?: string | null;
          landmark?: string | null;
          net_profit?: number;
          order_date?: string;
          order_total?: number;
          paid_amount?: number;
          payment_status?: PaymentStatus;
          phone_primary?: string;
          phone_secondary?: string | null;
          print_status?: PrintStatus;
          printed_at?: string | null;
          settled_at?: string | null;
          settlement_status?: SettlementStatus;
          shipping_cost?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
export type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
export type AppSettingRow = Database["public"]["Tables"]["app_settings"]["Row"];

export interface FalconBrandingSettings {
  company_name: string;
  slogan: string;
  logo_url: string | null;
}

export interface FalconCompanyInfoSettings {
  sender_phone: string;
  return_address: string;
  default_notes: string;
}

export interface FalconWebhookSettings {
  webhook_url: string;
  webhook_secret: string;
  events_enabled: {
    order_created: boolean;
    order_delivered: boolean;
    order_settled: boolean;
  };
}
