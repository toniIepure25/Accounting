# apps/mobile — aplicația mobilă (iOS / Android)

Ținta **mobilă** din plan. Nu are cod separat: în Tauri v2 aplicația mobilă folosește
**același proiect** ca desktopul ([`apps/desktop`](../desktop)) și **același UI React**
([`packages/ui`](../../packages/ui)). Punctul de intrare comun există deja în
[`src-tauri/src/lib.rs`](../desktop/src-tauri/src/lib.rs) prin `#[cfg_attr(mobile, tauri::mobile_entry_point)]`.

## Activarea țintelor mobile

Din `apps/desktop`, o singură dată per platformă:

```bash
npm run tauri -w @gr/desktop -- android init
npm run tauri -w @gr/desktop -- ios init
```

Apoi dezvoltare / build:

```bash
npm run tauri -w @gr/desktop -- android dev
npm run tauri -w @gr/desktop -- ios build
```

## Cerințe

- **Android**: Android Studio + SDK/NDK, `ANDROID_HOME`, `NDK_HOME`.
- **iOS**: macOS + Xcode (build-ul iOS se face doar pe macOS).

## Rolul aplicației mobile

Companion pentru teren: **inventariere** (scanare cod de bare → mișcări de stoc), **POS**
la masă (vânzări cu amănuntul) și **status comenzi** (modul Mobilă). Datele se sincronizează
cu serverul (modul `lan`/`cloud`) prin același `createApiProvider`, sau lucrează offline pe
SQLite local — exact ca desktopul, fiindcă UI-ul și stratul de date sunt partajate.
