import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { api, ApiError, setToken } from '../api';
import { Button, Loading, Muted, Screen, Title, colors } from '../ui';

// Emparejamiento: el reloj muestra un codigo de 6 digitos y el usuario lo
// captura en la app movil (Ajustes > Emparejar reloj). Solo necesita red esta vez.

type PairCode = { code: string; expiresAt: string };
type PairStatus = { status: 'pending' } | { status: 'paired'; token: string };

const POLL_MS = 3000;
const EXPIRE_TICK_MS = 1000;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function PairScreen({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRequestInFlight = useRef(false);
  const mounted = useRef(true);

  const stopTimers = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (expiryTimer.current) clearInterval(expiryTimer.current);
    pollTimer.current = null;
    expiryTimer.current = null;
  };

  const requestCode = useCallback(async () => {
    if (codeRequestInFlight.current) return;
    codeRequestInFlight.current = true;
    stopTimers();
    setError(null);
    setCode(null);
    setExpiresAt(null);
    setRemainingMs(null);
    try {
      const result = await api<PairCode>('/pair/code', { method: 'POST', auth: false });
      if (!mounted.current) return;
      setCode(result.code);
      setExpiresAt(result.expiresAt);

      pollTimer.current = setInterval(async () => {
        try {
          const status = await api<PairStatus>(`/pair/status/${result.code}`, { auth: false });
          if (status.status === 'paired') {
            stopTimers();
            await setToken(status.token);
            onPaired();
          }
        } catch (pollError) {
          if (pollError instanceof ApiError && pollError.status === 404) {
            stopTimers();
            if (!mounted.current) return;
            setError('El código expiró');
          }
          // Otros errores (red): se reintenta en el siguiente intervalo.
        }
      }, POLL_MS);

      expiryTimer.current = setInterval(() => {
        const ms = new Date(result.expiresAt).getTime() - Date.now();
        if (ms <= 0) {
          stopTimers();
          if (!mounted.current) return;
          setRemainingMs(0);
          requestCode();
          return;
        }
        if (mounted.current) setRemainingMs(ms);
      }, EXPIRE_TICK_MS);
    } catch {
      if (mounted.current) setError('Sin conexión con el servidor');
    } finally {
      codeRequestInFlight.current = false;
    }
  }, [onPaired]);

  useEffect(() => {
    mounted.current = true;
    requestCode();
    return () => {
      mounted.current = false;
      stopTimers();
    };
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
      <Title>Emparejar reloj</Title>
      <Muted>Escribe este código en la app del teléfono</Muted>
      <Text style={styles.code}>{code}</Text>
      {expiresAt && (
        <Muted>
          Expira en {remainingMs === null ? '...' : formatRemaining(remainingMs)}
        </Muted>
      )}
      <Muted>Ajustes › Emparejar reloj</Muted>
      <Button label="Nuevo código" variant="secondary" onPress={requestCode} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: 4 },
});
