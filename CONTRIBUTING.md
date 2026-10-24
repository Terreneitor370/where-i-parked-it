# Cómo trabajamos

Reglas cortas para entregar el lunes 26 a las 15:00. La versión larga, con la arquitectura, está en [docs/architecture.md](docs/architecture.md).

## Reglas

- `main` siempre funciona. Nadie hace push directo a `main`: todo entra por Pull Request y solo Isabel hace merge.
- Una rama = un issue = un PR pequeño. Sube tu rama al menos una vez al día, aunque el PR esté en *Draft*.
- Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(watch): guardar ubicación con un toque`, `fix(api): validar latitud`. Alcances: `api`, `mobile`, `watch`, `docs`, `ci`.
- Sin trailers de coautoría (`Co-Authored-By`) de herramientas de IA en commits ni PRs.
- Squash merge: el título del PR queda como mensaje del commit en `main`, así que también sigue Conventional Commits.

| Tipo | Rama | Ejemplo |
| --- | --- | --- |
| Funcionalidad | `feat/<issue>-<descripcion>` | `feat/12-brujula-reloj` |
| Corrección | `fix/<issue>-<descripcion>` | `fix/18-mapa-en-blanco` |
| Documentación | `docs/<descripcion>` | `docs/readme` |
| Mantenimiento | `chore/<descripcion>` | `chore/actualizar-expo` |

## Preparar tu equipo

**Todos:**

1. Instala Git, Node.js 22 LTS, GitHub CLI (`gh`) y Docker Desktop. Con 8 GB de RAM, omite Docker y usa la API compartida en Railway.
2. Instala Android Studio con *Android SDK*, *Android SDK Platform-Tools* y *Android Emulator*.
3. Configura `adb` en la terminal:
   - Windows: `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk` y agrega `%ANDROID_HOME%\platform-tools` al `PATH`. Activa *Plataforma del hipervisor de Windows*.
   - macOS: en `~/.zshrc` agrega `export ANDROID_HOME=$HOME/Library/Android/sdk` y `export PATH=$PATH:$ANDROID_HOME/platform-tools`. En Mac con chip M, usa imágenes **ARM64**.
4. En *Device Manager* crea dos emuladores: **Pixel 8** con Android 14 (API 34, con Google Play) y **Wear OS Large Round** con Wear OS 5 (API 34).
5. Clona el repo y sigue el [Arranque rápido](README.md#arranque-rápido).
6. Verifica: con un emulador encendido, `adb devices` muestra `emulator-5554  device`.

**Kassie y Jeshua (opcional):** Expo Go en el iPhone sirve para revisar diseño, pero ahí la app corre como iOS. Ninguna funcionalidad se da por terminada sin probarla en el emulador Android.

**Isabel (teléfono físico):**

1. *Opciones de desarrollador* › activa **Depuración por USB** e **Instalar vía USB**.
2. Instala Expo Go desde Play Store.
3. En Windows, si `adb devices` no ve el teléfono, instala el driver USB de la marca o el *Google USB Driver*.
4. Por USB:

```bash
adb devices                                   # ej. R58N123ABC
adb -s R58N123ABC reverse tcp:3000 tcp:3000   # API
adb -s R58N123ABC reverse tcp:8081 tcp:8081   # Metro
cd apps/mobile && npm start                   # tecla a
```

## Rutina diaria

```bash
# 1. Actualiza main y crea tu rama
git switch main
git pull --ff-only
git switch -c feat/12-brujula-reloj

# 2. Si cambió algún package-lock.json, reinstala en esa app
cd apps/watch && npm install

# 3. Levanta solo lo que tu issue necesita
docker compose up -d
cd apps/api && npm run dev

# 4. Commits pequeños
git add -p
git commit -m "feat(watch): flecha de brújula hacia el coche"

# 5. Ponte al día con main antes de subir
git fetch origin
git rebase origin/main

# 6. Sube y abre el PR
git push -u origin feat/12-brujula-reloj
gh pr create --base main --fill --draft

# 7. Si piden cambios: commit y push a la misma rama
git push
git push --force-with-lease     # solo si hiciste rebase después de subir

# 8. Después del merge
git switch main
git pull --ff-only
git branch -d feat/12-brujula-reloj
```

Si hay conflictos en el rebase: corrige los archivos marcados, `git add <archivo>`, `git rebase --continue`. Para cancelar: `git rebase --abort`.

## Antes de pedir revisión

- [ ] `npm run typecheck` pasa en cada app que tocaste
- [ ] Lo probaste en el emulador Android y pegaste una captura en el PR
- [ ] Si tocaste sincronización: prueba de modo avión (abajo)
- [ ] Si tocaste ubicación, permisos o mapa: etiqueta `probar-en-dispositivo`
- [ ] El PR dice qué issue cierra (`Closes #12`) y cómo probarlo
- [ ] Pasaste el PR de *Draft* a *Ready for review*

**Prueba de modo avión:**

```bash
adb -s emulator-5556 shell cmd connectivity airplane-mode enable
# en el reloj: Guardar aquí
adb -s emulator-5556 shell cmd connectivity airplane-mode disable
# en el móvil: Mi coche debe mostrar el estacionamiento en menos de 1 minuto
```

## Revisión y merge (Isabel)

```bash
gh pr list
gh pr checkout 15                 # si tiene probar-en-dispositivo: córrelo en tu teléfono
gh pr review 15 --approve         # o --request-changes -b "motivo"
gh pr merge 15 --squash --delete-branch --admin
```

Después del merge, avisa en el grupo para que todos actualicen `main`.

## Entrega

1. Domingo 20:00: se congela `main`; solo entran correcciones.
2. Ambas apps apuntan a la API de Railway (`EXPO_PUBLIC_API_URL`).
3. APKs: `npm i -g eas-cli`, `eas login`, y en `apps/mobile` y `apps/watch`: `eas build -p android --profile preview`. Lanza los builds temprano: la cola gratuita puede tardar horas. Respaldo local: `npx expo run:android --variant release`.
4. El móvil necesita `GOOGLE_MAPS_API_KEY` en EAS o el mapa sale en blanco en el APK.
5. Instala los APKs (`adb -s emulator-5556 install <archivo>.apk`) y prueba el flujo completo del README.
6. Tag y release:

```bash
git switch main && git pull --ff-only
git tag -a v1.0.0 -m "Entrega final"
git push origin v1.0.0
```
