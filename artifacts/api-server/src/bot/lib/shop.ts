export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
  effect: string;
  type: "passive" | "instant";
}

export const SHOP_ITEMS: Record<string, ShopItem> = {
  multiplier: {
    id: "multiplier",
    name: "Multiplicador x2",
    emoji: "🎰",
    price: 300,
    description: "La siguiente partida de Blackjack paga el doble de ganancias",
    effect: "Ganancias ×2 en la próxima partida",
    type: "passive",
  },
  insurance: {
    id: "insurance",
    name: "Seguro de Apuesta",
    emoji: "🛡",
    price: 200,
    description: "Si pierdes en Blackjack, recuperas el 50% de tu apuesta",
    effect: "Recupera 50% en derrota",
    type: "passive",
  },
  chip_box: {
    id: "chip_box",
    name: "Caja de Fichas",
    emoji: "🎁",
    price: 150,
    description: "Contiene entre 75 y 500 fichas al azar",
    effect: "Abre al instante desde /inventory",
    type: "instant",
  },
  elite_chest: {
    id: "elite_chest",
    name: "Cofre Élite",
    emoji: "💎",
    price: 800,
    description: "Contiene entre 600 y 2500 fichas al azar",
    effect: "Abre al instante desde /inventory",
    type: "instant",
  },
};

export type ShopItemId = keyof typeof SHOP_ITEMS;

export const ITEM_REWARDS: Record<string, [number, number]> = {
  chip_box: [75, 500],
  elite_chest: [600, 2500],
};
