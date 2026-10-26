import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

// Estilo "Modern Tech Premium": Fondo oscuro, bordes suaves, feedback táctil.

export const colors = {
  bg: '#111827', // Fondo gris pizarra muy oscuro
  card: '#1F2937', // Tarjetas de un gris un poco más claro
  text: '#F9FAFB', // Blanco puro
  muted: '#9CA3AF', // Gris claro para textos secundarios
  primary: '#3B82F6', // Azul eléctrico
  primaryText: '#FFFFFF',
  danger: '#EF4444', // Rojo brillante
  border: '#374151', // Bordes sutiles
  inputBg: '#111827', // Inputs se hunden
};

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
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
  let bgColor = colors.primary;
  let txtColor = colors.primaryText;
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'secondary') {
    bgColor = 'transparent';
    txtColor = colors.text;
    borderColor = colors.border;
    borderWidth = 1;
  } else if (variant === 'danger') {
    bgColor = 'rgba(239, 68, 68, 0.1)';
    txtColor = colors.danger;
  }

  // Si está deshabilitado, fondo transparente con borde y texto gris
  if (disabled) {
    bgColor = 'transparent';
    txtColor = colors.muted;
    borderColor = colors.border;
    borderWidth = 1;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderWidth: borderWidth,
          // Feedback visual: se encoge un poquito al presionar
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: txtColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function LoadingView() {
  return (
    <Centered>
      <ActivityIndicator color={colors.primary} size="large" />
    </Centered>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Centered>
      <Text style={styles.error}>{message}</Text>
      {onRetry && <Button label="Reintentar" onPress={onRetry} variant="secondary" />}
    </Centered>
  );
}

export const text = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  body: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  muted: { fontSize: 13, color: colors.muted },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    gap: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  error: { color: colors.danger, textAlign: 'center', fontWeight: 'bold' },
});
