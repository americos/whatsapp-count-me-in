import type { Chat, GroupChat, Message, Client } from 'whatsapp-web.js';
import * as db from './database.js';

export async function handleCommand(message: Message, client: Client) {
  try {
    const chat = await message.getChat() as GroupChat;
    if (!chat.isGroup) return;
    const senderId = message.fromMe ? client.info.wid._serialized : (message.author || message.from);
    if (!senderId) return;

    const contact = await client.getContactById(senderId);
    if (!contact) return;

    const userId = contact.id._serialized;
    const userName = contact.pushname || contact.number;
    const body = message.body.trim();
    if (!body.startsWith('!')) return;

    console.log(`[handleCommand] Processing command: "${body}" | fromMe: ${message.fromMe}`);

    const [rawCommand, ...args] = body.split(' ');
    if (!rawCommand) return;
    const command = rawCommand.toLowerCase();

    switch (command) {
      case '!create':
        await handleCreate(message, chat, userId, args, client);
        break;
      case '!join':
        await handleJoin(message, chat, userId, userName, client, false);
        break;
      case '!waitlist':
        await handleJoin(message, chat, userId, userName, client, true);
        break;
      case '!leave':
        await handleLeave(message, chat, userId, userName, client);
        break;
      case '!status':
        await handleStatus(message, chat, client);
        break;
      case '!cancel':
        await handleCancel(message, chat, userId, client);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('Error in handleCommand:', err);
  }
}

async function handleCancel(message: Message, chat: GroupChat, userId: string, client: Client) {
  if (!(await isAdmin(chat, userId))) {
    return await safeReply(message, chat, client, 'Only group admins can cancel events.');
  }

  const event = db.getActiveEvent(chat.id._serialized);
  if (!event) return await safeReply(message, chat, client, 'No active event to cancel.');

  db.cancelEvent(event.id);
  await safeReply(message, chat, client, `🛑 Event "${event.title}" has been cancelled.`);
}

async function isAdmin(chat: GroupChat, userId: string): Promise<boolean> {
  if (!chat.isGroup) return true;

  // Sometimes participants aren't pre-loaded on the chat object
  if (!chat.participants || chat.participants.length === 0) {
    console.warn(`[isAdmin] No participants cached for group ${chat.id._serialized}.`);
  }

  const participant = chat.participants?.find((p: any) => (p.id?._serialized || p.id) === userId);
  return !!(participant && (participant.isAdmin || participant.isSuperAdmin));
}

async function handleCreate(message: Message, chat: GroupChat, userId: string, args: string[], client: any) {
  if (!(await isAdmin(chat, userId))) {
    return await safeReply(message, chat, client, 'Only group admins can create events.');
  }

  // Flexible regex: handles !create and both straight (") and curly (“, ”) quotes
  const match = message.body.match(/(?:!create)\s+(?:"([^"]+)"|“([^”]+)”|(\S+))\s+(\d+)/i);
  if (!match) {
    console.log('[handleCreate] Regex failed to match body:', message.body);
    return await safeReply(message, chat, client, 'Usage: !create "Event Title" [Max Slots]');
  }

  const title = (match[1] ?? match[2] ?? match[3] ?? "").trim().substring(0, 100);
  const slotsStr = match[4] ?? "0";
  if (!title || slotsStr === "0") return;
  const slots = Math.min(parseInt(slotsStr), 1000);

  db.createEvent(chat.id._serialized, title, slots, true, userId);
  console.log(`[handleCreate] Created event: "${title}" (${slots} slots)`);
  await safeReply(message, chat, client, `✅ Event "${title}" created!\nSlots: ${slots}\nUse !join to sign up.`);
}

async function handleJoin(message: Message, chat: GroupChat, userId: string, userName: string, client: any, forceWaitlist = false) {
  const event = db.getActiveEvent(chat.id._serialized);
  if (!event) return await safeReply(message, chat, client, 'No active event in this group.');

  const existing = db.getParticipant(event.id, userId);

  if (existing) {
    if (existing.status === 'pending_promotion') {
      db.updateParticipantStatus(event.id, userId, 'joined');
      await safeReply(message, chat, client, `✅ @${contactMention(userId)}, you have confirmed your spot in "${event.title}"!`, { mentions: [userId] });
      return await handleStatus(message, chat, client);
    }
    return await safeReply(message, chat, client, `You are already ${existing.status === 'joined' ? 'signed up' : 'on the waitlist'}.`);
  }

  const participants = db.getParticipants(event.id);
  const joinedCount = participants.filter(p => p.status === 'joined' || p.status === 'pending_promotion').length;

  if (!forceWaitlist && joinedCount < event.slots) {
    db.addParticipant(event.id, userId, userName, 'joined');
    await safeReply(message, chat, client, `✅ @${contactMention(userId)}, you have joined "${event.title}".`, { mentions: [userId] });
    await handleStatus(message, chat, client);
  } else if (event.waitlist_enabled) {
    db.addParticipant(event.id, userId, userName, 'waitlisted');
    await safeReply(message, chat, client, `⏳ @${contactMention(userId)}, you have been added to the waitlist for "${event.title}".`, { mentions: [userId] });
    await handleStatus(message, chat, client);
  } else {
    await safeReply(message, chat, client, 'Sorry, the event is full and waitlist is disabled.');
  }
}

async function handleLeave(message: Message, chat: GroupChat, userId: string, userName: string, client: Client) {
  const event = db.getActiveEvent(chat.id._serialized);
  if (!event) return;

  const participant = db.getParticipant(event.id, userId);
  if (!participant) return await safeReply(message, chat, client, 'You are not signed up for this event.');

  const oldStatus = participant.status;
  db.withdrawParticipant(event.id, userId);
  await safeReply(message, chat, client, `❌ @${contactMention(userId)}, you have withdrawn from "${event.title}".`, { mentions: [userId] });

  if (oldStatus === 'joined' || oldStatus === 'pending_promotion') {
    await promoteNext(chat, event, client);
  }
}

async function promoteNext(chat: GroupChat, event: db.WhatsAppEvent, client: Client) {
  const next = db.getNextInWaitlist(event.id);
  if (next) {
    db.updateParticipantStatus(event.id, next.user_id, 'pending_promotion');
    await client.sendMessage(chat.id._serialized, `🔊 Attention @${next.user_id.split('@')[0]}! A slot opened up for "${event.title}".\nReply with !join to confirm or !leave to decline.`, { mentions: [next.user_id] });
  }
}

async function handleStatus(message: Message, chat: GroupChat, client: Client) {
  const event = db.getActiveEvent(chat.id._serialized);
  if (!event) return await safeReply(message, chat, client, 'No active event.');

  const participants = db.getParticipants(event.id);
  const joined = participants.filter(p => p.status === 'joined' || p.status === 'pending_promotion');
  const waitlisted = participants.filter(p => p.status === 'waitlisted');

  let text = `📊 *${event.title}*\n`;
  text += `Slots: ${joined.length}/${event.slots}\n\n`;
  text += `✅ *Participants:*\n`;
  joined.forEach((p, i) => {
    text += `${i + 1}. ${p.user_name} ${p.status === 'pending_promotion' ? '(Pending Promotion)' : ''}\n`;
  });

  if (waitlisted.length > 0) {
    text += `\n⏳ *Waitlist:*\n`;
    waitlisted.forEach((p, i) => {
      text += `${i + 1}. ${p.user_name}\n`;
    });
  }

  await safeReply(message, chat, client, text);
}

async function safeReply(message: Message, chat: Chat | GroupChat, client: Client, text: string, options = {}) {
  try {
    await message.reply(text, chat.id._serialized, options);
  } catch (err: any) {
    console.warn('Reply failed, falling back to direct sendMessage:', err.message);
    await (await message.getChat()).sendMessage(text, options);
  }
}

function contactMention(userId: string): string {
  return userId.split('@')[0] ?? '';
}
