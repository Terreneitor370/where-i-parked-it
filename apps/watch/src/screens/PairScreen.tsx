import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { api, ApiError, setToken } from '../api';
import { Button, Loading, Muted, Screen, Title, colors } from '../ui';

// Emparejamiento: el reloj muestra un codigo de 6 digitos y el usuario lo
// captura en la app movil (Ajustes > Emparejar reloj). Solo necesita red esta vez.

type PairCode = { code: string; expiresAt: string };
type PairStatus = { status: 'pending' } | { status: 'paired'; token: string };

const POLL_MS = 3000;

export function PairScreen({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const requestCode = useCallback(async () => {
    stopPolling();
    setError(null);
    setCode(null);
    try {
      const result = await api<PairCode>('/pair/code', { method: 'POST', auth: false });
      setCode(result.code);

      timer.current = setInterval(async () => {
        try {
          const status = await api<PairStatus>(`/pair/status/${result.code}`, { auth: false });
          if (status.status === 'paired') {
            stopPolling();
            await setToken(status.token);
            onPaired();
          }
        } catch (pollError) {
          if (pollError instanceof ApiError && pollError.status === 404) {
            stopPolling();
            setError('El código expiró');
          }
          // Otros errores (red): se reintenta en el siguiente intervalo.
        }
      }, POLL_MS);
    } catch {
      setError('Sin conexión con el servidor');
    }
  }, [onPaired]);

  useEffect(() => {
    requestCode();
    return stopPolling;
  }, [requestCode]);

  if (error) {
    return (
      <Screen>
        <Title>No se pudo emparejar</Title>
        <Muted>{error}</Muted>
        <Button label="Reintentar" onPress={requestCode} />
      </Screen>
    );
  }

  if (!code) return <Loading label="Pidiendo código..." />;

  return (
    <Screen>
      <Muted>Escribe este código en la app del teléfono</Muted>
      <Text style={styles.code}>{code}</Text>
      <Muted>Ajustes › Emparejar reloj</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: 4 },
});
