# 🧪 Sistema de Beta Testers

Sistema completo para gestionar acceso a features experimentales y del dev para usuarios seleccionados (beta testers).

## Características

### 🎯 Para Beta Testers
- Acceso a features experimentales en el dashboard
- Comandos especiales `/beta`
- Acceso a endpoints API beta
- Panel dedicado para reportar bugs y feedback
- Acceso a analítica avanzada

### 👥 Para Owners/Desarrolladores
- Gestionar lista de beta testers (añadir/remover)
- Ver estadísticas de participación
- Monitorear feedback enviado
- Controlar qué features están en beta

## Configuración

### Variables de Entorno

Añade esta variable a tu `.env`:

```env
# Lista de IDs de Discord de los beta testers (separadas por comas)
BETATESTERS_IDS=123456789,987654321,555555555
```

### Ejemplo `.env`

```env
# Discord
DISCORD_TOKEN=tu_token_del_bot
CLIENT_ID=id_de_la_aplicacion
CLIENT_SECRET=secreto_oauth
OWNER_IDS=tu_discord_user_id

# Base de datos
DATABASE_URL=mysql://root@127.0.0.1:3306/zerotwo

# Dashboard
SESSION_SECRET=una_cadena_secreta_aleatoria
DEV_TOKEN=token_secreto_del_panel_dev
DASHBOARD_URL=http://localhost:5173
API_PUBLIC_URL=http://localhost:8080
DISCORD_REDIRECT_URI=http://localhost:8080/api/auth/callback

# Beta Testers
BETATESTERS_IDS=123456789,987654321

# Opcional
GEMINI_API_KEY=
YOUTUBE_COOKIES_PATH=./cookies.txt
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REFRESH_TOKEN=
SPOTIFY_MARKET=ES
```

## API Endpoints

### Públicos (requieren sesión)

#### `GET /api/beta/status`
Obtener estado de beta tester del usuario actual.

```json
{
  "userId": "123456789",
  "isBetaTester": true,
  "features": {
    "canAccessBetaPanel": true,
    "canAccessBetaFeatures": true,
    "canUseBetaCommands": true,
    "betaFeaturesEnabled": ["dashboard", "commands", "api"]
  }
}
```

### Protegidos (requieren ser beta tester)

#### `GET /api/beta/features`
Listar todas las features en beta disponibles.

#### `GET /api/beta/panel`
Acceder al panel de beta testers.

#### `POST /api/beta/feedback`
Enviar feedback o reportar un bug.

```json
{
  "title": "Bug en el dashboard",
  "description": "El gráfico de estadísticas se carga lentamente",
  "type": "bug" // o "feature", "suggestion", "general"
}
```

### Administradores (requieren ser owner)

#### `POST /api/beta/manage`

**Acciones:**
- `add`: Añadir usuario a beta testers
- `remove`: Remover usuario de beta testers
- `list`: Listar todos los beta testers

**Ejemplos:**

```json
{
  "action": "add",
  "targetUserId": "123456789"
}
```

```json
{
  "action": "list"
}
```

#### `GET /api/beta/info`
Obtener información y estadísticas del programa de beta testers.

## Comandos de Discord

### `/beta info`
Información general sobre el programa de beta testers.

### `/beta features`
Ver features experimentales disponibles (solo para beta testers).

### `/beta feedback`
Enviar feedback o reportar bugs (solo para beta testers).

### `/beta manage <action> [usuario]`
Gestionar beta testers (solo para owners).

**Acciones:**
- `add` - Añadir un usuario
- `remove` - Remover un usuario
- `list` - Listar todos

## Estructura del Sistema

```
lib/
├── betatesters.ts          # Lógica central de beta testers
middleware/
├── betatesters.ts          # Middleware Express para proteger rutas
routes/
├── beta.ts                 # Endpoints API para beta testers
bot/
├── commands/
│   └── utility/
│       └── beta.ts         # Comando Discord /beta
```

## Uso en el Código

### Verificar si un usuario es beta tester

```typescript
import { isBetaTester } from "../lib/betatesters";

if (isBetaTester(userId)) {
  // El usuario es beta tester
}
```

### Obtener features de un beta tester

```typescript
import { getBetaTesterFeatures } from "../lib/betatesters";

const features = getBetaTesterFeatures(userId);
if (features.canAccessBetaPanel) {
  // Mostrar panel beta
}
```

### Proteger una ruta con middleware

```typescript
import { requireBetaTester } from "../middleware/betatesters";

router.get("/experimental", requireBetaTester, (req, res) => {
  // Solo beta testers pueden acceder
  res.json({ data: "Feature experimental" });
});
```

### En componentes React

```typescript
import { useQuery } from "@tanstack/react-query";

export function BetaFeatures() {
  const { data: status } = useQuery({
    queryKey: ["beta", "status"],
    queryFn: () => fetch("/api/beta/status").then(r => r.json()),
  });

  if (!status?.isBetaTester) {
    return <p>No tienes acceso a features beta</p>;
  }

  return (
    <div>
      <h1>Panel de Beta Testers</h1>
      {/* Features beta aquí */}
    </div>
  );
}
```

## Gestión de Beta Testers

### Añadir un beta tester programáticamente

```typescript
import { addBetaTester } from "../lib/betatesters";

addBetaTester("123456789");
```

### Remover un beta tester

```typescript
import { removeBetaTester } from "../lib/betatesters";

removeBetaTester("123456789");
```

### Obtener todos los beta testers

```typescript
import { getAllBetatesters } from "../lib/betatesters";

const testers = getAllBetatesters();
console.log(testers); // ["123456789", "987654321", ...]
```

### Invalidar cache (después de cambios en .env)

```typescript
import { invalidateCache } from "../lib/betatesters";

invalidateCache();
```

## Features Beta Ejemplo

El sistema viene preconfigurado con estas features beta:

1. **Dashboard** - Nueva interfaz y componentes del panel de control
2. **Comandos** - Nuevos comandos experimentales del bot
3. **API** - Endpoints nuevos de la API
4. **Analítica** - Estadísticas detalladas y gráficos mejorados

Puedes expandir la lista editando `getBetaTesterFeatures()` en `lib/betatesters.ts`.

## Flujo de Trabajo

```
Usuario solicita acceso a feature beta
        ↓
Verificar si es beta tester (isBetaTester)
        ↓
Sí → Permitir acceso + mostrar feature
No → Mostrar mensaje de acceso denegado
        ↓
Si envía feedback → Registrar en BD
```

## Seguridad

- ✅ Los IDs se validan contra `BETATESTERS_IDS`
- ✅ Las rutas están protegidas con middleware
- ✅ Solo owners pueden gestionar la lista
- ✅ Cache de 1 minuto para mejor performance
- ✅ Logging de accesos denegados

## Troubleshooting

### Los beta testers no pueden acceder a features

1. Verifica que `BETATESTERS_IDS` está configurado correctamente
2. Confirma que los IDs están separados por comas sin espacios
3. Comprueba que el usuario tiene una sesión válida
4. Ejecuta `invalidateCache()` si recién añadiste IDs

### Cache no se actualiza

Llama a `invalidateCache()` después de cambios en `.env`:

```typescript
import { invalidateCache } from "../lib/betatesters";
invalidateCache();
```

O espera 60 segundos (TTL por defecto).

## Extensiones Futuras

- [ ] Database storage para beta testers (en lugar de env)
- [ ] Dashboard UI para gestionar beta testers
- [ ] Estadísticas de uso de features beta
- [ ] Sistema de niveles de acceso
- [ ] Notificaciones para beta testers
- [ ] Histórico de feedback
- [ ] Beta testing campaigns

---

**Creado con 💜 para Zero Two**
