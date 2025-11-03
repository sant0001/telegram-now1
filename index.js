// index.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '200kb' }));

// ------------------------
// ENV VARS (Render Dashboard)
// BOT_TOKEN
// BASE_URL = https://telegram-now1-1.onrender.com
// ------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;

if (!BOT_TOKEN || !BASE_URL) {
  console.error("❌ BOT_TOKEN ou BASE_URL não configurados.");
  throw new Error("Variáveis ausentes");
}

// timeout para evitar travar container
axios.defaults.timeout = 8000;

// ✅ rota para saúde do servidor (Render usa isso)
app.get("/health", (req, res) => {
  res.status(200).send("OK ✅");
});

// ✅ webhook automático ao iniciar o servidor
async function setupWebhook() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/telegram_webhook`;
    const res = await axios.get(url);
    console.log("✅ Webhook conectado:", res.data);
  } catch (err) {
    console.error("❌ Erro ao configurar webhook:", err.message);
  }
}

// ------------------------
// RECEBENDO MENSAGENS DO TELEGRAM
// ------------------------
app.post("/telegram_webhook", async (req, res) => {
  res.sendStatus(200); // responde rápido pro Telegram

  try {
    const msg = req.body.message;
    if (!msg) return;

    const chat_id = msg.chat.id;
    const text = msg.text?.toLowerCase() || "";

    // mensagem inicial
    if (text === "/start" || text === "oi" || text.includes("ola")) {
      return sendButtons(chat_id, "🔥 Oi amor, antes de continuar...\nVocê tem +18?");
    }

  } catch (err) {
    console.error("Erro no webhook:", err);
  }
});

// ------------------------
// FUNÇÃO PARA ENVIAR BOTÕES
// ------------------------
async function sendButtons(chat_id, txt) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text: txt,
    reply_markup: {
      keyboard: [
        [{ text: "✅ Sim, tenho 18+" }],
        [{ text: "❌ Não" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

// ------------------------
// INICIAR SERVIDOR
// ------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log("🚀 Servidor rodando na porta:", PORT);
  await setupWebhook(); // webhook automático
});
