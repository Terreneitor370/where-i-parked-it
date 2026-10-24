import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

// Cliente HTTP de la app movil. La app movil trabaja en linea:
// siempre consulta la API (el modo offline es solo del reloj en esta entrega).

const TOKEN_KEY = 'wipi.token';
const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

// Se invoca cuando la API responde 401 (token vencido o invalido).
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = await tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(`Sin conexión con el servidor (${API_URL})`, 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
    throw new ApiError(data?.error ?? `Error ${response.status}`, response.status);
  }
  return data as T;
}

// ---------- Tipos de la API ----------

export type User = { id: string; email: string; displayName: string };

export type Vehicle = {
  id: string;
  nickname: string;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  isDefault: boolean;
};

export type ParkingNote = { id: string; body: string; createdAt: string };

export type ParkingSession = {
  id: string;
  vehicleId: string;
  vehicleNickname: string | null;
  source: 'watch' | 'phone';
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  level: string | null;
  zone: string | null;
  spot: string | null;
  parkedAt: string;
  endedAt: string | null;
  notes: ParkingNote[];
};
