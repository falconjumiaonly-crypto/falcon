-- Migration: Add soft delete support to orders and initialize shipping rates in app_settings

-- 1. Add deleted_at to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index for active (non-deleted) orders
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at) WHERE deleted_at IS NULL;

-- 3. Composite indexes for duplicate detection performance
CREATE INDEX IF NOT EXISTS idx_orders_phone_total ON public.orders(phone_primary, order_total) WHERE deleted_at IS NULL;

-- 4. Seed initial shipping_rates into app_settings if not already present
INSERT INTO public.app_settings (key, value)
VALUES (
  'shipping_rates',
  '[
    {"name": "القاهرة", "rate": 65, "aliases": ["القاهره", "مصر", "cairo"]},
    {"name": "الجيزة", "rate": 65, "aliases": ["جيزه", "الجيزه", "giza", "الهرم", "فيصل", "أكتوبر", "اكتوبر", "الشيخ زايد"]},
    {"name": "الإسكندرية", "rate": 75, "aliases": ["اسكندرية", "اسكندريه", "الاسكندرية", "الاسكندريه", "alex", "alexandria"]},
    {"name": "الدقهلية", "rate": 75, "aliases": ["دقهلية", "دقهليه", "المنصورة", "المنصوره", "منصورة", "منصوره", "dakahlia"]},
    {"name": "القليوبية", "rate": 65, "aliases": ["قليوبية", "قليوبيه", "بنها", "شبرا الخيمة", "شبرا الخيمه", "العبور"]},
    {"name": "الشرقية", "rate": 75, "aliases": ["شرقية", "شرقيه", "الزقازيق", "زقازيق", "العاشر من رمضان"]},
    {"name": "الغربية", "rate": 75, "aliases": ["غربية", "غربيه", "طنطا", "المحلة", "المحلة الكبرى"]},
    {"name": "المنوفية", "rate": 75, "aliases": ["منوفية", "منوفيه", "شبين الكوم", "السادات"]},
    {"name": "البحيرة", "rate": 75, "aliases": ["بحيرة", "بحيره", "دمنهور", "كفر الدوار"]},
    {"name": "كفر الشيخ", "rate": 75, "aliases": ["كفرالشيخ", "دسوق"]},
    {"name": "دمياط", "rate": 75, "aliases": ["دمياط الجديدة", "رأس البر"]},
    {"name": "بورسعيد", "rate": 75, "aliases": ["بور سعيد", "بورفؤاد"]},
    {"name": "الإسماعيلية", "rate": 75, "aliases": ["اسماعيلية", "اسماعيليه", "الاسماعيلية", "الاسماعيليه"]},
    {"name": "السويس", "rate": 75, "aliases": ["سويس", "العين السخنة", "السخنة"]},
    {"name": "الفيوم", "rate": 85, "aliases": ["فيوم", "ابشواي"]},
    {"name": "بني سويف", "rate": 85, "aliases": ["بنى سويف", "بني_سويف"]},
    {"name": "المنيا", "rate": 90, "aliases": ["منيا", "ملوي"]},
    {"name": "أسيوط", "rate": 95, "aliases": ["اسيوط", "ديروط"]},
    {"name": "سوهاج", "rate": 100, "aliases": ["طهطا", "جرجا"]},
    {"name": "قنا", "rate": 100, "aliases": ["نجع حمادي", "قوص"]},
    {"name": "الأقصر", "rate": 105, "aliases": ["اقصر", "الاقصر", "اسنا"]},
    {"name": "أسوان", "rate": 110, "aliases": ["اسوان", "كوم امبو", "ادو"]},
    {"name": "البحر الأحمر", "rate": 110, "aliases": ["الغردقة", "غردقة", "الجونة", "سفاجا", "القصير", "مرسى علم"]},
    {"name": "الوادى الجديد", "rate": 120, "aliases": ["الخارجة", "الداخلة", "الوادي الجديد"]},
    {"name": "مطروح", "rate": 100, "aliases": ["مرسى مطروح", "الساحل الشمالي", "مارينا", "العلمين"]},
    {"name": "شمال سيناء", "rate": 110, "aliases": ["العريش", "بئر العبد"]},
    {"name": "جنوب سيناء", "rate": 110, "aliases": ["شرم الشيخ", "دهب", "نويبع", "طابا", "طور سيناء"]}
  ]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
