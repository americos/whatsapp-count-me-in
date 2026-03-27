import Database from 'better-sqlite3';
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
export declare const createEvent: (chatId: string, title: string, slots: number, waitlistEnabled: boolean, createdBy: string) => number | bigint;
export declare const getActiveEvent: (chatId: string) => WhatsAppEvent | undefined;
export declare const addParticipant: (eventId: number | bigint, userId: string, userName: string, status: Participant["status"]) => Database.RunResult;
export declare const getParticipants: (eventId: number | bigint) => Participant[];
export declare const getParticipant: (eventId: number | bigint, userId: string) => Participant | undefined;
export declare const updateParticipantStatus: (eventId: number | bigint, userId: string, status: Participant["status"]) => Database.RunResult;
export declare const withdrawParticipant: (eventId: number | bigint, userId: string) => Database.RunResult;
export declare const cancelEvent: (eventId: number | bigint) => Database.RunResult;
export declare const getNextInWaitlist: (eventId: number | bigint) => Participant | undefined;
//# sourceMappingURL=database.d.ts.map