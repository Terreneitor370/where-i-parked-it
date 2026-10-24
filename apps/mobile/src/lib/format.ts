const dateTime = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** "Nivel 3 · Zona azul · C-14" con lo que haya. */
export function placeLabel(session: { level: string | null; zone: string | null; spot: string | null }): string {
  return [session.level, session.zone, session.spot].filter(Boolean).join(' · ') || 'Sin nivel ni zona';
}
