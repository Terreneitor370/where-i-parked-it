import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { clearToken, getToken } from './src/api';
import { SYNC_INTERVAL_MS } from './src/config';
import { clearLocalData, initDb, type LocalVehicle } from './src/db';
import { syncNow, syncOnReconnect } from './src/sync';
import { FindScreen } from './src/screens/FindScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PairScreen } from './src/screens/PairScreen';
import { SaveScreen } from './src/screens/SaveScreen';
import { Loading } from './src/ui';

// Navegacion minima por estado: el reloj tiene pocas pantallas y no necesita Expo Router.
type Route = { name: 'loading' } | { name: 'pair' } | { name: 'home' } | { name: 'save'; vehicle: LocalVehicle } | { name: 'find' };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);

  const goHome = useCallback(() => {
    setRefreshKey((key) => key + 1);
    setRoute({ name: 'home' });
  }, []);

  const refreshAfterSync = useCallback(async () => {
    const result = await syncNow();
    if (!result.ok && result.reason === 'unauthorized') {
      await clearToken();
      setRoute({ name: 'pair' });
      return;
    }
    setRefreshKey((key) => key + 1);
  }, []);

  // Arranque: base local, token y primera sincronizacion.
  useEffect(() => {
    (async () => {
      await initDb();
      const token = await getToken();
      if (!token) {
        setRoute({ name: 'pair' });
        return;
      }
      setRoute({ name: 'home' });
      refreshAfterSync();
    })();
  }, [refreshAfterSync]);

  // Sincronizacion periodica y al recuperar la red, solo con sesion.
  useEffect(() => {
    if (route.name === 'loading' || route.name === 'pair') return;
    const interval = setInterval(refreshAfterSync, SYNC_INTERVAL_MS);
    const unsubscribe = syncOnReconnect(() => setRefreshKey((key) => key + 1));
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [route.name, refreshAfterSync]);

  // Boton/gesto "atras" del reloj: vuelve al inicio en vez de cerrar la app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'save' || route.name === 'find') {
        goHome();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [route.name, goHome]);

  const unpair = useCallback(async () => {
    await clearToken();
    await clearLocalData();
    setRoute({ name: 'pair' });
  }, []);

  let screen;
  switch (route.name) {
    case 'loading':
      screen = <Loading label="Cargando..." />;
      break;
    case 'pair':
      screen = <PairScreen onPaired={() => { goHome(); refreshAfterSync(); }} />;
      break;
    case 'home':
      screen = (
        <HomeScreen
          refreshKey={refreshKey}
          onSave={(vehicle) => setRoute({ name: 'save', vehicle })}
          onFind={() => setRoute({ name: 'find' })}
          onUnpair={unpair}
        />
      );
      break;
    case 'save':
      screen = <SaveScreen vehicle={route.vehicle} onDone={goHome} onCancel={goHome} />;
      break;
    case 'find':
      screen = <FindScreen onBack={goHome} />;
      break;
  }

  return (
    <>
      <StatusBar style="light" hidden />
      {screen}
    </>
  );
}
