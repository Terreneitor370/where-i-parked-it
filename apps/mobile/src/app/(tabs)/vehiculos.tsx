import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { api, type Vehicle } from '../../lib/api';
import { Button, Card, ErrorView, Field, LoadingView, colors, text } from '../../lib/ui';

// TODO (Kassie): editar vehiculo (PATCH /vehicles/:id) y confirmar antes de eliminar.
export default function VehiclesScreen() {
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState('');
  const [plate, setPlate] = useState('');

  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api<{ vehicles: Vehicle[] }>('/vehicles'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['vehicles'] });

  const create = useMutation({
    mutationFn: () =>
      api('/vehicles', { method: 'POST', body: { nickname: nickname.trim(), plate: plate.trim() || null } }),
    onSuccess: () => {
      setNickname('');
      setPlate('');
      invalidate();
    },
  });

  const makeDefault = useMutation({
    mutationFn: (id: string) => api(`/vehicles/${id}`, { method: 'PATCH', body: { isDefault: true } }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/vehicles/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  if (vehicles.isPending) return <LoadingView />;
  if (vehicles.isError) return <ErrorView message={vehicles.error.message} onRetry={() => vehicles.refetch()} />;

  return (
    <FlatList
      data={vehicles.data.vehicles}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Card>
          <Text style={text.title}>Agregar vehículo</Text>
          <Field label="Nombre" placeholder="El Versa" value={nickname} onChangeText={setNickname} />
          <Field label="Placa (opcional)" value={plate} onChangeText={setPlate} autoCapitalize="characters" />
          {create.isError && <Text style={styles.error}>{create.error.message}</Text>}
          <Button
            label={create.isPending ? 'Guardando...' : 'Agregar'}
            onPress={() => create.mutate()}
            disabled={create.isPending || nickname.trim().length === 0}
          />
        </Card>
      }
      ListEmptyComponent={<Text style={text.muted}>Aún no tienes vehículos.</Text>}
      renderItem={({ item }) => (
        <Card>
          <Text style={text.body}>
            {item.nickname}
            {item.isDefault ? ' (predeterminado)' : ''}
          </Text>
          {item.plate && <Text style={text.muted}>Placa {item.plate}</Text>}
          <View style={styles.row}>
            {!item.isDefault && (
              <Button label="Predeterminado" variant="secondary" onPress={() => makeDefault.mutate(item.id)} />
            )}
            <Button label="Eliminar" variant="danger" onPress={() => remove.mutate(item.id)} />
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, backgroundColor: colors.bg, flexGrow: 1 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  error: { color: colors.danger },
});
