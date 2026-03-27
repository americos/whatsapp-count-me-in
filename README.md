# WhatsApp Group Event Bot

A simple WhatsApp bot for managing event sign-ups and waitlists in groups.

## Features
- **Group Admin ONLY**: Only group admins can create new events.
- **Waitlist Support**: Automatically manage waitlists when an event is full.
- **Automatic Promotion**: When someone leaves, the first person on the waitlist is notified to confirm their spot.
- **Active State**: Only one active event can be managed per group at a time.

## Commands
- `!create "Title" Slots "Deadline"`: Create a new event (Admins only).
- `!cancel`: Deactivate the current active event (Admins only).
- `!join`: Sign up for the event or join the waitlist.
- `!leave`: Withdraw from the event or waitlist.
- `!status`: Show the current list of participants and waitlist.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the bot:
   ```bash
   npm start
   ```

3. Scan the QR code displayed in the terminal with your WhatsApp mobile app (Linked Devices).

4. Add the bot (your phone number) to a group and start managing events!

## Technology
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [qrcode-terminal](https://github.com/gtanner/qrcode-terminal)
