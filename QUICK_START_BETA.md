# 🚀 Guía Rápida: Sistema de Beta Testers

## ⚡ Inicio Rápido (5 minutos)

### Paso 1: Configuración del `.env`

```env
# Agrega esta línea a tu archivo .env
BETATESTERS_IDS=123456789,987654321,555555555
```

Reemplaza los números con los Discord User IDs de tus beta testers.

---

### Paso 2: Archivos del Sistema

El sistema está compuesto por estos archivos listos para usar:

**Backend:**
- `lib/betatesters.ts` - Lógica central
- `middleware/betatesters.ts` - Protección de rutas
- `routes/beta.ts` - API endpoints
- `commands/utility/beta.ts` - Comando Discord

**Frontend:**
- `dashboard/src/lib/useBetaTester.ts` - Hooks React
- `dashboard/src/components/BetaTesterPanel.tsx` - UI completo

---

### Paso 3: Usar en tu Código

#### ✨ En Express routes:
```typescript
import { requireBetaTester } from "../middleware/betatesters";

// Protege una ruta
router.get("/experimental", requireBetaTester, (req, res) => {
  res.json({ message: "Contenido solo para beta testers" });
});
```

#### ✨ En componentes React:
```typescript
import { useBetaTesterStatus } from "../lib/useBetaTester";

export function MyComponent() {
  const { data: status } = useBetaTesterStatus();

  if (!status?.isBetaTester) {
    return <p>No eres beta tester</p>;
  }

  return <div>Contenido beta exclusivo 🧪</div>;
}
```

#### ✨ Integrar panel en dashboard:
```tsx
import BetaTesterPanel from "../components/BetaTesterPanel";

export default function Home() {
  return (
    <div>
      {/* ... otras secciones ... */}
      <BetaTesterPanel />
    </div>
  );
}
```

---

## 📡 Comandos Discord

```bash
/beta info              # Ver información del programa
/beta features         # Ver features en beta (solo beta testers)
/beta feedback         # Enviar feedback (solo beta testers)
/beta manage add       # Añadir beta tester (owner)
/beta manage list      # Listar beta testers (owner)
/beta manage remove    # Remover beta tester (owner)
```

---

## 📊 API Endpoints

### Públicos (requieren sesión):
```
GET /api/beta/status
```

**Respuesta:**
```json
{
  "userId": "123456789",
  "isBetaTester": true,
  "features": {
    "canAccessBetaPanel": true,
    "canAccessBetaFeatures": true,
    "betaFeaturesEnabled": ["dashboard", "commands", "api"]
  }
}
```

### Protegidos (requieren ser beta tester):
```
GET  /api/beta/features   → Lista de features
GET  /api/beta/panel      → Data del panel
POST /api/beta/feedback   → Enviar feedback
```

### Admin (requieren ser owner):
```
POST /api/beta/manage     → Gestionar lista
GET  /api/beta/info       → Estadísticas
```

---

## 🎯 Ejemplos de Uso

### 1. Verificar si es beta tester (backend):
```typescript
import { isBetaTester } from "../lib/betatesters";

if (isBetaTester(userId)) {
  console.log("Es beta tester!");
}
```

### 2. Obtener features disponibles:
```typescript
import { getBetaTesterFeatures } from "../lib/betatesters";

const features = getBetaTesterFeatures(userId);
console.log(features.betaFeaturesEnabled); // ["dashboard", "commands", "api"]
```

### 3. Renderizar condicionalemente:
```tsx
import { BetaFeatureGuard } from "../lib/useBetaTester";

<BetaFeatureGuard status={status}>
  <div>Contenido solo para beta testers</div>
</BetaFeatureGuard>
```

### 4. Enviar feedback desde React:
```typescript
import { submitBetaFeedback } from "../lib/useBetaTester";

await submitBetaFeedback(
  "Título del feedback",
  "Descripción detallada",
  "bug" // o "feature", "suggestion", "general"
);
```

---

## ✅ Verificación de Instalación

```bash
# 1. Ver archivos
ls artifacts/api-server/src/{lib,middleware,routes,bot/commands/utility}/beta*
ls artifacts/dashboard/src/{lib,components}/*Beta*

# 2. Verificar .env
grep BETATESTERS_IDS .env

# 3. Probar comando en Discord
/beta info

# 4. Probar API
curl http://localhost:8080/api/beta/status
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|---|---|
| "Beta testers no pueden acceder" | Verifica `BETATESTERS_IDS` en .env |
| "Comando no existe" | Reinicia bot, espera 1 hora |
| "Error 403 en API" | Confirma que eres beta tester (`/beta info`) |
| "Cache no se actualiza" | Llama `invalidateCache()` |

---

## 🚀 Próximos Pasos

1. ✅ **Configurar `.env`**
   ```env
   BETATESTERS_IDS=123456789,987654321
   ```

2. ✅ **Integrar panel**
   ```tsx
   import BetaTesterPanel from "../components/BetaTesterPanel";
   ```

3. ✅ **Proteger features**
   ```typescript
   router.get("/beta-feature", requireBetaTester, handler);
   ```

4. ✅ **Probar**
   ```
   /beta info
   curl /api/beta/status
   ```

---

## 📚 Documentación Completa

Para más información, ver:
- **[RESUMEN_EJECUTIVO.md](RESUMEN_EJECUTIVO.md)** - Overview completo
- **[BETA_TESTERS_SYSTEM.md](BETA_TESTERS_SYSTEM.md)** - Documentación técnica
- **[SYSTEM_OVERVIEW.txt](SYSTEM_OVERVIEW.txt)** - Diagrama visual

---

## 💡 Tips Pro

**Tip 1:** Usa middleware en routes críticas
```typescript
router.use("/api/experimental", requireBetaTester);
```

**Tip 2:** Combina guards en React
```tsx
<BetaFeatureGuard status={status}>
  <BetaFeatureLoader isLoading={isLoading}>
    <ExperimentalComponent />
  </BetaFeatureLoader>
</BetaFeatureGuard>
```

**Tip 3:** Gestiona beta testers con Discord
```
/beta manage list    # Ver todos
/beta manage add @user  # Agregar
/beta manage remove @user # Remover
```

---

## 🎉 ¡Listo!

El sistema está 100% funcional. Solo configura `.env` y comienza a usarlo.

**Hecho con 💜 para Zero Two**
