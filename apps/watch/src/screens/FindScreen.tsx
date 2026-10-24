import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { endParking, getActiveSession } from '../db';
import { arrowRotation, bearingDegrees, distanceMeters, formatDistance } from '../geo';
import { syncNow } from '../sync';
import { Button, Loading, Muted, Screen, Title, colors } from '../ui';

// Brujula hacia el coche: flecha + distancia. Sin internet.
// En el emulador, la ubicacion se mueve desde Extended controls > Location
// y el rumbo desde Extended controls > Virtual sensors.

type Active = NonNullable<Awaited<ReturnType<typeof getActiveSession>>>;

export function FindScreen({ onBack }: { onBack: () => void }) {
  const [target, setTarget] = useState<Active | null>(null);
  const [here, setHere] = useState<Location.LocationObjectCoords | null>(null);
  const [heading, setHeading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let positionSub: Location.LocationSubscription | null = null;
    let headingSub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      setTarget(await getActiveSession());

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Permite el acceso a la ubicación');
        return;
      }
      positionSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 },
        (location) => !cancelled && setHere(location.coords),
      );
      headingSub = await Location.watchHeadingAsync((value) => {
        // trueHeading es -1 si no hay datos suficientes; entonces se usa el magnetico.
        const next = value.trueHeading >= 0 ? value.trueHeading : value.magHeading;
        if (!cancelled) setHeading(next);
      });
    })();

    return () => {
      cancelled = true;
      positionSub?.remove();
      headingSub?.remove();
    };
  }, []);

  const pickedUp = async () => {
    if (!target) return;
    await endParking(target.id);
    syncNow();
    onBack();
  };

  if (error) {
    return (
      <Screen>
        <Title>Sin ubicación</Title>
        <Muted>{error}</Muted>
        <Button label="Volver" variant="secondary" onPress={onBack} />
      </Screen>
    );
  }

  if (!target) {
    return (
      <Screen>
        <Muted>No hay ubicación guardada</Muted>
        <Button label="Volver" variant="secondary" onPress={onBack} />
      </Screen>
    );
  }

  if (!here) return <Loading label="Buscando GPS..." />;

  const car = { latitude: target.latitude, longitude: target.longitude };
  const meters = distanceMeters(here, car);
  const rotation = arrowRotation(bearingDegrees(here, car), heading);

  return (
    <Screen scroll>
      <View style={[styles.arrowBox, { transform: [{ rotate: `${rotation}deg` }] }]}>
        <Text style={styles.arrow}>▲</Text>
      </View>
      <Title>{formatDistance(meters)}</Title>
      {target.level && <Muted>{target.level}</Muted>}
      <Button label="Ya lo recogí" onPress={pickedUp} />
      <Button label="Volver" variant="secondary" onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  arrowBox: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  arrow: { color: colors.primary, fontSize: 56, lineHeight: 64 },
});
