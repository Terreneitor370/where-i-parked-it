import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
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
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mi coche',
          tabBarIcon: (props) => <Ionicons name="car" size={props.size} color={props.color} />
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: (props) => <Ionicons name="time" size={props.size} color={props.color} />
        }}
      />
      <Tabs.Screen
        name="vehiculos"
        options={{
          title: 'Vehículos',
          tabBarIcon: (props) => <Ionicons name="list" size={props.size} color={props.color} />
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: (props) => <Ionicons name="settings" size={props.size} color={props.color} />
        }}
      />
    </Tabs>
  );
}
