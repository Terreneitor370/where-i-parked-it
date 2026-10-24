import { Tabs } from 'expo-router/tabs';
import { colors } from '../../lib/ui';

// TODO (Kassie): iconos para cada pestana (por ejemplo con @expo/vector-icons).
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleAlign: 'center' }}>
      <Tabs.Screen name="index" options={{ title: 'Mi coche' }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="vehiculos" options={{ title: 'Vehículos' }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
