// Tambahkan fallback jika globalThis.crypto belum ada (khusus Node 18 ke bawah)
if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
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

    const fs = require('fs');
    const path = require('path');
    const qrcode = require('qrcode');

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📌 QR Terdeteksi. Mengenerate file PNG...");
            // Simpan QR ke file
            const qrPath = path.join(__dirname, 'qr.png');
            await qrcode.toFile(qrPath, qr);

            console.log("✅ QR Code berhasil dibuat: qr.png");
            // Kirim instruksi ke user
            console.log("⚠️ Unduh QR ini dari file output atau tampilkan di server lokal.");
        }

        if (connection === 'close') {
            console.log('❌ Terputus.');
        } else if (connection === 'open') {
            console.log('✅ Bot sudah login!');
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
