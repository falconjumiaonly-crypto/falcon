export interface CarrierConfig {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  baseCost: number;
  avgDeliveryDays: number;
  expectedDeliveryRate: number;
  merchantAccountId?: string;
  apiKey?: string;
  supportPhone?: string;
  allowOpenPackage: boolean;
  notes?: string;
  isCustom?: boolean;
}

export const DEFAULT_CARRIER_CONFIGS: CarrierConfig[] = [
  {
    id: "bosta",
    nameAr: "بوسطة",
    nameEn: "Bosta",
    isActive: true,
    baseCost: 65,
    avgDeliveryDays: 1.5,
    expectedDeliveryRate: 93,
    merchantAccountId: "BOSTA-MERCHANT-01",
    apiKey: "",
    supportPhone: "19035",
    allowOpenPackage: true,
    notes: "تسليم سريع داخل القاهرة الكبرى والإسكندرية والمدن الرئيسية",
  },
  {
    id: "jnt",
    nameAr: "جي آند تي إكسبريس",
    nameEn: "J&T Express",
    isActive: true,
    baseCost: 60,
    avgDeliveryDays: 1.8,
    expectedDeliveryRate: 91,
    merchantAccountId: "JNT-EGY-882",
    apiKey: "",
    supportPhone: "15246",
    allowOpenPackage: true,
    notes: "تغطية قوية جداً لمحافظات الدلتا والوجه البحري وأسعار اقتصادية",
  },
  {
    id: "aramex",
    nameAr: "أرامكس",
    nameEn: "Aramex",
    isActive: true,
    baseCost: 75,
    avgDeliveryDays: 2.2,
    expectedDeliveryRate: 88,
    merchantAccountId: "ARX-CAI-9901",
    apiKey: "",
    supportPhone: "16996",
    allowOpenPackage: false,
    notes: "الأعلى موثوقية في محافظات الصعيد والبحر الأحمر والمدن الحدودية",
  },
  {
    id: "mylerz",
    nameAr: "مايلرز",
    nameEn: "Mylerz",
    isActive: true,
    baseCost: 60,
    avgDeliveryDays: 1.5,
    expectedDeliveryRate: 90,
    merchantAccountId: "MYLERZ-EG-440",
    apiKey: "",
    supportPhone: "19234",
    allowOpenPackage: true,
    notes: "توصيل في اليوم التالي في القاهرة والجيزة وتتبع متقدم",
  },
  {
    id: "self_courier",
    nameAr: "مندوب خاص / شحن ذاتي",
    nameEn: "Internal / Self Courier",
    isActive: true,
    baseCost: 50,
    avgDeliveryDays: 1.0,
    expectedDeliveryRate: 96,
    merchantAccountId: "COURIER-INTERNAL-01",
    apiKey: "",
    supportPhone: "01000000000",
    allowOpenPackage: true,
    notes: "تسليم يدوي مباشر وفوري للمناطق والمحافظات القريبة",
  },
];
