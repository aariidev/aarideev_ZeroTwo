# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.2] - 2026-08-01

### Added
- `/poker` result embeds ahora incluyen un botón para enviar sugerencias al dev.
- Dev puede generar y aplicar mejoras al embed usando Gemini desde la DM enviada.
- El bot publica un embed de estadísticas de arranque/reinicio en el canal `1530019095565570158`.
- Dev Panel y dashboard ahora muestran el estado del bot, ping y reinicios con mayor seguridad.

### Fixed
- Corregido el warning de Discord.js sobre `ephemeral` en respuestas y `deferReply`.
- Arreglado el build de `/poker` tras la declaración duplicada de `customBet`.
- Mejorada la presentación del embed de arranque con author, thumbnail y campos más legibles.

### Changed
- Bumped bot display version to **v2.4.2**.
- `artifacts/api-server` package version actualizado.

### Notes
- La versión del núcleo ahora se mantiene en `bot/lib/version.ts` como fuente de verdad.

## [2.4.1] - 2026-07-27

### Added
- **Music · Spotify progressive load**
  - Scrape de `open.spotify.com/embed/…` (`__NEXT_DATA__` + `trackList`) sin Web API OAuth
  - La 1ª pista suena al instante; el resto se resuelve en paralelo (pool ×4)
  - Embeds Spotify dedicados (loading / boot / ready) con barra de progreso y color `#1DB954`
- **Sistema de logs de servidor ampliado** (20 eventos en 5 categorías)
  - Moderación: ban, unban, kick, timeout, untimeout
  - Mensajes: delete, edit, bulk delete
  - Miembros: join, leave, cambio de roles, nickname
  - Servidor: canal/rol create-delete, invites create-delete
  - Voz: join, leave, move
- **Configuración avanzada de logs por guild** (`GuildLogSettings`)
  - Ignorar bots / webhooks
  - Canales ignorados (no loguear delete/edit)
  - Alerta de cuenta nueva (N días)
  - Incluir adjuntos en mensajes borrados
  - Rol a mencionar en cada log
- **Dashboard → Servidores**: panel “Configurar logs” para dueños/admins
  - Eventos agrupados por categoría (todos / ninguno / por cat.)
  - Filtros y opciones avanzadas
  - Listado de canales y roles del servidor
- OAuth Discord con scope `guilds` para permisos reales de gestión
- API `GET/PATCH /api/guilds/:id/settings` con settings completos
- Intents `GuildVoiceStates` + `GuildInvites` para logs de voz e invites
- Rich Presence: `/help` + versión centralizada (`BOT_VERSION`)
- Separación de páginas **Cuenta** vs **Ajustes** en el dashboard
- Dev Panel restringido a `OWNER_IDS`
- Temas del dashboard (selector de apariencia)
- Manifiesto de release `255ari/v2.4.0.md`

### Changed
- Versión del núcleo unificada a **v2.4.0** (`bot/lib/version.ts` → health, stats, presence, footers)
- Migración unificada de config de logs a `log_settings:{guildId}` (compat. con keys antiguas)
- `/cfglogs status` muestra filtros, ping y eventos por categoría
- Embebidos de log unificados (`baseLogEmbed`, audit log helper)
- Now Playing / cola: fuente `Spotify → YT`, barra de progreso más nítida, link Spotify opcional
- yt-dlp search: timeout configurable (12 s en batch de playlist, 25 s normal)

### Fixed
- Spotify playlists: open.spotify.com sin pistas embebidas + Web API `/tracks` 403
- `/play` con playlist Spotify ya no se queda “pensando” minutos (búsqueda YT secuencial)
- Redirects OAuth / state cookie (maxAge en ms)
- Activity endpoint 404 y forma de respuesta del Dev Panel
- Dependencias nativas Windows (esbuild, lightningcss, tailwind oxide)
- Utilidades Tailwind vacías por exclusiones de platform

## [3.0.0] - 2026-06-12

### Added
- **Edgerunners Theme Overhaul**: Full cyberpunk Edgerunners aesthetic
  - Neon pink (#ff2e63) + cyan (#00e5ff) color palette
  - Glitch animations, scanlines, holographic borders
  - Night City slang in all bot responses and dashboard
- **3 New Edgerunners Fun Commands** (complete):
  - `/gig` — Random fixer gig generator with eddies and risk
  - `/chrome` — Random cyberware info & upgrade simulator
  - `/psycho` — Cyberpsychosis test with random outcomes
- New dashboard styles: `edgerunners-glitch.css` with neon-text, holo-border, glitch effects
- Updated presence rotation with Edgerunners flavor text
- Updated README + new CHANGELOG.md

### Changed
- Major version bump from 2.2.0 to 3.0.0
- All embeds and messages now use choom/preem/delta/gonk slang
- Dashboard HUD more immersive with glitch and neon

### Fixed
- Code reviewed and cleaned for v3 (no comments in new code, well ordered)

### Cyber-dev notes
- Reinforced input validation and rate limiting
- All new code follows secure Discord.js patterns

## [2.2.0] - 2026-06-12

### Added
- Blackjack game with betting
- Stability improvements

[2.4.2]: https://github.com/aariidev/aarideev_ZeroTwo/releases/tag/v2.4.2
[2.4.1]: https://github.com/aariidev/aarideev_ZeroTwo/releases/tag/v2.4.1
[2.4.0]: https://github.com/aariidev/aarideev_ZeroTwo/releases/tag/v2.4.0
[3.0.0]: https://github.com/aariidev/aarideev_ZeroTwo/releases/tag/v3.0.0
