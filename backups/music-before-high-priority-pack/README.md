# Backup: música ANTES del pack de alta prioridad

**Fecha de reconstrucción:** 2026-07-17

## Qué incluye este snapshot

Estado del sistema de música **después de**:
- Embeds con banner GIF
- Todos los mensajes de música como embeds
- Panel fijo `/musicpanel` (set / panel / status / disable)
- Botones: Añadir, Pausa, Skip, Parar, Loop, Mezclar, Cola, Salir

## Qué NO incluye (pack de alta prioridad)

- Botón ⏮️ Anterior + historial
- Progreso en vivo cada 12s
- Botones de volumen −10 / +10 en el panel
- Comandos `/remove` y `/clear` (+ botón Vaciar cola)
- Rol DJ / permisos `permissions.ts`
- Subcomando `/musicpanel dj`

## Cómo restaurar sobre el repo

Desde la raíz `H:\Discord\02` en PowerShell:

```powershell
$b = "backups\music-before-high-priority-pack"
Copy-Item -Recurse -Force "$b\artifacts\api-server\src\bot\music\*" "artifacts\api-server\src\bot\music\"
# Quitar archivos del pack si existen en el working tree:
Remove-Item -Force "artifacts\api-server\src\bot\music\permissions.ts" -ErrorAction SilentlyContinue
Remove-Item -Force "artifacts\api-server\src\bot\commands\music\remove.ts" -ErrorAction SilentlyContinue
Remove-Item -Force "artifacts\api-server\src\bot\commands\music\clear.ts" -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force "$b\artifacts\api-server\src\bot\commands\music\*" "artifacts\api-server\src\bot\commands\music\"
Copy-Item -Force "$b\artifacts\api-server\src\bot\index.ts" "artifacts\api-server\src\bot\index.ts"
Copy-Item -Force "$b\artifacts\api-server\src\bot\commands\utility\help.ts" "artifacts\api-server\src\bot\commands\utility\help.ts"
Copy-Item -Force "$b\lib\db\src\schema\guildSettings.ts" "lib\db\src\schema\guildSettings.ts"
Copy-Item -Force "$b\lib\db\ensure-music-panel.mjs" "lib\db\ensure-music-panel.mjs"
# Rebuild + reinicio
cd artifacts\api-server; node ./build.mjs
```

## Nota

Este snapshot se **reconstruyó** a partir del código del panel (el pack no estaba en git).
El working tree actual del bot **sigue con el pack** + fix browseId; esta carpeta es solo la copia de seguridad pedida.
