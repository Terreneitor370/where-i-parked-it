import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text } from 'react-native';
import { api, type ParkingSession } from '../../lib/api';
import { formatDateTime, placeLabel } from '../../lib/format';
import { Card, ErrorView, LoadingView, colors, text } from '../../lib/ui';

// TODO (Kassie): filtro por vehiculo (GET /parking?vehicleId=...) y detalle con mapa.
export default function HistoryScreen() {
  const history = useQuery({
    queryKey: ['parking', 'history'],
    queryFn: () => api<{ sessions: ParkingSession[] }>('/parking?limit=50'),
  });

  if (history.isPending) return <LoadingView />;
  if (history.isError) return <ErrorView message={history.error.message} onRetry={() => history.refetch()} />;

  return (
    <FlatList
      data={history.data.sessions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshing={history.isRefetching}
      onRefresh={() => history.refetch()}
      ListEmptyComponent={<Text style={text.muted}>Todavía no hay estacionamientos.</Text>}
      renderItem={({ item }) => (
        <Card>
          <Text style={text.body}>
            {item.vehicleNickname ?? 'Vehículo'} · {placeLabel(item)}
          </Text>
          <Text style={text.muted}>
            {formatDateTime(item.parkedAt)}
            {item.endedAt ? ` → ${formatDateTime(item.endedAt)}` : ' · sigue ahí'}
          </Text>
          {item.notes.map((note) => (
            <Text key={note.id} style={text.muted}>
              • {note.body}
            </Text>
          ))}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, backgroundColor: colors.bg, flexGrow: 1 },
});
