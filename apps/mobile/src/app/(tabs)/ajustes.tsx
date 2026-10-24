import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { api } from '../../lib/api';
import { API_URL } from '../../lib/config';
import { useSession } from '../../lib/session';
import { Button, Card, Field, colors, text } from '../../lib/ui';

export default function SettingsScreen() {
  const { user, signOut } = useSession();
  const [code, setCode] = useState('');

  // Emparejar reloj: el reloj muestra un codigo de 6 digitos y aqui se confirma.
  const pair = useMutation({
    mutationFn: () => api('/pair/confirm', { method: 'POST', body: { code: code.trim() } }),
    onSuccess: () => setCode(''),
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={text.title}>Emparejar reloj</Text>
        <Text style={text.muted}>Abre la app en el reloj y escribe el código que aparece.</Text>
        <Field
          label="Código de 6 dígitos"
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
        />
        {pair.isSuccess && <Text style={styles.ok}>Reloj emparejado. En unos segundos se sincroniza.</Text>}
        {pair.isError && <Text style={styles.error}>{pair.error.message}</Text>}
        <Button
          label={pair.isPending ? 'Emparejando...' : 'Emparejar'}
          onPress={() => pair.mutate()}
          disabled={pair.isPending || code.length !== 6}
        />
      </Card>

      <Card>
        <Text style={text.title}>Cuenta</Text>
        <Text style={text.body}>{user?.displayName ?? '—'}</Text>
        <Text style={text.muted}>{user?.email}</Text>
        <Text style={text.muted}>Servidor: {API_URL}</Text>
        <Button label="Cerrar sesión" variant="secondary" onPress={signOut} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: colors.bg, flexGrow: 1 },
  ok: { color: '#15803D' },
  error: { color: colors.danger },
});
