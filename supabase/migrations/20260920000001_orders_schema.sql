-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL,
  phone_primary TEXT NOT NULL,
  phone_secondary TEXT,
  governorate TEXT NOT NULL,
  address TEXT NOT NULL,
  landmark TEXT,
  important_notes TEXT,
  order_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cod_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  print_status TEXT NOT NULL DEFAULT 'pending',
  printed_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'new',
  settlement_status TEXT NOT NULL DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation constraints
  CONSTRAINT check_order_total_non_negative CHECK (order_total >= 0),
  CONSTRAINT check_paid_amount_non_negative CHECK (paid_amount >= 0),
  CONSTRAINT check_paid_amount_not_exceed_total CHECK (paid_amount <= order_total),
  CONSTRAINT check_shipping_cost_non_negative CHECK (shipping_cost >= 0),
  CONSTRAINT check_payment_status CHECK (payment_status IN ('unpaid', 'partially_paid', 'fully_paid')),
  CONSTRAINT check_print_status CHECK (print_status IN ('pending', 'printed')),
  CONSTRAINT check_delivery_status CHECK (delivery_status IN ('new', 'handed_to_carrier', 'delivered', 'returned')),
  CONSTRAINT check_settlement_status CHECK (settlement_status IN ('pending', 'settled'))
);

-- Trigger function to keep cod_amount, net_profit, payment_status, and updated_at automatically in sync
CREATE OR REPLACE FUNCTION public.sync_order_calculated_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- COD = max(order_total - paid_amount, 0)
  NEW.cod_amount := GREATEST(NEW.order_total - NEW.paid_amount, 0);

  -- Falcon Net Profit = order_total - shipping_cost
  NEW.net_profit := NEW.order_total - NEW.shipping_cost;

  -- Payment Status
  IF NEW.paid_amount <= 0 THEN
    NEW.payment_status := 'unpaid';
  ELSIF NEW.paid_amount >= NEW.order_total THEN
    NEW.payment_status := 'fully_paid';
  ELSE
    NEW.payment_status := 'partially_paid';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_order_calculated_fields ON public.orders;
CREATE TRIGGER trigger_sync_order_calculated_fields
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_calculated_fields();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_print_status ON public.orders(print_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON public.orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_settlement_status ON public.orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_phone_primary ON public.orders(phone_primary);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Internal team RLS policy: Only authenticated users can access orders
DROP POLICY IF EXISTS "Allow authenticated users full access to orders" ON public.orders;
CREATE POLICY "Allow authenticated users full access to orders"
ON public.orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users full access to app_settings" ON public.app_settings;
CREATE POLICY "Allow authenticated users full access to app_settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- API Idempotency Keys Table for Make.com / n8n
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  request_path TEXT NOT NULL,
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON public.api_idempotency_keys(idempotency_key);
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users access to api_idempotency_keys" ON public.api_idempotency_keys;
CREATE POLICY "Allow authenticated users access to api_idempotency_keys"
ON public.api_idempotency_keys
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Storage bucket for Falcon logo and assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('falcon-assets', 'falcon-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for falcon-assets
DROP POLICY IF EXISTS "Allow public read of falcon-assets" ON storage.objects;
CREATE POLICY "Allow public read of falcon-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'falcon-assets');

DROP POLICY IF EXISTS "Allow authenticated upload of falcon-assets" ON storage.objects;
CREATE POLICY "Allow authenticated upload of falcon-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'falcon-assets');

DROP POLICY IF EXISTS "Allow authenticated update of falcon-assets" ON storage.objects;
CREATE POLICY "Allow authenticated update of falcon-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'falcon-assets')
WITH CHECK (bucket_id = 'falcon-assets');

DROP POLICY IF EXISTS "Allow authenticated delete of falcon-assets" ON storage.objects;
CREATE POLICY "Allow authenticated delete of falcon-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'falcon-assets');
