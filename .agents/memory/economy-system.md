---
name: Economy system design
description: How the ZeroTwo Blackjack economy is structured across files
---

# Economy system

## Architecture
- `lib/db/src/schema/economy.ts` — `economyTable` (balance, earned, lost, gamesPlayed, gamesWon, streak, lastDaily) + `inventoryTable` (composite PK: guildId+userId+itemId, quantity)
- `artifacts/api-server/src/bot/lib/economy.ts` — helpers: getEconomy, getBalance, addBalance, deductBalance, recordGame, claimDaily, inventory CRUD, calculateBlackjackPayout
- `artifacts/api-server/src/bot/lib/shop.ts` — SHOP_ITEMS dict + ITEM_REWARDS for instant items
- Starting balance: 500 fichas. Daily base: 200 + min(streak*50, 350). Cooldown: 24h.

## Blackjack flow
1. `/blackjack` → fetches balance → shows buildBetMenu(userId, balance) filtered to affordable options
2. `bj_bet` handler: deductBalance → hasItem/useItem (multiplier, insurance) → start game
3. Each game-end path (bust/hit-21/stand/double): calculateBlackjackPayout → addBalance if payout>0 → getBalance → recordGame → set state.netLabel + state.finalBalance
4. `buildEmbed` uses state.netLabel + state.finalBalance for post-game display

## Passive items (auto-consumed on bj_bet)
- multiplier: 2× net winnings
- insurance: recover 50% of bet on bust/lose

## Instant items (used via /inventory button)
- chip_box: 50–200 fichas
- elite_chest: 300–800 fichas

**Why:** Items are consumed at bet-time (bj_bet) not at game-start to prevent exploit of opening inventory mid-game. payout function takes status string, not GameStatus type, for flexibility.
