import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { colors } from '../../lib/ui';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      headerTitleAlign: 'center',
      headerStyle: {
        backgroundColor: colors.bg,
        borderBottomWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: colors.text,
      tabBarStyle: {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        elevation: 0,
      },
      // Agrega un efecto de onda al tocar las pestañas
      tabBarButton: (props) => (
        <Pressable
          {...props}
          android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
        />
      ),
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mi coche',
          tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="vehiculos"
        options={{
          title: 'Vehículos',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
