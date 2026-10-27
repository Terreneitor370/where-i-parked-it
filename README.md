# Dónde lo dejé (where-i-parked-it)

App para guardar dónde dejaste el coche desde un reloj Wear OS y consultarlo sin conexión con una flecha de brújula y la distancia. La app móvil Android muestra el estacionamiento actual en un mapa, el historial y los vehículos.

Proyecto escolar de Kassie, Jeshua e Isabel. Entrega: martes 27 de octubre de 2026.

## Estructura

| Carpeta | Qué es | Tecnología |
| --- | --- | --- |
| `apps/api` | API REST y sincronización | Node.js 22, Fastify, mysql2, Zod, JWT |
| `apps/mobile` | App móvil Android (en línea) | Expo SDK 58, Expo Router, TanStack Query, react-native-maps |
| `apps/watch` | App de reloj Wear OS (offline-first) | Expo SDK 58 (development build), expo-sqlite, expo-location |
| `docs/` | Arquitectura y flujo de trabajo | |

Cada app es un proyecto npm independiente: se instala y se corre dentro de su carpeta.

## Requisitos

- Node.js 22 LTS y Git
- Android Studio con SDK, Platform-Tools y Emulator, más dos emuladores: Pixel 8 (API 34, con Google Play) y Wear OS Large Round (Wear OS 5, API 34)
- Docker Desktop para MySQL local, o la API compartida en Render

La guía completa de instalación está en [CONTRIBUTING.md](CONTRIBUTING.md#preparar-tu-equipo).

## Arranque rápido

```bash
# 1. Base de datos (desde la raíz del repo)
docker compose up -d

# 2. API
cd apps/api
cp .env.example .env
npm install
npm run dev                      # http://localhost:3000/health

# 3. Que los emuladores vean la API como localhost:3000
adb devices                      # ej. emulator-5554 (teléfono), emulator-5556 (reloj)
adb -s emulator-5554 reverse tcp:3000 tcp:3000
adb -s emulator-5556 reverse tcp:3000 tcp:3000

# 4. App móvil con Expo Go (otra terminal)
cd apps/mobile
cp .env.example .env
npm install
npm start                        # tecla a = abre Expo Go en el emulador del teléfono

# 5. App del reloj, development build (otra terminal)
cd apps/watch
cp .env.example .env
npm install
npm run android                  # compila e instala en el emulador del reloj (la primera vez tarda)
```

En Windows usa `copy .env.example .env` en lugar de `cp`.

## Primer uso (flujo de la demo)

1. En el móvil, regístrate y agrega un vehículo en la pestaña **Vehículos**.
2. Abre la app del reloj: muestra un código de 6 dígitos.
3. En el móvil, ve a **Ajustes › Emparejar reloj** y escribe el código. El reloj se sincroniza solo.
4. En el reloj, toca **Guardar aquí** y elige el nivel. Funciona aunque esté en modo avión.
5. Al recuperar la conexión, el estacionamiento aparece en **Mi coche** del móvil.
6. En el reloj, **Buscar mi coche** muestra la flecha y la distancia; **Ya lo recogí** lo cierra.

## API

| Método y ruta | Quién la usa | Qué hace |
| --- | --- | --- |
| `GET /health` | Todos | Comprueba la API y la base de datos |
| `POST /auth/register`, `POST /auth/login` | Móvil | Devuelve un JWT de 30 días |
| `GET /me` | Móvil, reloj | Usuario del token |
| `GET/POST /vehicles`, `PATCH/DELETE /vehicles/:id` | Móvil | Vehículos (borrado lógico) |
| `GET /parking`, `GET /parking/active` | Móvil | Historial y estacionamientos sin recoger |
| `POST /parking`, `PATCH /parking/:id/end`, `POST /parking/:id/notes` | Móvil | Guardar, recoger y agregar nota |
| `POST /pair/code`, `GET /pair/status/:code` | Reloj | Emparejamiento por código |
| `POST /pair/confirm` | Móvil | Confirma el código del reloj |
| `POST /sync/push`, `GET /sync/pull?since=` | Reloj | Sincronización offline-first |

Todas las rutas, salvo `health`, `auth` y `pair/code|status`, requieren `Authorization: Bearer <token>`.

## Pendiente para el lunes

| Área | Responsable | Pendiente |
| --- | --- | --- |
| Reloj | Jeshua | Probar en emulador Wear OS, ajustar UI a pantalla redonda, validar brújula |
| Móvil | Kassie | Iconos de pestañas, diseño final, editar vehículos, filtro del historial |
| API | Isabel | Desplegar en Render, revisar errores con datos reales |
| Entrega | Todos | Flujo completo en el teléfono de Isabel, APKs con EAS, video de respaldo |

## Documentación

- [docs/architecture.md](docs/architecture.md): arquitectura, base de datos, flujo de Git y plan
- [CONTRIBUTING.md](CONTRIBUTING.md): cómo trabajamos día a día
