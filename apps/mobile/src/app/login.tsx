import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../lib/session';
import { Button, Field, colors, text } from '../lib/ui';

export default function LoginScreen() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, displayName.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <Text style={text.title}>Dónde lo dejé</Text>
        <Text style={text.muted}>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</Text>

        <View style={styles.form}>
          {mode === 'register' && <Field label="Nombre" value={displayName} onChangeText={setDisplayName} />}
          <Field
            label="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={busy ? 'Enviando...' : mode === 'login' ? 'Entrar' : 'Registrarme'} onPress={submit} disabled={busy} />
        </View>

        <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={styles.link}>{mode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  form: { gap: 12, marginTop: 16 },
  error: { color: colors.danger },
  link: { color: colors.primary, textAlign: 'center', marginTop: 16 },
});
