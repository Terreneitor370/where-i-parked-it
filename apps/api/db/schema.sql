-- Where I Parked It - esquema MySQL 8
-- Se aplica solo al crear el contenedor de docker compose,
-- o manualmente con: npm run db:init
--
-- Convencion de sincronizacion (tablas vehicles, parking_sessions, parking_notes):
--   updated_at         hora del cliente; decide conflictos (gana la mas reciente)
--   server_updated_at  hora del servidor; cursor de /sync/pull
--   deleted_at         borrado logico; nunca se borra fisicamente

CREATE TABLE IF NOT EXISTS users (
  id                CHAR(36)     PRIMARY KEY,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  display_name      VARCHAR(100) NOT NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id                CHAR(36)     PRIMARY KEY,
  user_id           CHAR(36)     NOT NULL,
  nickname          VARCHAR(50)  NOT NULL,
  plate             VARCHAR(15)  NULL,
  brand             VARCHAR(50)  NULL,
  model             VARCHAR(50)  NULL,
  color             VARCHAR(30)  NULL,
  is_default        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        DATETIME(3)  NOT NULL,
  updated_at        DATETIME(3)  NOT NULL,
  server_updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)  NULL,
  CONSTRAINT fk_vehicles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_vehicles_sync (user_id, server_updated_at)
);

CREATE TABLE IF NOT EXISTS parking_sessions (
  id                CHAR(36)      PRIMARY KEY,
  user_id           CHAR(36)      NOT NULL,
  vehicle_id        CHAR(36)      NOT NULL,
  source            ENUM('watch','phone') NOT NULL,
  latitude          DECIMAL(10,7) NOT NULL,
  longitude         DECIMAL(10,7) NOT NULL,
  accuracy_m        DECIMAL(6,1)  NULL,
  level             VARCHAR(20)   NULL,
  zone              VARCHAR(30)   NULL,
  spot              VARCHAR(20)   NULL,
  parked_at         DATETIME(3)   NOT NULL,
  ended_at          DATETIME(3)   NULL,
  created_at        DATETIME(3)   NOT NULL,
  updated_at        DATETIME(3)   NOT NULL,
  server_updated_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)   NULL,
  CONSTRAINT fk_sessions_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_sessions_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  INDEX idx_sessions_active  (vehicle_id, ended_at),
  INDEX idx_sessions_history (user_id, parked_at),
  INDEX idx_sessions_sync    (user_id, server_updated_at)
);

CREATE TABLE IF NOT EXISTS parking_notes (
  id                CHAR(36)     PRIMARY KEY,
  session_id        CHAR(36)     NOT NULL,
  user_id           CHAR(36)     NOT NULL,
  body              VARCHAR(500) NOT NULL,
  created_at        DATETIME(3)  NOT NULL,
  updated_at        DATETIME(3)  NOT NULL,
  server_updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)  NULL,
  CONSTRAINT fk_notes_session FOREIGN KEY (session_id) REFERENCES parking_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_user    FOREIGN KEY (user_id)    REFERENCES users(id)            ON DELETE CASCADE,
  INDEX idx_notes_sync (user_id, server_updated_at)
);
