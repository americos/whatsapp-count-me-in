import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import * as qrcode from 'qrcode-terminal';
import { handleCommand } from './commands.js';
import type { Message } from 'whatsapp-web.js';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
    }
});

client.on('qr', (qr: string) => {
    console.log('Scan this QR code with your WhatsApp app:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp Bot is ready!');
});

client.on('message', async (msg: Message) => {
    try {
        await handleCommand(msg, client);
    } catch (err) {
        console.error('Error handling message:', err);
    }
});

client.initialize();
