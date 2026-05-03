<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

<h1 align="center">ZeroTwo</h1>

<p align="center">
  A powerful, modular Discord bot with a real-time web dashboard — rebuilt from the ground up in TypeScript.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.1.0-ec4899?style=for-the-badge" alt="version"/>
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="discord.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="typescript"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="react"/>
  <img src="https://img.shields.io/badge/PostgreSQL-database-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="postgresql"/>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

## Dashboard Preview

<table>
  <tr>
    <td align="center"><strong>Overview</strong></td>
    <td align="center"><strong>Commands</strong></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/dashboard-home.jpg" alt="Dashboard Overview" width="480"/></td>
    <td><img src="assets/screenshots/dashboard-commands.jpg" alt="Commands Stats" width="480"/></td>
  </tr>
  <tr>
    <td align="center"><strong>Servers</strong></td>
    <td align="center"><strong>Warnings</strong></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/dashboard-guilds.jpg" alt="Servers" width="480"/></td>
    <td><img src="assets/screenshots/dashboard-warns.jpg" alt="Warnings" width="480"/></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><strong>System Logs</strong></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="assets/screenshots/dashboard-logs.jpg" alt="System Logs" width="960"/></td>
  </tr>
</table>

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

## Features

### Bot
- **22 slash commands** across three categories: utility, moderation and fun
- **Cooldown system** — per-user, per-command rate limiting
- **Permission enforcement** — each command checks member permissions before executing
- **DM notifications** — users receive a DM when banned, kicked or warned
- **Activity logging** — every command execution is recorded to PostgreSQL
- **Moderation logging** — ban, kick, warn, timeout and other actions logged to `bot_logs` table
- **Rotating presence** — cycles through status messages automatically

### Dashboard
- **Real-time stats** — guild count, user count, uptime, ping, commands executed
- **Recent activity feed** — live command log with user, server and timestamp
- **Command analytics** — bar chart + table of most-used commands
- **Server browser** — grid view of all servers the bot is in
- **Warnings manager** — view and delete infractions across all servers
- **System logs** — terminal-style moderation event log with filters and auto-refresh
- **Auto-refresh** every 30 seconds

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

## Commands

### Utility
| Command | Description |
|---|---|
| `/ping` | Check bot latency and WebSocket ping |
| `/avatar` | Show a user's full-size avatar |
| `/serverinfo` | Display server statistics and info |
| `/userinfo` | Display info about a user |
| `/help` | List all available commands |

### Moderation
| Command | Description | Permission required |
|---|---|---|
| `/ban` | Ban a user with optional reason and message deletion | Ban Members |
| `/kick` | Kick a user from the server | Kick Members |
| `/mute` | Timeout a user (10m / 1h / 7d) | Moderate Members |
| `/unmute` | Remove a timeout from a user | Moderate Members |
| `/timeout` | Apply a custom-duration timeout (60s – 7d) | Moderate Members |
| `/untimeout` | Remove an active timeout | Moderate Members |
| `/unban` | Unban a user by ID | Ban Members |
| `/warn` | Issue a warning to a user | Moderate Members |
| `/warns` | View all warnings for a user | Moderate Members |
| `/clearwarns` | Clear all warnings for a user | Moderate Members |
| `/purge` | Bulk delete messages in a channel | Manage Messages |
| `/slowmode` | Set channel slowmode (0 to disable) | Manage Channels |
| `/lock` | Lock a channel so no one can send messages | Manage Channels |
| `/unlock` | Unlock a previously locked channel | Manage Channels |

### Fun
| Command | Description |
|---|---|
| `/coinflip` | Flip a coin |
| `/roll` | Roll a dice (1-100 by default) |
| `/8ball` | Ask the magic 8-ball a question |

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

## Tech Stack

| Layer | Technology |
|---|---|
| Bot | discord.js v14, TypeScript |
| API | Express, Fastify logger (pino), Zod validation |
| Database | PostgreSQL + Drizzle ORM |
| Dashboard | React 19, Vite, Tailwind CSS, Recharts |
| API Contract | OpenAPI 3.0, Orval codegen, React Query |
| Monorepo | pnpm workspaces |

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

## Project Structure

```
ZeroTwo/
├── artifacts/
│   ├── api-server/          # Express API + Discord bot
│   │   └── src/
│   │       ├── bot/
│   │       │   ├── commands/
│   │       │   │   ├── utility/     # ping, avatar, serverinfo, userinfo, help
│   │       │   │   ├── moderation/  # ban, kick, mute, unmute, timeout, untimeout,
│   │       │   │   │                #   unban, warn, warns, clearwarns, purge,
│   │       │   │   │                #   slowmode, lock, unlock
│   │       │   │   └── fun/         # 8ball, coinflip, roll
│   │       │   └── events/          # ready, interactionCreate, guildCreate
│   │       ├── lib/                 # botLogger, devState, logger
│   │       └── routes/              # /bot, /guilds, /commands, /warns, /logs, /dev
│   └── dashboard/           # React + Vite dashboard
│       └── src/
│           ├── pages/               # Home, Guilds, Commands, Warns, Logs, Dev
│           └── components/          # Layout, Sidebar, formatters
├── lib/
│   ├── api-spec/            # OpenAPI 3.0 spec + orval config
│   ├── api-zod/             # Generated Zod schemas
│   ├── api-client-react/    # Generated React Query hooks
│   └── db/                  # Drizzle ORM schema + migrations
└── assets/
    └── screenshots/         # Dashboard preview images
```

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

## Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL database

### Installation

```bash
# Clone the repo
git clone https://github.com/aariidev/ZeroTwo.git
cd ZeroTwo

# Install dependencies
pnpm install
```

### Environment Variables

Create a `.env` file or set the following secrets:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=a_random_secret_string
DEV_TOKEN=a_secret_token_for_the_dev_panel
```

### Database Setup

```bash
# Push the schema to your database
pnpm --filter @workspace/db run push
```

### Running

```bash
# Start the API server + bot
pnpm --filter @workspace/api-server run dev

# Start the dashboard (separate terminal)
pnpm --filter @workspace/dashboard run dev
```

The API server runs on port `8080` and the dashboard on port `5173` by default.

### Adding the bot to your server

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application → OAuth2 → URL Generator
3. Scopes: `bot`, `applications.commands`
4. Bot Permissions: Administrator (or select individually)
5. Open the generated URL and add the bot to your server

Slash commands are registered globally and may take up to 1 hour to propagate.

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |
| GET | `/api/bot/stats` | Bot stats (guilds, users, uptime, ping) |
| GET | `/api/bot/activity` | Recent command activity |
| GET | `/api/guilds` | List all guilds the bot is in |
| GET | `/api/commands/stats` | Command usage statistics |
| GET | `/api/warns` | List warnings (filterable by guild/user) |
| POST | `/api/warns` | Create a warning |
| DELETE | `/api/warns/:id` | Delete a warning |
| GET | `/api/logs` | Moderation event logs (filterable) |

<p align="center">
  <img src="https://raw.githubusercontent.com/aariidev/ZeroTwo/main/assets/separador.png" alt="separator"/>
</p>

<p align="center">
  Made with love by <a href="https://github.com/aariidev">aariidev</a>
</p>
