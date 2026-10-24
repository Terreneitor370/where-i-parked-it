// Config plugin: convierte la app Android generada por Expo en una app Wear OS.
// Se aplica al correr `npx expo prebuild` o `npx expo run:android`.
//
// - <uses-feature android.hardware.type.watch>: marca la app como app de reloj.
// - meta-data com.google.android.wearable.standalone = true: la app funciona sin
//   el telefono (requisito del proyecto: el reloj es independiente).
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

function withWearOS(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    const alreadyWatch = manifest['uses-feature'].some(
      (feature) => feature.$['android:name'] === 'android.hardware.type.watch',
    );
    if (!alreadyWatch) {
      manifest['uses-feature'].push({
        $: { 'android:name': 'android.hardware.type.watch', 'android:required': 'true' },
      });
    }

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      'com.google.android.wearable.standalone',
      'true',
    );

    return cfg;
  });
}

module.exports = withWearOS;
