import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { LEVEL_PRESETS } from '../config';
import { saveParking, type LocalVehicle } from '../db';
import { syncNow } from '../sync';
import { Button, Loading, Muted, Screen, Title, colors } from '../ui';

// Guarda la ubicacion actual. Funciona sin internet: el GPS no necesita red
// y el registro se guarda en SQLite + outbox.

type Props = { vehicle: LocalVehicle; onDone: () => void; onCancel: () => void };
const GPS_TIMEOUT_MS = 12000;

export function SaveScreen({ vehicle, onDone, onCancel }: Props) {
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [usingLastKnown, setUsingLastKnown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Permite el acceso a la ubicación en Ajustes');
        return;
      }
      try {
        const current = await new Promise<Location.LocationObject>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('GPS_TIMEOUT')), GPS_TIMEOUT_MS);
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
            .then((value) => {
              clearTimeout(timeout);
              resolve(value);
            })
            .catch((reason) => {
              clearTimeout(timeout);
              reject(reason);
            });
        });
        if (!cancelled) {
          setPosition(current);
          setUsingLastKnown(false);
        }
      } catch {
        const fallback = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 100 });
        if (fallback && !cancelled) {
          setPosition(fallback);
          setUsingLastKnown(true);
          return;
        }
        if (!cancelled) setError('No se pudo obtener el GPS. Intenta al aire libre.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!position) return;
    setSaving(true);
    await saveParking({
      vehicleId: vehicle.id,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy ?? null,
      level,
    });
    // Intento de subida inmediato; si no hay red se queda en el outbox.
    syncNow();
    onDone();
  };

  if (error) {
    return (
      <Screen>
        <Title>Sin ubicación</Title>
        <Muted>{error}</Muted>
        <Button label="Volver" variant="secondary" onPress={onCancel} />
      </Screen>
    );
  }

  if (!position) return <Loading label="Buscando GPS..." />;

  return (
    <Screen scroll>
      <Title>¿Dónde quedó?</Title>
      <Muted>Precisión ±{Math.round(position.coords.accuracy ?? 0)} m</Muted>
      {usingLastKnown && <Muted>Usando la última ubicación disponible del reloj</Muted>}
      <View style={styles.chips}>
        {LEVEL_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => setLevel(level === preset ? null : preset)}
            style={[styles.chip, level === preset && styles.chipActive]}
          >
            <Text style={styles.chipText}>{preset}</Text>
          </Pressable>
        ))}
      </View>
      <Button label={saving ? 'Guardando...' : 'Guardar'} onPress={save} disabled={saving} />
      <Button label="Cancelar" variant="secondary" onPress={onCancel} disabled={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
});
