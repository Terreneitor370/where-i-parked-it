// Calculos de navegacion. Funcionan sin internet: solo usan coordenadas GPS.

export type Coords = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Distancia en metros entre dos puntos (formula de Haversine). */
export function distanceMeters(from: Coords, to: Coords): number {
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Rumbo inicial en grados (0 = norte, 90 = este) para ir de "from" a "to". */
export function bearingDegrees(from: Coords, to: Coords): number {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Angulo al que debe girar la flecha en pantalla.
 * heading = hacia donde apunta el reloj (0 = norte).
 */
export function arrowRotation(bearing: number, heading: number): number {
  return (bearing - heading + 360) % 360;
}

export function formatDistance(meters: number): string {
  if (meters < 10) return 'Aquí';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
