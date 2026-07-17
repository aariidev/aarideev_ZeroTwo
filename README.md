<div align="center">

<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>

<br/>

# ✦ ZeroTwo ✦

**A powerful, modular Discord bot with a real-time cyberpunk dashboard**  
*Rebuilt from the ground up in TypeScript — fast, clean, and production-ready.*

<br/>

[![Version](https://img.shields.io/badge/version-2.3.0-ec4899?style=for-the-badge&labelColor=0d0d0d)](https://github.com/aariidev/aarideev_ZeroTwo/releases)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white&labelColor=0d0d0d)](https://discord.js.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0d0d0d)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black&labelColor=0d0d0d)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-336791?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=0d0d0d)](https://orm.drizzle.team)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?style=for-the-badge&logo=pnpm&logoColor=white&labelColor=0d0d0d)](https://pnpm.io)

<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>

</div>

<br/>

## 🖥️ Dashboard Preview

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Overview</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-home.jpg" alt="Dashboard Overview" width="100%"/>
    </td>
    <td align="center" width="50%">
      <strong>Command Analytics</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-commands.jpg" alt="Commands Stats" width="100%"/>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>Server Browser</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-guilds.jpg" alt="Servers" width="100%"/>
    </td>
    <td align="center" width="50%">
      <strong>Warnings Manager</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-warns.jpg" alt="Warnings" width="100%"/>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <strong>System Logs</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-logs.jpg" alt="System Logs" width="100%"/>
    </td>
  </tr>
</table>

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>
</div>

<br/>

## ✨ Features

<table>
  <tr>
    <td valign="top" width="50%">

### 🤖 Bot
- **33 slash commands** — utility, moderation, fun & economy
- **Cooldown system** — per-user, per-command rate limiting
- **Permission enforcement** — hierarchy checks before every action
- **DM notifications** — users are notified on ban, kick or warn
- **Async activity logging** — buffered bulk insert to PostgreSQL
- **Server event logs** — mod, messages, members, channels, roles, invites & voice
- **Configurable log channel** — `/cfglogs` + dashboard per guild
- **Rich presence** — `/help - v2.3.0`
- **Maintenance mode** — toggleable from the Dev Panel

  </td>
  <td valign="top" width="50%">

### 🖥️ Dashboard
- **Real-time stats** — guilds, users, uptime, WebSocket ping
- **Activity feed** — live command log with user & server info
- **Command analytics** — bar chart + table of top commands
- **Server browser** — grid view + per-guild log configuration
- **Warnings manager** — view & delete infractions per user
- **System logs** — terminal-style log with search & filters
- **Discord OAuth** — account login with guild permissions
- **Themes** — multiple dashboard looks (cyberpunk, sakura, phantom…)
- **Dev panel** — owners only: maintenance, changelogs & bot control
- **Auto-refresh** every 15–30 seconds

  </td>
  </tr>
</table>

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>
</div>

<br/>

## 📋 Commands

> **33 commands total** — Utility · Moderation · Fun / Economy · Admin

### 🔧 Utility

| Command | Description |
|---|---|
| `/help` | List all available commands with descriptions |
| `/ping` | Check bot latency and WebSocket ping |
| `/avatar` | Display a user's full-size avatar |
| `/userinfo` | Show detailed user information |
| `/serverinfo` | Display server statistics and details |
| `/cfglogs` | Set / disable / check the server log channel |
| `/cfgembed` | Configure custom embeds |

### 🛡️ Moderation

| Command | Description | Permission |
|---|---|---|
| `/ban` | Ban a user with optional reason | Ban Members |
| `/unban` | Unban a user by ID | Ban Members |
| `/kick` | Kick a user from the server | Kick Members |
| `/timeout` | Apply a timed timeout | Moderate Members |
| `/untimeout` | Remove an active timeout | Moderate Members |
| `/mute` | Mute a member | Moderate Members |
| `/unmute` | Unmute a member | Moderate Members |
| `/warn` | Issue a warning to a user | Moderate Members |
| `/warns` | View warnings for a user | Moderate Members |
| `/clearwarns` | Clear warnings for a user | Moderate Members |
| `/purge` | Bulk delete messages in a channel | Manage Messages |
| `/lock` | Lock a channel | Manage Channels |
| `/unlock` | Unlock a channel | Manage Channels |
| `/slowmode` | Set channel slowmode | Manage Channels |
| `/logs` | View or manage moderation logs | Moderate Members |

### 🎲 Fun & Economy

| Command | Description |
|---|---|
| `/8ball` | Ask the magic 8-ball a question |
| `/coinflip` | Flip a coin |
| `/roll` | Roll dice with optional modifiers |
| `/blackjack` | Play blackjack with bets |
| `/slots` | Slot machine |
| `/wallet` | Check your balance |
| `/pay` | Send currency to another user |
| `/shop` | Browse the shop |
| `/inventory` | View your items |
| `/top` | Leaderboard |
| `/chat` | Talk with the AI companion |
| `/gig` | Random fixer gig generator |
| `/chrome` | Cyberware upgrade simulator |
| `/psycho` | Cyberpsychosis test |

### 👑 Admin

| Command | Description |
|---|---|
| `/dev` | Owner tools (economy admin, etc.) |

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>
</div>

<br/>

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Bot** | discord.js v14, TypeScript 5.9 |
| **API** | Express 5, Pino logger, Zod validation |
| **Database** | PostgreSQL + Drizzle ORM |
| **Dashboard** | React 19, Vite, Tailwind CSS, shadcn/ui, Recharts |
| **API Contract** | OpenAPI 3.0, Orval codegen, React Query |
| **Monorepo** | pnpm workspaces |
| **Build** | esbuild (bundled API + bot) |

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>
</div>

<br/>

## 📁 Project Structure

```
aarideev_ZeroTwo/
├── artifacts/
│   ├── api-server/              # Express API + Discord bot
│   │   └── src/
│   │       ├── bot/
│   │       │   ├── commands/
│   │       │   │   ├── utility/     # help, ping, avatar, userinfo,
│   │       │   │   │                # serverinfo, cfglogs, cfgembed
│   │       │   │   ├── moderation/  # ban, kick, timeout, warn, purge…
│   │       │   │   ├── fun/         # games, economy, chat, edgerunners
│   │       │   │   └── admin/       # dev tools
│   │       │   ├── events/          # ready, interactionCreate,
│   │       │   │                    # guildCreate, serverLogs
│   │       │   ├── games/           # blackjack engine
│   │       │   └── lib/             # modlog, presence, version, economy
│   │       ├── lib/                 # botLogger, session, logger
│   │       ├── middleware/          # auth
│   │       └── routes/              # bot, guilds, commands, warns,
│   │                                # logs, dev, auth
│   └── dashboard/               # React + Vite cyberpunk dashboard
│       └── src/
│           ├── pages/               # Home, Guilds, Commands, Warns,
│           │                        # Logs, Settings, Account, Dev
│           ├── components/          # Layout, Sidebar, dash UI
│           └── styles/              # themes, cyberpunk FX
├── lib/
│   ├── api-spec/                # OpenAPI 3.0 spec + Orval config
│   ├── api-zod/                 # Generated Zod schemas
│   ├── api-client-react/        # Generated React Query hooks
│   └── db/                      # Drizzle ORM schema + migrations
└── assets/
    └── screenshots/             # Dashboard preview images
```

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>
</div>

<br/>

## 🚀 Setup

### Prerequisites
- Node.js 24+
- pnpm 9+
- PostgreSQL database

### Installation

```bash
# Clone the repo
git clone https://github.com/aariidev/aarideev_ZeroTwo.git
cd aarideev_ZeroTwo

# Install dependencies
pnpm install
```

### Environment Variables

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
CLIENT_SECRET=your_oauth_client_secret
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=a_random_secret_string
DEV_TOKEN=a_secret_token_for_the_dev_panel
OWNER_IDS=your_discord_user_id
DASHBOARD_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:8080
DISCORD_REDIRECT_URI=http://localhost:8080/api/auth/callback
```

### Database Setup

```bash
pnpm --filter @workspace/db run push
```

### Running

```bash
# API server + bot
pnpm --filter @workspace/api-server run dev

# Dashboard (separate terminal)
pnpm --filter @workspace/dashboard run dev
```

### Adding the bot to your server

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your app → **OAuth2** → **URL Generator**
3. Scopes: `bot`, `applications.commands`
4. Permissions: Administrator (or select individually)
5. Open the URL and invite the bot

> Slash commands are registered globally and may take up to 1 hour to propagate.

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>
</div>

<br/>

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/bot/stats` | Bot stats (guilds, users, uptime, ping) |
| `GET` | `/api/bot/activity` | Recent command activity |
| `GET` | `/api/guilds` | List guilds the bot is in |
| `GET` | `/api/guilds/:id/settings` | Guild log settings |
| `PATCH` | `/api/guilds/:id/settings` | Update guild log settings |
| `GET` | `/api/commands/stats` | Command usage statistics |
| `GET` | `/api/warns` | List warnings (filterable) |
| `POST` | `/api/warns` | Create a warning |
| `DELETE` | `/api/warns/:id` | Delete a warning |
| `GET` | `/api/logs` | System / moderation event logs |
| `GET` | `/api/auth/me` | Current OAuth session user |

<br/>

<div align="center">

<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.png" width="100%"/>

<br/>

Made with 🩷 by [aariidev](https://github.com/aariidev)

**Zero Two · v2.3.0**

</div>
