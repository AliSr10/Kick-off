CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL,
  phone VARCHAR(50), created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR(50) PRIMARY KEY, name VARCHAR(255) NOT NULL, phone VARCHAR(50) NOT NULL,
  date DATE NOT NULL, time VARCHAR(50) NOT NULL, end_time VARCHAR(50) NOT NULL,
  notes TEXT, status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  user_id INTEGER, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS standing_bookings (
  id SERIAL PRIMARY KEY, player_name VARCHAR(255) NOT NULL, phone VARCHAR(50),
  day_of_week INTEGER NOT NULL, time VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE reservations ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE reservations ALTER COLUMN status SET NOT NULL;
UPDATE reservations AS r SET
  starts_at = ((r.date + s.start_time::time) AT TIME ZONE 'Asia/Beirut'),
  ends_at = ((r.date + s.end_time::time) AT TIME ZONE 'Asia/Beirut')
FROM (VALUES
  ('3:00 PM - 4:30 PM', '15:00', '16:30'),
  ('4:30 PM - 6:00 PM', '16:30', '18:00'),
  ('6:00 PM - 7:30 PM', '18:00', '19:30'),
  ('7:30 PM - 9:00 PM', '19:30', '21:00'),
  ('9:00 PM - 10:30 PM', '21:00', '22:30'),
  ('10:30 PM - 12:00 AM', '22:30', '24:00')
) AS s(label, start_time, end_time)
WHERE r.time = s.label AND (r.starts_at IS NULL OR r.ends_at IS NULL);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_user_fk' AND conrelid = 'reservations'::regclass) THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_status_check' AND conrelid = 'reservations'::regclass) THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_status_check CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_slot_check' AND conrelid = 'reservations'::regclass) THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_slot_check CHECK (status = 'CANCELLED' OR time IN (
      '3:00 PM - 4:30 PM', '4:30 PM - 6:00 PM', '6:00 PM - 7:30 PM',
      '7:30 PM - 9:00 PM', '9:00 PM - 10:30 PM', '10:30 PM - 12:00 AM'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'standing_day_check' AND conrelid = 'standing_bookings'::regclass) THEN
    ALTER TABLE standing_bookings ADD CONSTRAINT standing_day_check CHECK (day_of_week BETWEEN 0 AND 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'standing_slot_check' AND conrelid = 'standing_bookings'::regclass) THEN
    ALTER TABLE standing_bookings ADD CONSTRAINT standing_slot_check CHECK (time IN (
      '3:00 PM - 4:30 PM', '4:30 PM - 6:00 PM', '6:00 PM - 7:30 PM',
      '7:30 PM - 9:00 PM', '9:00 PM - 10:30 PM', '10:30 PM - 12:00 AM'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_confirmed_slot ON reservations (date, time) WHERE status = 'CONFIRMED';
CREATE UNIQUE INDEX IF NOT EXISTS standing_one_weekly_slot ON standing_bookings (day_of_week, time);
CREATE INDEX IF NOT EXISTS reservations_user_date ON reservations (user_id, date DESC);
CREATE INDEX IF NOT EXISTS reservations_status_date ON reservations (status, date);
CREATE TABLE IF NOT EXISTS session (sid VARCHAR PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL);
CREATE INDEX IF NOT EXISTS session_expire ON session (expire);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY, actor VARCHAR(255) NOT NULL,
  action VARCHAR(80) NOT NULL, entity_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
