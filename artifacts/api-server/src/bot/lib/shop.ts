/**
 * Tienda del casino Zero Two.
 *
 * access:
 *  - public → cualquiera
 *  - beta   → beta testers (+ owners, vía isBetaTester)
 *  - owner  → solo OWNER_IDS
 */
import { isBetaTester } from "./betatesters.js";

export type ShopAccess = "public" | "beta" | "owner";

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
  effect: string;
  type: "passive" | "instant";
  /** Quién puede verlo/comprarlo en /shop */
  access: ShopAccess;
}

export const SHOP_ITEMS: Record<string, ShopItem> = {
  // ── Públicos ──────────────────────────────────────────────────────────────
  chip_pouch: {
    id: "chip_pouch",
    name: "Bolsa de Fichas",
    emoji: "🪙",
    price: 75,
    description: "Una bolsita con un puñado de fichas al azar",
    effect: "Abre al instante · 40–180 fichas",
    type: "instant",
    access: "public",
  },
  chip_box: {
    id: "chip_box",
    name: "Caja de Fichas",
    emoji: "🎁",
    price: 150,
    description: "Contiene entre 75 y 500 fichas al azar",
    effect: "Abre al instante desde /inventory",
    type: "instant",
    access: "public",
  },
  candy_box: {
    id: "candy_box",
    name: "Caja de Dulces",
    emoji: "🍬",
    price: 220,
    description: "Dulces del casino con premio aleatorio",
    effect: "Abre al instante · 120–450 fichas",
    type: "instant",
    access: "public",
  },
  insurance: {
    id: "insurance",
    name: "Seguro de Apuesta",
    emoji: "🛡",
    price: 200,
    description: "Si pierdes en Blackjack, recuperas el 50% de tu apuesta",
    effect: "Recupera 50% en derrota",
    type: "passive",
    access: "public",
  },
  multiplier: {
    id: "multiplier",
    name: "Multiplicador x2",
    emoji: "🎰",
    price: 300,
    description: "La siguiente partida de Blackjack paga el doble de ganancias",
    effect: "Ganancias ×2 en la próxima partida",
    type: "passive",
    access: "public",
  },
  silver_chest: {
    id: "silver_chest",
    name: "Cofre de Plata",
    emoji: "🥈",
    price: 350,
    description: "Botín de nivel intermedio del casino",
    effect: "Abre al instante · 250–900 fichas",
    type: "instant",
    access: "public",
  },
  gamblers_dice: {
    id: "gamblers_dice",
    name: "Dado del Apostador",
    emoji: "🎲",
    price: 400,
    description: "Tira el dado: puede ser un fiasco o un golpe de suerte",
    effect: "Abre al instante · 1–1.200 fichas",
    type: "instant",
    access: "public",
  },
  neon_crate: {
    id: "neon_crate",
    name: "Caja Neón",
    emoji: "💜",
    price: 550,
    description: "Estilo cyberpunk con recompensa media-alta",
    effect: "Abre al instante · 400–1.500 fichas",
    type: "instant",
    access: "public",
  },
  elite_chest: {
    id: "elite_chest",
    name: "Cofre Élite",
    emoji: "💎",
    price: 800,
    description: "Contiene entre 600 y 2500 fichas al azar",
    effect: "Abre al instante desde /inventory",
    type: "instant",
    access: "public",
  },
  gold_chest: {
    id: "gold_chest",
    name: "Cofre de Oro",
    emoji: "🏆",
    price: 1_500,
    description: "El botín grande del piso VIP",
    effect: "Abre al instante · 1.200–4.500 fichas",
    type: "instant",
    access: "public",
  },
  jackpot_ticket: {
    id: "jackpot_ticket",
    name: "Ticket Jackpot",
    emoji: "🎫",
    price: 2_000,
    description: "Un boleto con chance de premio gordo (o casi nada)",
    effect: "Abre al instante · 50–8.000 fichas",
    type: "instant",
    access: "public",
  },

  // ── Exclusivos Beta 🧪 ────────────────────────────────────────────────────
  beta_crate: {
    id: "beta_crate",
    name: "Caja del Laboratorio",
    emoji: "🧪",
    price: 100,
    description: "Exclusiva de beta testers. Recompensa generosa a precio de prueba",
    effect: "Abre al instante · 800–3.500 fichas · 🧪 Beta",
    type: "instant",
    access: "beta",
  },
  multiplier_beta: {
    id: "multiplier_beta",
    name: "Multi ×2 Beta",
    emoji: "🔬",
    price: 80,
    description: "Misma potencia que el multiplicador normal, precio de lab",
    effect: "Ganancias ×2 en la próxima partida · 🧪 Beta",
    type: "passive",
    access: "beta",
  },
  insurance_full: {
    id: "insurance_full",
    name: "Seguro Total Beta",
    emoji: "🧬",
    price: 150,
    description: "Si pierdes en Blackjack, recuperas el 100% de la apuesta",
    effect: "Recupera 100% en derrota · 🧪 Beta",
    type: "passive",
    access: "beta",
  },
  beta_vault: {
    id: "beta_vault",
    name: "Bóveda Beta",
    emoji: "📦",
    price: 250,
    description: "Caja sellada del programa beta — alto techo de premio",
    effect: "Abre al instante · 2.000–9.000 fichas · 🧪 Beta",
    type: "instant",
    access: "beta",
  },
  pity_protocol: {
    id: "pity_protocol",
    name: "Protocolo Pity",
    emoji: "🩹",
    price: 50,
    description: "Cuando el lab se apiada de ti: premio de consolación decente",
    effect: "Abre al instante · 300–1.000 fichas · 🧪 Beta",
    type: "instant",
    access: "beta",
  },

  // ── Exclusivos Dev / Owner 👑 ─────────────────────────────────────────────
  debug_chips: {
    id: "debug_chips",
    name: "Debug Chips",
    emoji: "🐛",
    price: 1,
    description: "Solo owners. Inyecta un fajo de fichas de prueba",
    effect: "Abre al instante · 10.000–50.000 fichas · 👑 Dev",
    type: "instant",
    access: "owner",
  },
  dev_vault: {
    id: "dev_vault",
    name: "Bóveda del Core",
    emoji: "👑",
    price: 10,
    description: "Tesorería del owner — recompensa absurda a precio simbólico",
    effect: "Abre al instante · 25.000–100.000 fichas · 👑 Dev",
    type: "instant",
    access: "owner",
  },
  darling_heart: {
    id: "darling_heart",
    name: "Corazón de Darling",
    emoji: "💗",
    price: 5,
    description: "Ítem legendario del núcleo Zero Two (solo owners)",
    effect: "Abre al instante · 15.000–75.000 fichas · 👑 Dev",
    type: "instant",
    access: "owner",
  },
  dev_multiplier: {
    id: "dev_multiplier",
    name: "Multi ×2 Dev",
    emoji: "⚙️",
    price: 1,
    description: "Multiplicador de pruebas para owners",
    effect: "Ganancias ×2 en la próxima partida · 👑 Dev",
    type: "passive",
    access: "owner",
  },
  source_code: {
    id: "source_code",
    name: "Fragmento de Código",
    emoji: "📜",
    price: 0,
    description: "Reliquia del repositorio. Casi gratis… porque puedes",
    effect: "Abre al instante · 5.000–20.000 fichas · 👑 Dev",
    type: "instant",
    access: "owner",
  },
};

export type ShopItemId = keyof typeof SHOP_ITEMS;

/** Rangos [min, max] de fichas al abrir ítems instantáneos */
export const ITEM_REWARDS: Record<string, [number, number]> = {
  chip_pouch: [40, 180],
  chip_box: [75, 500],
  candy_box: [120, 450],
  silver_chest: [250, 900],
  gamblers_dice: [1, 1_200],
  neon_crate: [400, 1_500],
  elite_chest: [600, 2_500],
  gold_chest: [1_200, 4_500],
  jackpot_ticket: [50, 8_000],
  // beta
  beta_crate: [800, 3_500],
  beta_vault: [2_000, 9_000],
  pity_protocol: [300, 1_000],
  // owner
  debug_chips: [10_000, 50_000],
  dev_vault: [25_000, 100_000],
  darling_heart: [15_000, 75_000],
  source_code: [5_000, 20_000],
};

/** Ítems pasivos que activan multiplicador ×2 en Blackjack */
export const MULTIPLIER_ITEM_IDS = [
  "multiplier",
  "multiplier_beta",
  "dev_multiplier",
] as const;

/** Ítems pasivos de seguro 50% */
export const INSURANCE_ITEM_IDS = ["insurance"] as const;

/** Seguro 100% de la apuesta (beta / dev) */
export const FULL_INSURANCE_ITEM_IDS = ["insurance_full"] as const;

function parseOwnerIds(): string[] {
  return (process.env.OWNER_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isShopOwner(userId: string): boolean {
  return parseOwnerIds().includes(userId);
}

export function accessBadge(access: ShopAccess): string {
  if (access === "beta") return "🧪 Beta";
  if (access === "owner") return "👑 Dev";
  return "🌐 Público";
}

export function canAccessShopItem(userId: string, item: ShopItem): boolean {
  if (item.access === "public") return true;
  if (item.access === "owner") return isShopOwner(userId);
  // beta: testers + owners (isBetaTester ya incluye owners)
  if (item.access === "beta") return isBetaTester(userId);
  return false;
}

/** Ítems visibles/comprables para este usuario (orden: públicos → beta → owner) */
export function listShopItemsFor(userId: string): ShopItem[] {
  const order: Record<ShopAccess, number> = {
    public: 0,
    beta: 1,
    owner: 2,
  };
  return Object.values(SHOP_ITEMS)
    .filter((item) => canAccessShopItem(userId, item))
    .sort((a, b) => {
      const byAccess = order[a.access] - order[b.access];
      if (byAccess !== 0) return byAccess;
      return a.price - b.price;
    });
}

export function rollInstantReward(itemId: string): number {
  const range = ITEM_REWARDS[itemId];
  if (!range) return 0;
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
