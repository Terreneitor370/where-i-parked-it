import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { api, type ParkingSession, type Vehicle } from '../../lib/api';
import { formatDateTime, placeLabel } from '../../lib/format';
import { Button, Card, ErrorView, LoadingView, colors, text } from '../../lib/ui';

// Pantalla principal: donde esta el coche ahora (lo haya guardado el reloj o el telefono).
export default function MyCarScreen() {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);

  const active = useQuery({
    queryKey: ['parking', 'active'],
    queryFn: () => api<{ sessions: ParkingSession[] }>('/parking/active'),
    refetchInterval: 15_000, // para ver lo que guarda el reloj sin recargar
  });
  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api<{ vehicles: Vehicle[] }>('/vehicles'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['parking'] });

  const endParking = useMutation({
    mutationFn: (id: string) => api(`/parking/${id}/end`, { method: 'PATCH' }),
    onSuccess: refresh,
  });

  // Guardar desde el telefono (por si no se usa el reloj).
  const saveHere = useMutation({
    mutationFn: async (vehicleId: string) => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Permite el acceso a la ubicación');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return api('/parking', {
        method: 'POST',
        body: {
          vehicleId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? null,
        },
      });
    },
    onSuccess: () => {
      setSaveError(null);
      refresh();
    },
    onError: (error) => setSaveError((error as Error).message),
  });

  if (active.isPending || vehicles.isPending) return <LoadingView />;
  if (active.isError) return <ErrorView message={active.error.message} onRetry={() => active.refetch()} />;

  const session = active.data.sessions[0];
  const defaultVehicle = vehicles.data?.vehicles[0];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {session ? (
        <>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: session.latitude,
              longitude: session.longitude,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            }}
            showsUserLocation
          >
            <Marker coordinate={{ latitude: session.latitude, longitude: session.longitude }} title={session.vehicleNickname ?? 'Mi coche'} />
          </MapView>
          <Card>
            <Text style={text.title}>{session.vehicleNickname ?? 'Mi coche'}</Text>
            <Text style={text.body}>{placeLabel(session)}</Text>
            <Text style={text.muted}>
              {formatDateTime(session.parkedAt)} · desde {session.source === 'watch' ? 'el reloj' : 'el teléfono'}
            </Text>
            {session.notes.map((note) => (
              <Text key={note.id} style={text.body}>
                • {note.body}
              </Text>
            ))}
          </Card>
          <Button
            label={endParking.isPending ? 'Guardando...' : 'Ya lo recogí'}
            onPress={() => endParking.mutate(session.id)}
            disabled={endParking.isPending}
          />
        </>
      ) : (
        <Card>
          <Text style={text.title}>Sin ubicación guardada</Text>
          <Text style={text.muted}>Guarda dónde dejaste el coche desde el reloj o desde aquí.</Text>
        </Card>
      )}

      {defaultVehicle ? (
        <Button
          label={saveHere.isPending ? 'Obteniendo GPS...' : 'Guardar ubicación aquí'}
          variant="secondary"
          onPress={() => saveHere.mutate(defaultVehicle.id)}
          disabled={saveHere.isPending}
        />
      ) : (
        <Text style={text.muted}>Agrega un vehículo en la pestaña Vehículos.</Text>
      )}
      {saveError && <Text style={styles.error}>{saveError}</Text>}
      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: colors.bg, flexGrow: 1 },
  map: { height: 280, borderRadius: 12 },
  error: { color: colors.danger },
  spacer: { height: 24 },
});
