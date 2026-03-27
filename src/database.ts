import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'events.db'));

export interface WhatsAppEvent {
  id: number;
  chat_id: string;
  title: string;
  slots: number;
  waitlist_enabled: number;
  created_by: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Participant {
  id: number;
  event_id: number;
  user_id: string;
  user_name: string;
  status: 'joined' | 'waitlisted' | 'withdrawn' | 'pending_promotion';
  joined_at: string;
}

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    title TEXT NOT NULL,
    slots INTEGER NOT NULL,
    waitlist_enabled INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'joined', 'waitlisted', 'withdrawn', 'pending_promotion'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS chat_settings (
    chat_id TEXT PRIMARY KEY,
    locale TEXT NOT NULL DEFAULT 'en'
  );
`);

import type { Locale } from './i18n.js';

export const getLocale = (chatId: string): Locale => {
  const row = db.prepare('SELECT locale FROM chat_settings WHERE chat_id = ?').get(chatId) as { locale: string } | undefined;
  return (row?.locale as Locale) ?? 'en';
};

export const setLocale = (chatId: string, locale: Locale): void => {
  db.prepare('INSERT INTO chat_settings (chat_id, locale) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET locale = excluded.locale').run(chatId, locale);
};

export const createEvent = (chatId: string, title: string, slots: number, waitlistEnabled: boolean, createdBy: string): number | bigint => {
  const stmt = db.prepare(`
    INSERT INTO events (chat_id, title, slots, waitlist_enabled, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(chatId, title, slots, waitlistEnabled ? 1 : 0, createdBy);
  return info.lastInsertRowid;
};

export const getActiveEvent = (chatId: string): WhatsAppEvent | undefined => {
  return db.prepare('SELECT * FROM events WHERE chat_id = ? AND status = \'active\' ORDER BY created_at DESC LIMIT 1').get(chatId) as WhatsAppEvent | undefined;
};

export const addParticipant = (eventId: number | bigint, userId: string, userName: string, status: Participant['status']) => {
  const stmt = db.prepare(`
    INSERT INTO participants (event_id, user_id, user_name, status)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(eventId, userId, userName, status);
};

export const getParticipants = (eventId: number | bigint): Participant[] => {
  return db.prepare('SELECT * FROM participants WHERE event_id = ? AND status IN (\'joined\', \'waitlisted\', \'pending_promotion\') ORDER BY joined_at ASC').all(eventId) as Participant[];
};

export const getParticipant = (eventId: number | bigint, userId: string): Participant | undefined => {
  return db.prepare('SELECT * FROM participants WHERE event_id = ? AND user_id = ? AND status NOT IN (\'withdrawn\')').get(eventId, userId) as Participant | undefined;
};

export const updateParticipantStatus = (eventId: number | bigint, userId: string, status: Participant['status']) => {
  const stmt = db.prepare('UPDATE participants SET status = ? WHERE event_id = ? AND user_id = ?');
  return stmt.run(status, eventId, userId);
};

export const withdrawParticipant = (eventId: number | bigint, userId: string) => {
  const stmt = db.prepare('UPDATE participants SET status = \'withdrawn\' WHERE event_id = ? AND user_id = ?');
  return stmt.run(eventId, userId);
};

export const cancelEvent = (eventId: number | bigint) => {
  const stmt = db.prepare('UPDATE events SET status = \'cancelled\' WHERE id = ?');
  return stmt.run(eventId);
};

export const getNextInWaitlist = (eventId: number | bigint): Participant | undefined => {
  return db.prepare('SELECT * FROM participants WHERE event_id = ? AND status = \'waitlisted\' ORDER BY joined_at ASC LIMIT 1').get(eventId) as Participant | undefined;
};
