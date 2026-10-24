import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

// Componentes base para pantalla redonda de reloj.
// Regla: el contenido importante va al centro; los bordes se recortan en pantallas redondas.

export const colors = {
  bg: '#000000',
  text: '#FFFFFF',
  muted: '#A0A4AB',
  primary: '#4C8DFF',
  danger: '#FF5C5C',
  surface: '#1C1F24',
};

export function Screen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const { width } = useWindowDimensions();
  // ~15% de margen para que nada quede fuera del circulo.
  const padding = Math.round(width * 0.15);
  const content = (
    <View style={[styles.content, { paddingHorizontal: padding, paddingVertical: padding * 0.6 }]}>{children}</View>
  );
  return (
    <View style={styles.screen}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const background = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surface;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <Screen>
      <ActivityIndicator color={colors.primary} size="large" />
      <Muted>{label}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  muted: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  button: { alignSelf: 'stretch', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
