import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extiende app.json con valores que no deben ir en el repo.
//
// GOOGLE_MAPS_API_KEY: en Expo Go el mapa funciona sin clave, pero el APK
// (EAS Build) muestra el mapa en blanco si no la tiene. Se configura como
// variable de entorno de EAS:  eas env:create --name GOOGLE_MAPS_API_KEY --value <clave>
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }],
  ],
});
