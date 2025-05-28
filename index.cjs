// Tambahkan fallback untuk Node 18 agar ada crypto.subtle
if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
}

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode'); // hanya gunakan ini, bukan qrcode-terminal

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrPath = path.join(__dirname, 'qr.png');
            try {
                await qrcode.toFile(qrPath, qr);
                console.log("✅ QR Code berhasil dibuat di:", qrPath);
            } catch (err) {
                console.error("❌ Gagal membuat QR:", err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("🔄 Koneksi terputus. Reconnecting...");
                startBot();
            } else {
                console.log("❌ Logout permanen. Harus scan ulang.");
            }
        }

        if (connection === 'open') {
            console.log("✅ Bot sudah login ke WhatsApp!");
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { forward: msg });
            console.log("📨 Pesan berhasil diforward!");
        } catch (err) {
            console.error("❌ Gagal forward pesan:", err);
        }
    });
}

startBot();
