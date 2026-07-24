# Contributing to Zero Two 🤖

¡Gracias por tu interés en contribuir a Zero Two! Este documento te guiará a través del proceso.

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [Setup del Desarrollo](#setup-del-desarrollo)
- [Guía de Estilo](#guía-de-estilo)
- [Proceso de Pull Request](#proceso-de-pull-request)
- [Reportar Bugs](#reportar-bugs)
- [Sugerir Features](#sugerir-features)

---

## Código de Conducta

- ✅ Sé respetuoso y constructivo
- ✅ Incluye contexto en issues y PRs
- ✅ Respeta la privacidad de otros
- ❌ No spam, hate speech, o contenido ofensivo

---

## Setup del Desarrollo

### Requisitos Previos
- **Node.js 24+**
- **pnpm 9+**
- **MariaDB / MySQL** (local o remoto)
- **ffmpeg** en el PATH
- **yt-dlp** en `bin/` o instalado en el sistema

### Clonar y Configurar

```bash
# 1. Fork el repositorio en GitHub
# 2. Cloná tu fork
git clone https://github.com/YOUR_USERNAME/aarideev_ZeroTwo.git
cd aarideev_ZeroTwo

# 3. Añade remote upstream
git remote add upstream https://github.com/aariidev/aarideev_ZeroTwo.git

# 4. Instala dependencias
pnpm install

# 5. Configura variables de entorno
cp .env.example .env  # (ver instrucciones en README.md)
# Edita .env con tus tokens de Discord, DB, etc.

# 6. Setup de base de datos
pnpm --filter @workspace/db run push

# 7. Inicia el desarrollo
pnpm --filter @workspace/api-server run dev
# En otra terminal:
pnpm --filter @workspace/dashboard run dev
```

### Carpetas Clave

```
aarideev_ZeroTwo/
├── artifacts/api-server/src/
│   ├── bot/commands/         # Slash commands
│   ├── bot/events/           # Event listeners
│   ├── bot/music/            # Sistema de música
│   └── routes/               # API endpoints
├── artifacts/dashboard/src/
│   ├── pages/                # React pages
│   └── components/           # React components
└── lib/
    ├── db/                   # Drizzle schemas
    └── api-spec/             # OpenAPI contracts
```

---

## Guía de Estilo

### TypeScript / JavaScript

- ✅ Usar **strict mode** en TypeScript
- ✅ Tipos explícitos en funciones públicas
- ✅ Validar input con **Zod**
- ✅ Comentarios solo en lógica compleja
- ✅ Nombres de variables descriptivos

```typescript
// ✅ BIEN
async function getUserWarnings(userId: string, guildId: string): Promise<Warning[]> {
  const warnings = await db.query.warnings.findMany({
    where: (t) => and(eq(t.userId, userId), eq(t.guildId, guildId)),
  });
  return warnings;
}

// ❌ MAL
async function getWarns(uid, gid) {
  return db.query.warnings.findMany({
    where: (t) => and(eq(t.userId, uid), eq(t.guildId, gid)),
  });
}
```

### Commit Messages

Usa [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` Nueva feature
- `fix:` Bug fix
- `docs:` Cambios de documentación
- `style:` Formateo, sin cambios lógicos
- `refactor:` Reestructuración sin cambios funcionales
- `perf:` Mejoras de performance
- `test:` Añadir o actualizar tests
- `chore:` Cambios en config/deps

**Ejemplos:**
```bash
git commit -m "feat(music): add Spotify playlist progressive loading"
git commit -m "fix(warns): prevent duplicate warnings in DB"
git commit -m "docs: update installation guide"
git commit -m "refactor(api): extract auth middleware to lib"
git commit -m "test(casino): add blackjack edge cases"
```

### Formateo de Código

Prettier está configurado automáticamente:

```bash
# Formatear archivos
pnpm run format

# Verificar formateo (en CI)
pnpm run format:check
```

ESLint también puede estar configurado:

```bash
pnpm run lint
pnpm run lint:fix
```

---

## Proceso de Pull Request

### 1. Crear una Branch

```bash
# Sincroniza con upstream
git fetch upstream
git checkout upstream/main

# Crea una feature branch
git checkout -b feat/tu-feature-name
```

**Naming convention:**
- `feat/feature-name` — Nueva feature
- `fix/bug-name` — Bug fix
- `docs/update-name` — Documentación
- `refactor/component-name` — Refactor

### 2. Haz tus Cambios

```bash
# Edita archivos
# Testea localmente
pnpm --filter @workspace/api-server run test

# Typecheck
pnpm run typecheck

# Formatea
pnpm run format
```

### 3. Commit y Push

```bash
git add .
git commit -m "feat(music): add Spotify progressive load"
git push origin feat/feature-name
```

### 4. Abre un Pull Request

En GitHub, llena el template PR con:

```markdown
## 📝 Description
Qué cambio estás haciendo y por qué.

## 🎯 Tipo de Cambio
- [ ] 🐛 Bug fix (non-breaking)
- [ ] ✨ Feature (non-breaking)
- [ ] 🔨 Breaking change
- [ ] 📚 Documentation

## 🧪 Testing
Cómo testeaste esto:
- [ ] Testeado localmente
- [ ] Unit tests passed
- [ ] Typecheck passed

## ✅ Checklist
- [ ] Mi código sigue la guía de estilo
- [ ] He actualizado la documentación
- [ ] He añadido tests relevantes
- [ ] Todos los tests pasan (`pnpm test`)
- [ ] No hay cambios de dependencias no intencionados
```

### 5. Revisión y Merge

- ✅ Mínimo 1 review aprobado
- ✅ Todos los tests pasan
- ✅ Sin conflictos de merge
- ✅ Branch actualizada con main

El maintainer mergeará con **squash** si es una feature pequeña, o **merge commit** si es compleja.

---

## Reportar Bugs

### Crear un Issue

1. Ve a [Issues](https://github.com/aariidev/aarideev_ZeroTwo/issues)
2. Clic en **New Issue** → **Bug Report**
3. Llena:

```markdown
## 🐛 Descripción del Bug
Descripción clara y concisa.

## 🔄 Pasos para Reproducir
1. Hago esto...
2. Luego hago esto...
3. Y ocurre el problema...

## 📌 Comportamiento Esperado
Qué debería pasar.

## 🖥️ Entorno
- OS: Windows 10 / Ubuntu 22.04 / macOS
- Node: v24.x
- Rama: main / feature-branch

## 📋 Logs
```
Pega error logs o output relevante aquí
```

## 📎 Screenshots
Si es visual, adjunta capturas.
```

### Qué Incluir

✅ Pasos claros para reproducir  
✅ Versión del bot / rama  
✅ Error logs completos  
✅ Entorno (OS, Node version, etc.)  
✅ Si es posible, un minimal reproduction  

❌ "No funciona" sin contexto  
❌ Screenshots borrosas  
❌ Logs incompletos  

---

## Sugerir Features

### Crear un Issue

1. Ve a [Issues](https://github.com/aariidev/aarideev_ZeroTwo/issues)
2. Clic en **New Issue** → **Feature Request**
3. Llena:

```markdown
## ✨ Descripción de la Feature
Qué quieres que el bot haga.

## 🎯 Caso de Uso
Por qué lo necesitas.

## 🔄 Solución Propuesta
Cómo debería verse / funcionar.

## 💡 Alternativas
Otras formas de resolver esto.

## 📎 Context Adicional
Archivos, links, referencias.
```

### Qué Incluir

✅ Descripción clara  
✅ Caso de uso / problem statement  
✅ Ejemplos de cómo se vería  
✅ Alternativas consideradas  

❌ "Añade X cosa" sin contexto  
❌ Duplicados (busca primero)  
❌ Feature requests genéricas  

---

## 📦 Estructura de Cambios Comunes

### Añadir un Comando

```typescript
// artifacts/api-server/src/bot/commands/utility/mycommand.ts
import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types';

export const myCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('Does something cool')
    .addStringOption((option) =>
      option.setName('query').setDescription('Search query').setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('query');
    
    // Tu lógica aquí
    const result = await doSomething(query);
    
    await interaction.reply({
      content: `Result: ${result}`,
      ephemeral: true,
    });
  },
};
```

### Añadir una Ruta API

```typescript
// artifacts/api-server/src/routes/myroute.ts
import { Router } from 'express';
import { verifyAuth } from '../middleware/auth';

const router = Router();

router.get('/api/myresource', verifyAuth, async (req, res) => {
  try {
    const data = await getMyResource(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

### Actualizar el Dashboard

```tsx
// artifacts/dashboard/src/pages/MyPage.tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export function MyPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['myresource'],
    queryFn: () => apiClient.getMyResource(),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>My Resource</h1>
      {/* Render data */}
    </div>
  );
}
```

---

## 🧪 Testing

Aunque actualmente hay pocos tests, si añades features críticas, por favor incluye tests:

```bash
# Ejecutar tests
pnpm --filter @workspace/api-server run test

# Watch mode
pnpm --filter @workspace/api-server run test:watch

# Coverage
pnpm --filter @workspace/api-server run test:coverage
```

Ejemplo de test:

```typescript
// artifacts/api-server/src/bot/commands/utility/__tests__/ping.test.ts
import { describe, it, expect, vi } from 'vitest';
import { pingCommand } from '../ping';

describe('Ping Command', () => {
  it('should respond with pong', async () => {
    const interaction = {
      reply: vi.fn(),
      options: { getInteger: vi.fn(() => null) },
    };

    await pingCommand.execute(interaction as any);
    expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Pong'));
  });
});
```

---

## 🚀 Antes de Hacer Push

```bash
# 1. Typecheck
pnpm run typecheck

# 2. Formateo
pnpm run format

# 3. Tests (si aplica)
pnpm --filter @workspace/api-server run test

# 4. Build local
pnpm --filter @workspace/api-server run build

# 5. Verificar que no haya cambios no intencionales
git status
```

---

## 📞 Preguntas?

- 💬 Abre un [Discussion](https://github.com/aariidev/aarideev_ZeroTwo/discussions)
- 🐛 Reporta bugs en [Issues](https://github.com/aariidev/aarideev_ZeroTwo/issues)
- 💌 Contacta al maintainer si algo no está claro

---

## ✨ Reconocimiento

¡Gracias por contribuir a Zero Two! Los contribuidores serán reconocidos en:
- README.md (Contributors section)
- Changelog en cada release
- Agradecimiento en Discord

**Happy coding! 🚀**