# Security Policy 🔒

## Reporting a Vulnerability

**¡IMPORTANTE! No reportes vulnerabilities en Issues públicos.**

Si descubriste una vulnerabilidad de seguridad, por favor:

### Contacto Directo

1. **Email:** aariidev@protonmail.com
2. **Asunto:** `[SECURITY] Zero Two Bot - Vulnerability Report`
3. **Incluye:**
   - Descripción detallada de la vulnerabilidad
   - Pasos para reproducir (sin publicar exploit público)
   - Impacto potencial
   - Versión(es) afectada(s)
   - (Opcional) Sugerencia de fix

### Timeline Esperado

- ✅ **24 horas:** Confirmación de recepción
- ✅ **48-72 horas:** Evaluación inicial
- ✅ **1-2 semanas:** Fix y release de parche
- ✅ **Publicación:** Aviso de CVE y reconocimiento (si lo deseas)

---

## Scope de Vulnerabilities

### 🔴 Dentro del Scope (Crítico)

- **Input Validation:** Inyección de SQL, command injection, XSS
- **Authentication/Authorization:** Bypass de permisos, escalación de privilegios
- **Criptografía:** Uso débil de tokens, secrets expuestos
- **Rate Limiting:** Bypass de protecciones contra fuerza bruta
- **Data Exposure:** Leaks de tokens, datos de usuarios, DBs
- **CORS/CSRF:** Configuración insegura
- **Secrets Management:** API keys, tokens en código o logs
- **Dependency Vulnerabilities:** Paquetes npm con vulnerabilidades conocidas

### 🟡 Dentro del Scope (Moderado)

- **Information Disclosure:** Leaks de info de error, stack traces
- **Denial of Service:** Recursos sin límite (memoria, CPU)
- **Configuration Issues:** Defaults inseguros
- **Logic Bugs:** Rutas o permisos no autorizados
- **Logging:** Información sensible en logs

### 🟢 FUERA del Scope

- **Client-side XSS:** En páginas que el usuario controla
- **Social Engineering:** Phishing, pretexting
- **Physical Security:** Acceso físico a servidores
- **Supply Chain:** Vulnerabilities en dependencias transitorias (reportar a npm)
- **Publicly Disclosed:** Bugs ya conocidos/publicados
- **Ambiente de Testing:** Solo si es reproducible en producción

### ❌ Definitivamente FUERA

- **Spam/Abuse:** Reportes no serios
- **Política/Términos:** Violaciones de ToS (reportar a Discord)
- **Performance:** Optimización (no es security)
- **Requests de Features:** "Debería tener 2FA" (abre un issue normal)

---

## Vulnerabilities Conocidas

### Estado Actual

| Componente | Versión | Estado | Severidad |
|-----------|---------|--------|----------|
| discord.js | 14.26.4 | ✅ Seguro | - |
| express | 5.0.0-rc | ⚠️ RC (monitorear) | Baja |
| drizzle-orm | 0.45.2 | ✅ Seguro | - |
| pino | 9.x | ✅ Seguro | - |
| mysql2 | 3.23.0 | ✅ Seguro | - |

*Última actualización: 24 Jul 2026*

Si descubres una vulnerabilidad en estas versiones, reporta primero al proyecto upstream, luego a nosotros.

---

## Buenas Prácticas de Seguridad

### Para Usuarios/Self-Hosters

- ✅ Mantén `.env` privado (gitignore)
- ✅ Usa tokens de bot separados por ambiente (dev/prod)
- ✅ Cambiar `OWNER_IDS` a tus IDs de Discord
- ✅ Cambiar `SESSION_SECRET` a un string aleatorio fuerte
- ✅ Usar HTTPS en producción (si expones públicamente)
- ✅ Mantener Node.js y dependencias actualizadas
- ✅ Monitorear logs de moderación regularmente
- ✅ Usar MariaDB/MySQL con usuario limitado (no root)
- ✅ Backups regulares de la BD
- ❌ No compartir `.env` ni tokens
- ❌ No usar contraseñas débiles
- ❌ No ignorar actualizaciones de seguridad

### Para Contribuidores

- ✅ **Never commit secrets:** .env, tokens, keys
- ✅ **Validate ALL inputs:** User data, API params, Discord snowflakes
- ✅ **Use Zod:** Para schemas y validación
- ✅ **Rate limit:** API endpoints contra brute force
- ✅ **Check permissions:** Verificar roles/permisos antes de acciones
- ✅ **Use parameterized queries:** Drizzle (no raw SQL)
- ✅ **Log security events:** Warns, bans, config changes
- ✅ **Handle errors safely:** No exponer stack traces al usuario
- ✅ **Test edge cases:** Inputs válidos vs. maliciosos

### Para Mantainers

- ✅ **Review PRs:** Enfoque en security
- ✅ **Dependency scanning:** npm audit, dependabot
- ✅ **Semantic versioning:** Patches para security fixes
- ✅ **Communicate:** Avisos sobre vulnerabilidades arregladas
- ✅ **Rotate secrets:** Periódicamente cambiar keys
- ✅ **Audit logs:** Mantener logs de cambios críticos

---

## Ejemplo: Reporte de Vulnerability

```
Asunto: [SECURITY] Zero Two - Potential SQL Injection in /api/warns

Descripción:
El endpoint GET /api/warns no valida el parámetro `userId` correctamente.
Un usuario puede inyectar SQL para leer advertencias de otros usuarios.

Pasos para reproducir:
1. GET /api/warns?userId=1 OR 1=1
2. Observar que retorna advertencias de múltiples usuarios

Impacto:
- Lectura no autorizada de datos de usuarios
- Severidad: CRÍTICA (CVSS 9.1)

Versión afectada:
- v2.4.0

Sugerencia de fix:
Usar Zod para validar que `userId` sea un string de números válido:
const schema = z.object({ userId: z.string().regex(/^\d+$/) });
```

---

## Frecuencia de Actualizaciones

| Tipo | Frecuencia |
|------|----------|
| Patches de Security | Inmediato + aviso |
| Dependencias críticas | Semanal/Bi-semanal |
| Review de código | Con cada PR |
| Audit de npm | Mensual |
| Penetration testing | Anual (cuando sea posible) |

---

## Changelog de Seguridad

### v2.4.0 (24 Jul 2026)
- ✅ Validación mejorada de OAuth state (cookie maxAge en ms)
- ✅ Rate limiting en endpoints sensibles

### v3.0.0 (En desarrollo)
- 🔄 Auditoría de permisos Discord
- 🔄 Migración de secrets a manager externo (opcional)

---

## FAQ

**P: ¿Qué sucede si reporto una vulnerabilidad?**  
R: Recibirás confirmación, será investigada, se hará un fix, y serás reconocido (si lo deseas).

**P: ¿Puedo divulgar la vulnerabilidad después del fix?**  
R: Sí, después de que sea patcheada y publicada. Coordinamos timing.

**P: ¿Hay un bug bounty program?**  
R: Actualmente no, pero reconocemos a reporteros en el changelog.

**P: ¿Cómo reporto una vulnerabilidad en una dependencia?**  
R: Reporta directamente al proyecto de la dependencia en npm. Si es crítica, avísanos también.

**P: ¿Qué pasa si ignoro esto y publico el exploit?**  
R: Nos vemos obligados a avisar públicamente sin darte crédito.

---

## Recursos

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Discord.js Security](https://discordjs.guide/popular-topics/security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Gracias por ayudar a mantener Zero Two seguro.** 🛡️