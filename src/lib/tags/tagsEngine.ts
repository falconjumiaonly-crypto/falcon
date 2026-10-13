import { Order } from "@/types/database";

export interface OrderTag {
  id: string;
  name: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  isPreset?: boolean;
}

export const COLOR_PALETTES: Record<
  string,
  { bgClass: string; textClass: string; borderClass: string }
> = {
  rose: {
    bgClass: "bg-rose-50",
    textClass: "text-rose-700",
    borderClass: "border-rose-200",
  },
  blue: {
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
    borderClass: "border-blue-200",
  },
  emerald: {
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-200",
  },
  amber: {
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
  },
  indigo: {
    bgClass: "bg-indigo-50",
    textClass: "text-indigo-700",
    borderClass: "border-indigo-200",
  },
  purple: {
    bgClass: "bg-purple-50",
    textClass: "text-purple-700",
    borderClass: "border-purple-200",
  },
  orange: {
    bgClass: "bg-orange-50",
    textClass: "text-orange-700",
    borderClass: "border-orange-200",
  },
  cyan: {
    bgClass: "bg-cyan-50",
    textClass: "text-cyan-700",
    borderClass: "border-cyan-200",
  },
  slate: {
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-200",
  },
};

export const PRESET_TAGS: OrderTag[] = [
  {
    id: "urgent",
    name: "عاجل / طوارئ",
    color: "rose",
    ...COLOR_PALETTES.rose,
    isPreset: true,
  },
  {
    id: "allow_inspection",
    name: "مسموح المعاينة",
    color: "blue",
    ...COLOR_PALETTES.blue,
    isPreset: true,
  },
  {
    id: "deposit_paid",
    name: "مدفوع عربون",
    color: "emerald",
    ...COLOR_PALETTES.emerald,
    isPreset: true,
  },
  {
    id: "phone_confirmed",
    name: "تأكيد هاتفياً",
    color: "indigo",
    ...COLOR_PALETTES.indigo,
    isPreset: true,
  },
  {
    id: "exchange_order",
    name: "استبدال مقاس",
    color: "amber",
    ...COLOR_PALETTES.amber,
    isPreset: true,
  },
  {
    id: "fragile",
    name: "قابل للكسر",
    color: "orange",
    ...COLOR_PALETTES.orange,
    isPreset: true,
  },
  {
    id: "free_shipping",
    name: "شحن مجاني",
    color: "cyan",
    ...COLOR_PALETTES.cyan,
    isPreset: true,
  },
  {
    id: "gift_pack",
    name: "تغليف هدايا",
    color: "purple",
    ...COLOR_PALETTES.purple,
    isPreset: true,
  },
];

/**
 * Creates a valid tag definition with appropriate Tailwind style classes
 */
export function createTagDefinition(
  id: string,
  name: string,
  color = "slate",
  isPreset = false
): OrderTag {
  const cleanId = id.trim().toLowerCase().replace(/\s+/g, "_");
  const palette = COLOR_PALETTES[color] || COLOR_PALETTES.slate;
  return {
    id: cleanId,
    name: name.trim(),
    color,
    ...palette,
    isPreset,
  };
}

/**
 * Extracts tag IDs from an order's notes string.
 * Supports syntax: [وسوم: عاجل, مسموح المعاينة] or [tags: urgent, allow_inspection] or hashtags #عاجل
 */
export function extractTagsFromNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];

  const tagIds: Set<string> = new Set();

  // Pattern 1: [وسوم: ...] or [tags: ...]
  const blockMatch = notes.match(/\[(?:وسوم|tags):\s*([^\]]+)\]/i);
  if (blockMatch && blockMatch[1]) {
    const rawTokens = blockMatch[1].split(/[,،]/).map((t) => t.trim().toLowerCase());
    for (const token of rawTokens) {
      if (!token) continue;
      // Match by ID, by exact Arabic name, or by substring (e.g. 'عاجل' in 'عاجل / طوارئ')
      const preset = PRESET_TAGS.find(
        (p) =>
          p.id === token ||
          p.name.toLowerCase() === token ||
          p.name.toLowerCase().includes(token) ||
          token.includes(p.name.toLowerCase())
      );
      if (preset) {
        tagIds.add(preset.id);
      } else {
        tagIds.add(token.replace(/\s+/g, "_"));
      }
    }
  }

  // Pattern 2: Hashtags like #عاجل or #معاينة
  const hashtags = notes.match(/#([\w\u0600-\u06FF_-]+)/g);
  if (hashtags) {
    for (const rawTag of hashtags) {
      const clean = rawTag.slice(1).trim().toLowerCase();
      const preset = PRESET_TAGS.find(
        (p) =>
          p.id === clean ||
          p.name.toLowerCase() === clean ||
          p.name.toLowerCase().includes(clean)
      );
      if (preset) {
        tagIds.add(preset.id);
      }
    }
  }

  return Array.from(tagIds);
}

/**
 * Removes the embedded `[وسوم: ...]` block from a notes string, keeping other merchant instructions intact
 */
export function stripTagsFromNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .replace(/\[(?:وسوم|tags):\s*[^\]]+\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Embeds tags into the order's notes string in Arabic format for couriers & waybill labels
 * e.g. "التسليم بعد 5 م [وسوم: عاجل، مسموح المعاينة]"
 */
export function embedTagsInNotes(
  cleanNotes: string | null | undefined,
  tagIds: string[],
  availableTags: OrderTag[] = PRESET_TAGS
): string {
  const stripped = stripTagsFromNotes(cleanNotes);
  if (tagIds.length === 0) return stripped;

  const names = tagIds.map((id) => {
    const found = availableTags.find((t) => t.id === id);
    return found ? found.name : id;
  });

  const tagBlock = `[وسوم: ${names.join("، ")}]`;
  return stripped ? `${stripped} ${tagBlock}` : tagBlock;
}

/**
 * Resolves full OrderTag objects from tag IDs using presets and custom tags list
 */
export function resolveOrderTags(
  tagIds: string[],
  customTags: OrderTag[] = []
): OrderTag[] {
  const allKnown = [...PRESET_TAGS, ...customTags];
  const results: OrderTag[] = [];

  for (const id of tagIds) {
    const cleanId = id.trim().toLowerCase();
    const found = allKnown.find((t) => t.id === cleanId || t.name.toLowerCase() === cleanId);
    if (found) {
      if (!results.some((r) => r.id === found.id)) {
        results.push(found);
      }
    } else {
      results.push(createTagDefinition(cleanId, id, "slate", false));
    }
  }

  return results;
}

/**
 * Determines all active tags for a given order (from mapped registry or embedded notes)
 */
export function getOrderTags(
  order: { id: string; important_notes?: string | null },
  customTags: OrderTag[] = [],
  tagsMap?: Record<string, string[]>
): OrderTag[] {
  const tagIds = new Set<string>();

  // Check tags registry map first if provided
  if (tagsMap && tagsMap[order.id]) {
    for (const t of tagsMap[order.id]) {
      tagIds.add(t);
    }
  }

  // Also check embedded notes
  const notesTags = extractTagsFromNotes(order.important_notes);
  for (const t of notesTags) {
    tagIds.add(t);
  }

  return resolveOrderTags(Array.from(tagIds), customTags);
}

/**
 * Checks if an order carries a specific tag
 */
export function orderHasTag(
  order: { id: string; important_notes?: string | null },
  tagId: string,
  tagsMap?: Record<string, string[]>
): boolean {
  if (tagId === "all" || !tagId) return true;
  const activeTags = getOrderTags(order, [], tagsMap);
  return activeTags.some((t) => t.id === tagId);
}

/**
 * Filters an array of orders by a tag ID
 */
export function filterOrdersByTag(
  orders: Order[],
  tagId: string,
  tagsMap?: Record<string, string[]>
): Order[] {
  if (!tagId || tagId === "all") return orders;
  return orders.filter((order) => orderHasTag(order, tagId, tagsMap));
}
