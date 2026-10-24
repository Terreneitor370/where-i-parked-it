import type { RowDataPacket } from 'mysql2';
import { toIso } from './db.js';

// Filas tal como vienen de MySQL (snake_case) y su forma JSON (camelCase).

export type VehicleRow = RowDataPacket & {
  id: string;
  user_id: string;
  nickname: string;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  is_default: number;
  created_at: Date;
  updated_at: Date;
  server_updated_at: Date;
  deleted_at: Date | null;
};

export type SessionRow = RowDataPacket & {
  id: string;
  user_id: string;
  vehicle_id: string;
  source: 'watch' | 'phone';
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  level: string | null;
  zone: string | null;
  spot: string | null;
  parked_at: Date;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
  server_updated_at: Date;
  deleted_at: Date | null;
  vehicle_nickname?: string;
};

export type NoteRow = RowDataPacket & {
  id: string;
  session_id: string;
  user_id: string;
  body: string;
  created_at: Date;
  updated_at: Date;
  server_updated_at: Date;
  deleted_at: Date | null;
};

export function vehicleToJson(row: VehicleRow) {
  return {
    id: row.id,
    nickname: row.nickname,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    color: row.color,
    isDefault: Boolean(row.is_default),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    deletedAt: toIso(row.deleted_at),
  };
}

export function sessionToJson(row: SessionRow) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleNickname: row.vehicle_nickname ?? null,
    source: row.source,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracy_m,
    level: row.level,
    zone: row.zone,
    spot: row.spot,
    parkedAt: toIso(row.parked_at),
    endedAt: toIso(row.ended_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    deletedAt: toIso(row.deleted_at),
  };
}

export function noteToJson(row: NoteRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    body: row.body,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    deletedAt: toIso(row.deleted_at),
  };
}
