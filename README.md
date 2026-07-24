<div align="center">

<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>

<br/>

# ✦ Zero Two ✦

**Bot de Discord modular con panel web cyberpunk en tiempo real**  
*TypeScript · discord.js v14 · dashboard React · MariaDB*

<br/>

[![Repo](https://img.shields.io/badge/github-aariidev%2Faarideev__ZeroTwo-ec4899?style=for-the-badge&logo=github&logoColor=white&labelColor=0d0d0d)](https://github.com/aariidev/aarideev_ZeroTwo)
[![Versión](https://img.shields.io/badge/versión-2.4.0-ec4899?style=for-the-badge&labelColor=0d0d0d)](https://github.com/aariidev/aarideev_ZeroTwo/releases)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white&labelColor=0d0d0d)](https://discord.js.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0d0d0d)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black&labelColor=0d0d0d)](https://react.dev)
[![MariaDB](https://img.shields.io/badge/MariaDB-MySQL-003545?style=for-the-badge&logo=mariadb&logoColor=white&labelColor=0d0d0d)](https://orm.drizzle.team)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?style=for-the-badge&logo=pnpm&logoColor=white&labelColor=0d0d0d)](https://pnpm.io)

```bash
git clone https://github.com/aariidev/aarideev_ZeroTwo.git
```

<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>

</div>

<br/>

## 🖥️ Vista previa del dashboard

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Resumen</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-home.jpg" alt="Resumen del dashboard" width="100%"/>
    </td>
    <td align="center" width="50%">
      <strong>Analítica de comandos</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-commands.jpg" alt="Estadísticas de comandos" width="100%"/>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>Servidores</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-guilds.jpg" alt="Navegador de servidores" width="100%"/>
    </td>
    <td align="center" width="50%">
      <strong>Advertencias</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-warns.jpg" alt="Gestor de advertencias" width="100%"/>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <strong>Logs del sistema</strong><br/><br/>
      <img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/screenshots/dashboard-logs.jpg" alt="Logs del sistema" width="100%"/>
    </td>
  </tr>
</table>

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>
</div>

<br/>

## ✨ Funciones

<table>
  <tr>
    <td valign="top" width="50%">

### 🤖 Bot
- **~52 slash commands** — utilidad, moderación, diversión, casino, música, tickets y admin
- **Rich presence dinámica** — now playing real, modo Darling, `/presence`
- **Música en voz** — YouTube + Spotify, cola, loop, shuffle, panel fijo y botones
- **Spotify → YouTube** — playlists con carga progresiva (embed scrape + pool paralelo)
- **Panel de música** — `/musicpanel` con volumen, cola y controles en un mensaje persistente
- **Sistema de tickets** — setup, panel, claim, close + transcript HTML y panel web
- **Warns unificados** — `/warn add|list|remove|clear` en base de datos
- **AutoMod pack** — reglas Discord (`/automod setup`) + progreso de insignia
- **Logs de servidor** — mensajes, miembros, canales, roles, voz, invites…
- **Instantáneas de mensajes** — ediciones y borrados recuperables
- **Beta testers** — `/beta` + pestaña Beta Lab en el dashboard
- **Chat por MD** — conversación con Zero Two (Gemini) en privados
- **Casino** — blackjack, slots, daily, tienda e inventario
- **Modo mantenimiento** — bypass para owners y beta testers
- **`/zerotwoinf`** — info en vivo del bot (sistema, red, DB)

  </td>
  <td valign="top" width="50%">

### 🖥️ Dashboard
- **Estadísticas en vivo** — servidores, usuarios, uptime, ping WebSocket
- **Feed de actividad** — log de comandos con usuario y servidor
- **Analítica de comandos** — gráfico + tabla de los más usados
- **Servidores por usuario** — solo los que administras (owner: todos)
- **Gestor de advertencias** — ver y borrar infracciones
- **Tickets en web** — config, panel y cierre desde el dashboard
- **Beta Lab** — estado, features, feedback y gestión de testers
- **Logs del sistema** — estilo terminal con búsqueda y filtros
- **OAuth de Discord** — login con scope `guilds`
- **Temas** — cyberpunk, sakura, phantom…
- **Panel Dev** — solo owners: mantenimiento, changelogs y control del bot
- **Auto-refresh** cada 5–30 segundos

  </td>
  </tr>
</table>

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>
</div>

<br/>

## 📋 Comandos

> **~52 slash commands** — Utilidad · Moderación · Diversión · Casino · Música · Admin  
> En Discord: escribe `/` y el nombre del comando.  
> En el bot: `/help` o `/help [comando]` para el panel interactivo.

### 🛠️ Utilidad (11)

| Comando | Uso | Descripción | Permiso |
|---|---|---|---|
| `/help` | `/help [comando]` | Panel de comandos por categoría o detalle de uno | — |
| `/ping` | `/ping` | Latencia del bot y WebSocket | — |
| `/avatar` | `/avatar [usuario]` | Avatar a tamaño completo | — |
| `/userinfo` | `/userinfo [usuario]` | Ficha con secciones: perfil · servidor · permisos | — |
| `/serverinfo` | `/serverinfo` | Reporte del servidor (6 secciones interactivas) | — |
| `/zerotwoinf` | `/zerotwoinf` | Info en vivo: sistema, red y base de datos | — |
| `/presence` | `/presence` | Preview de la rich presence (owners: forzar slice) | — |
| `/beta` | `/beta info\|status\|features\|feedback\|manage` | Programa de beta testers | manage = owner |
| `/cfgembed` | `/cfgembed [canal]` | Constructor interactivo de embeds | Gestionar mensajes |
| `/cfglogs` | `/cfglogs set\|disable\|status` | Canal de logs del servidor | Gestionar servidor |
| `/ticket` | ver subcomandos ↓ | Sistema de tickets de soporte | ver abajo |

#### Subcomandos de `/ticket`

| Subcomando | Descripción | Quién |
|---|---|---|
| `/ticket setup` | Categoría + rol staff [+ logs] [+ máx. abiertos] | Administrador |
| `/ticket panel` | Publica el panel (menú de categorías) en un canal | Gestionar servidor |
| `/ticket status` | Muestra la config actual de tickets | Cualquiera |
| `/ticket claim` | Reclama el ticket del canal actual | Staff |
| `/ticket close` | Cierra el ticket `[razon]` + transcript | Dueño / Staff |
| `/ticket add` | Añade un usuario al canal del ticket | Dueño / Staff |
| `/ticket remove` | Quita un usuario del ticket | Dueño / Staff |
| `/ticket config` | Políticas, roles, categorías y panel (avanzado) | Admin |

También disponible en el dashboard → **Tickets**.

### 🛡️ Moderación (15)

| Comando | Uso | Descripción | Permiso |
|---|---|---|---|
| `/ban` | `/ban <usuario> [motivo] [días]` | Banea (días = borrar mensajes 0–7) | Banear miembros |
| `/unban` | `/unban <userid> [motivo]` | Desbanea por ID de usuario | Banear miembros |
| `/kick` | `/kick <usuario> [motivo]` | Expulsa del servidor | Expulsar miembros |
| `/timeout` | `/timeout <usuario> <duracion> [motivo]` | Aislamiento temporal | Moderar miembros |
| `/untimeout` | `/untimeout <usuario>` | Quita el timeout | Moderar miembros |
| `/mute` | `/mute <usuario> <duracion> [motivo]` | Mute por rol / aislamiento | Moderar miembros |
| `/unmute` | `/unmute <usuario>` | Quita el mute | Moderar miembros |
| `/warn` | `/warn add\|list\|remove\|clear` | Advertencias unificadas (BD) | Moderar miembros |
| `/purge` | `/purge <cantidad> [usuario]` | Borra mensajes (máx. 14 días) | Gestionar mensajes |
| `/lock` | `/lock [motivo] [global]` | Bloquea el canal (o todos) | Gestionar canales |
| `/unlock` | `/unlock [global]` | Desbloquea canal(es) | Gestionar canales |
| `/slowmode` | `/slowmode <segundos> [global]` | Modo lento 0–21600 s | Gestionar canales |
| `/logs` | `/logs ver\|borrar` | Consulta / limpia logs de moderación | Moderación |
| `/automod` | `/automod setup\|status\|list\|remove\|…` | Pack AutoMod Zero Two | Gestionar servidor |
| `/giverole` | `/giverole <usuario> <rol>` | Da o quita un rol | Gestionar roles |

#### Subcomandos de `/automod`

| Subcomando | Descripción | Quién |
|---|---|---|
| `setup` | Instala el pack de reglas (máx. 6 por guild) | Gestionar servidor |
| `status` | Estado del pack en este servidor | Gestionar servidor |
| `list` | Lista reglas AutoMod del guild | Gestionar servidor |
| `remove` | Quita solo reglas `ZT \|` de Zero Two | Gestionar servidor |
| `global` | Progreso insignia Uses AutoMod (100 reglas) | Owner |
| `sync-all` | Instala el pack en todos los guilds del bot | Owner |

#### Subcomandos de `/warn`

| Subcomando | Descripción |
|---|---|
| `add` | Registrar advertencia |
| `list` | Listar expediente |
| `remove` | Eliminar por folio `#id` |
| `clear` | Borrar todo el historial del usuario |

### 🎮 Diversión (3)

| Comando | Uso | Descripción |
|---|---|---|
| `/8ball` | `/8ball <pregunta>` | Respuesta del núcleo analítico |
| `/poker` | `/poker [rival]` | Texas Hold'em (mano + mesa; opcional 1v1) |
| `/ship` | `/ship [usuario1] <usuario2>` | Compatibilidad 💘 y ship name |

### 🎰 Casino / Economía (8)

| Comando | Uso | Descripción |
|---|---|---|
| `/wallet` | `/wallet [usuario]` | Saldo de fichas |
| `/daily` | `/daily` | Recompensa diaria + rachas |
| `/pay` | `/pay <usuario> <cantidad>` | Transfiere fichas |
| `/shop` | `/shop` | Tienda de ítems del casino |
| `/inventory` | `/inventory` | Inventario y uso de ítems |
| `/top` | `/top [tipo]` | Ranking de economía |
| `/blackjack` | `/blackjack [apuesta]` | Blackjack con rejugada y apuesta custom |
| `/slots` | `/slots <apuesta>` | Tragaperras |

### 🎵 Música (14)

| Comando | Uso | Descripción |
|---|---|---|
| `/play` | `/play <query\|url>` | YouTube o Spotify (track / playlist / álbum) |
| `/skip` | `/skip` | Salta la canción actual |
| `/stop` | `/stop` | Detiene y limpia la cola |
| `/pause` | `/pause` | Pausa / reanuda |
| `/queue` | `/queue [pagina]` | Cola de reproducción |
| `/nowplaying` | `/nowplaying` | Canción actual + controles |
| `/volume` | `/volume <0-150>` | Volumen del bot |
| `/loop` | `/loop` | Ciclo: off → pista → cola |
| `/shuffle` | `/shuffle` | Mezcla la cola |
| `/remove` | `/remove <posicion>` | Quita una pista de la cola |
| `/clear` | `/clear` | Vacía la cola (sin parar la actual) |
| `/leave` | `/leave` | Desconecta del canal de voz |
| `/continue` | `/continue` | Reanuda sesión guardada tras un reinicio |
| `/musicpanel` | `/musicpanel set\|panel\|…` | Panel fijo del servidor | Gestionar servidor |

> **Notas de música:**  
> - Coloca `cookies.txt` (Netscape) en la raíz o define `YOUTUBE_COOKIES_PATH` para YouTube.  
> - Spotify: playlists vía scrape del embed público (hasta ~50 pistas) + mirrors YouTube en paralelo.  
> - Variables opcionales `SPOTIFY_*` para la Web API cuando esté disponible.  
> - El panel muestra volumen real al usar `−` / `+` (barra visual).

### 👑 Admin (1)

| Comando | Uso | Descripción | Permiso |
|---|---|---|---|
| `/dev` | `/dev give\|take\|set\|reset\|info\|additem` | Herramientas de economía del owner | Solo `OWNER_IDS` |

#### Subcomandos de `/dev`

| Subcomando | Descripción |
|---|---|
| `give` | Dar fichas a un usuario |
| `take` | Quitar fichas |
| `set` | Fijar saldo exacto |
| `reset` | Resetear economía del usuario |
| `info` | Stats de economía de un usuario |
| `additem` | Añadir ítem al inventario |

> Opcional en todos los sub de `/dev`: `guild_id` si no estás en el servidor objetivo.

### 🧪 Beta testers

| Vía | Descripción |
|---|---|
| `BETA_TESTER_IDS` en `.env` | Lista persistente de IDs |
| `/beta manage` | Owner: add / remove / list (también `data/beta-testers.json`) |
| Dashboard → **Beta Lab** | Estado, features, feedback e inbox (owner) |
| Privilegios | Bypass de mantenimiento + sin cooldowns |

### Resumen por categoría

| Categoría | Cantidad |
|---|---:|
| Utilidad | 11 |
| Moderación | 15 |
| Diversión | 3 |
| Casino | 8 |
| Música | 14 |
| Admin | 1 |
| **Total** | **52** |

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>
</div>

<br/>

## 🛠️ Stack técnico

| Capa | Tecnología |
|---|---|
| **Bot** | discord.js v14, TypeScript 5.9, @discordjs/voice |
| **Audio** | yt-dlp + ffmpeg (Ogg Opus), cookies YouTube, Spotify embed scrape |
| **API** | Express 5, Pino, Zod |
| **Base de datos** | MariaDB / MySQL + Drizzle ORM |
| **Dashboard** | React 19, Vite, Tailwind CSS, shadcn/ui, Recharts |
| **Contrato API** | OpenAPI 3.0, Orval, React Query |
| **Monorepo** | pnpm workspaces |
| **Build** | esbuild (API + bot empaquetados) |

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>
</div>

<br/>

## 📁 Estructura del proyecto

```
aarideev_ZeroTwo/
├── artifacts/
│   ├── api-server/              # API Express + bot de Discord
│   │   └── src/
│   │       ├── bot/
│   │       │   ├── commands/
│   │       │   │   ├── utility/     # help, userinfo, serverinfo, presence,
│   │       │   │   │                # beta, ticket, cfglogs, cfgembed…
│   │       │   │   ├── moderation/  # ban, kick, warn, automod, purge…
│   │       │   │   ├── fun/         # 8ball, poker, ship, casino, daily
│   │       │   │   ├── music/       # play, panel, queue, volume…
│   │       │   │   └── admin/       # /dev
│   │       │   ├── events/          # ready, interactions, serverLogs,
│   │       │   │                    # tickets, chat por MD
│   │       │   ├── games/           # motor de blackjack
│   │       │   ├── music/           # cola, stream yt-dlp, Spotify, panel
│   │       │   └── lib/             # presence, automod, betatesters,
│   │       │                        # modlog, warns, tickets, economy
│   │       ├── lib/                 # sesión, logger, guildAccess…
│   │       ├── middleware/
│   │       └── routes/              # bot, guilds, warns, logs, tickets,
│   │                                # beta, auth, dev
│   └── dashboard/               # Panel React + Vite
│       └── src/
│           ├── pages/               # Home, Guilds, Commands, Warns,
│           │                        # Tickets, Beta, Logs, Dev, Settings
│           ├── components/
│           └── styles/
├── lib/
│   ├── api-spec/                # OpenAPI + Orval
│   ├── api-zod/
│   ├── api-client-react/
│   └── db/                      # Drizzle + schemas MySQL + migraciones
├── scripts/                     # arranque visible, Spotify auth, smokes
├── data/                        # runtime local (beta-testers.json, gitignored)
└── assets/
    ├── help/                    # imágenes del panel /help
    ├── music/                   # banner del panel de música
    ├── screenshots/             # capturas del README
    └── separador.gif
```

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>
</div>

<br/>

## 🚀 Instalación

### Requisitos
- Node.js 24+
- pnpm 9+
- MariaDB / MySQL (p. ej. HeidiSQL + XAMPP, o un servidor remoto)
- **ffmpeg** en el `PATH` (música)
- **yt-dlp** (exe en `bin/` o instalado en el sistema) para streaming de YouTube

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/aariidev/aarideev_ZeroTwo.git
cd aarideev_ZeroTwo

# Dependencias
pnpm install
```

### Variables de entorno

Crea un archivo `.env` en la raíz (no se sube al repo):

```env
# Discord
DISCORD_TOKEN=tu_token_del_bot
CLIENT_ID=id_de_la_aplicacion
CLIENT_SECRET=secreto_oauth
OWNER_IDS=tu_discord_user_id
BETA_TESTER_IDS=id_betatester_1,id_betatester_2

# Base de datos MySQL/MariaDB (ej. local HeidiSQL)
DATABASE_URL=mysql://root@127.0.0.1:3306/zerotwo

# Sesión / dashboard
SESSION_SECRET=una_cadena_secreta_aleatoria
DEV_TOKEN=token_secreto_del_panel_dev
DASHBOARD_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:8080
DISCORD_REDIRECT_URI=http://localhost:8080/api/auth/callback

# Opcional — IA (chat por MD / panel dev)
GEMINI_API_KEY=

# Opcional — música
YOUTUBE_COOKIES_PATH=./cookies.txt
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REFRESH_TOKEN=
SPOTIFY_MARKET=ES
```

### Base de datos

```bash
# Crear la base (ej. zerotwo) en MariaDB/MySQL y luego:
pnpm --filter @workspace/db run push

# Scripts de soporte (tablas tickets, snapshots, etc.) si hace falta:
# node lib/db/ensure-tickets.mjs
# node lib/db/ensure-message-snapshots.mjs
# node lib/db/ensure-guild-settings.mjs
# node lib/db/ensure-music-panel.mjs
# node lib/db/ensure-music-sessions.mjs
```

### Arranque

```bash
# API + bot
pnpm --filter @workspace/api-server run dev

# Dashboard (otra terminal)
pnpm --filter @workspace/dashboard run dev
```

En Windows también puedes usar:

```powershell
.\scripts\start-bot-visible.ps1
.\scripts\start-dashboard-visible.ps1
```

### Spotify (música, opcional)

```bash
# Generar SPOTIFY_REFRESH_TOKEN (una vez, redirect http://127.0.0.1:8888/callback)
node scripts/spotify-auth.mjs
```

Las playlists también funcionan vía **embed público** de Spotify sin Premium cuando el scrape está disponible.

### Invitar el bot a un servidor

1. Abre el [Portal de desarrolladores de Discord](https://discord.com/developers/applications)
2. Tu app → **OAuth2** → **URL Generator**
3. Scopes: `bot`, `applications.commands`
4. Permisos: Administrador (o los mínimos + Conectar / Hablar para música + Gestionar servidor para AutoMod)
5. Abre la URL e invita el bot

> Los slash commands globales pueden tardar hasta ~1 hora en propagarse la primera vez. Reiniciar el bot re-registra el catálogo al arrancar.

<br/>

<div align="center">
<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>
</div>

<br/>

## 📡 Referencia de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Comprobación de salud |
| `GET` | `/api/bot/stats` | Stats del bot (servidores, usuarios, uptime, ping) |
| `GET` | `/api/bot/activity` | Actividad reciente de comandos |
| `GET` | `/api/guilds` | Servidores visibles para el usuario (owner: todos) |
| `GET` | `/api/guilds/:id/settings` | Ajustes de logs del servidor |
| `PATCH` | `/api/guilds/:id/settings` | Actualizar ajustes de logs |
| `GET` | `/api/commands/stats` | Estadísticas de uso de comandos |
| `GET` | `/api/warns` | Listar advertencias (filtrable) |
| `POST` | `/api/warns` | Crear advertencia |
| `DELETE` | `/api/warns/:id` | Borrar advertencia |
| `GET` | `/api/tickets` | Tickets (según acceso) |
| `GET` | `/api/tickets/stats` | Estadísticas de tickets |
| `GET` | `/api/tickets/guilds/:id/config` | Config de tickets del servidor |
| `PATCH` | `/api/tickets/guilds/:id/config` | Actualizar config de tickets |
| `GET` | `/api/logs` | Logs del sistema / moderación |
| `GET` | `/api/beta/status` | Estado beta del usuario de sesión |
| `GET` | `/api/beta/features` | Catálogo de features beta |
| `POST` | `/api/beta/feedback` | Enviar feedback (beta testers) |
| `POST` | `/api/beta/manage` | Gestionar testers (owner) |
| `GET` | `/api/auth/me` | Usuario de la sesión OAuth actual |

<br/>

<div align="center">

<img src="https://raw.githubusercontent.com/aariidev/aarideev_ZeroTwo/main/assets/separador.gif" width="100%"/>

<br/>

Hecho con 🩷 por [aariidev](https://github.com/aariidev)

**Zero Two · v2.4.0**  
[github.com/aariidev/aarideev_ZeroTwo](https://github.com/aariidev/aarideev_ZeroTwo)

</div>
