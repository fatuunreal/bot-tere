// Tambahkan polyfill untuk crypto
if (globalThis.crypto === undefined) {
    globalThis.crypto = require('node-webcrypto-ossl');
  }

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const { Boom } = require('@hapi/boom');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state
    });

    // Tampilkan QR jika ada
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log("🔍 Scan QR ini dengan WhatsApp:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("🔁 Terputus. Mencoba reconnect...");
                startBot();
            } else {
                console.log("❌ Logout permanen. Jalankan ulang bot dan scan QR lagi.");
            }
        } else if (connection === 'open') {
            console.log("✅ Bot terhubung ke WhatsApp!");
        }
    });

    // Simpan sesi login saat diperbarui
    sock.ev.on('creds.update', saveCreds);

    // ✅ Forward semua pesan masuk secara asli
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { forward: msg });
            console.log('✅ Pesan diforward secara asli');
        } catch (err) {
            console.error('❌ Gagal forward:', err);
        }
    });
}

startBot();
