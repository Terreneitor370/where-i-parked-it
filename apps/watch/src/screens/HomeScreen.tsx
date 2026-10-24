import { useCallback, useEffect, useState } from 'react';
import { countPending, getActiveSession, getDefaultVehicle, getState, type LocalVehicle } from '../db';
import { syncNow } from '../sync';
import { Button, Muted, Screen, Title } from '../ui';

type Props = {
  onSave: (vehicle: LocalVehicle) => void;
  onFind: () => void;
  onUnpair: () => void;
  refreshKey: number;
};

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} d`;
}

export function HomeScreen({ onSave, onFind, onUnpair, refreshKey }: Props) {
  const [vehicle, setVehicle] = useState<LocalVehicle | null>(null);
  const [active, setActive] = useState<Awaited<ReturnType<typeof getActiveSession>>>(null);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setVehicle(await getDefaultVehicle());
    setActive(await getActiveSession());
    setPending(await countPending());
    setLastSync(await getState('last_sync_at'));
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
    await load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const status = syncing
    ? 'Sincronizando...'
    : pending > 0
      ? `${pending} cambio(s) sin subir`
      : lastSync
        ? `Sincronizado ${timeAgo(lastSync)}`
        : 'Sin sincronizar';

  if (!vehicle) {
    return (
      <Screen>
        <Title>Sin vehículos</Title>
        <Muted>Agrega tu vehículo en la app del teléfono y sincroniza.</Muted>
        <Button label="Sincronizar" onPress={sync} disabled={syncing} />
        <Button label="Desemparejar" variant="secondary" onPress={onUnpair} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Title>{vehicle.nickname}</Title>
      {active ? (
        <Muted>
          {active.level ?? 'Guardado'} · {timeAgo(active.parked_at)}
        </Muted>
      ) : (
        <Muted>Sin ubicación guardada</Muted>
      )}
      <Button label="Guardar aquí" onPress={() => onSave(vehicle)} />
      {active && <Button label="Buscar mi coche" variant="secondary" onPress={onFind} />}
      <Muted>{status}</Muted>
      <Button label="Sincronizar" variant="secondary" onPress={sync} disabled={syncing} />
      <Button label="Desemparejar" variant="secondary" onPress={onUnpair} />
    </Screen>
  );
}
