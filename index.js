// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "200kb" }));

const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;

if (!BOT_TOKEN || !BASE_URL) {
  console.error("❌ BOT_TOKEN ou BASE_URL não configurados.");
  throw new Error("BOT_TOKEN ou BASE_URL ausentes");
}

// timeout para evitar travamento
axios.defaults.timeout = 8000;

// -----------------------------
// FOLLOW UP AUTOMÁTICO (MEMÓRIA)
// -----------------------------
const leads = {}; // { chat_id: timestamp }

// função de follow-up
async function followUp(chat_id, time) {
  try {
    const message =
      time === 5
        ? "👀 Ainda aí? Se quiser, posso te mostrar meus conteúdos disponíveis."
        : time === 15
        ? "🔥 Só passando pra lembrar: ainda tenho vagas abertas."
        : "⏳ Última mensagem: se quiser continuar, é só me chamar.";

    await sendMessage(chat_id, message);
  } catch (err) {
    console.error(err);
  }
}

// cron de remarketing
setInterval(() => {
  const now = Date.now();
  for (const chat_id in leads) {
    const elapsed = (now - leads[chat_id]) / 1000; // segundos

    if (elapsed >= 3600) {
      followUp(chat_id, 60);
      delete leads[chat_id];
    } else if (elapsed >= 900 && !leads[chat_id + "_15"]) {
      followUp(chat_id, 15);
      leads[chat_id + "_15"] = true;
    } else if (elapsed >= 300 && !leads[chat_id + "_5"]) {
      followUp(chat_id, 5);
      leads[chat_id + "_5"] = true;
    }
  }
}, 5000); // roda a cada 5s

// -----------------------------
// HEALTHCHECK - Render usa isso
// -----------------------------
app.get("/health", (req, res) => {
  res.status(200).send("OK ✅");
});

// -----------------------------
// WEBHOOK AUTOMÁTICO
// -----------------------------
async function setupWebhook() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/telegram_webhook`;
    await axios.get(url);
    console.log("✅ Webhook configurado");
  } catch (err) {
    console.log("❌ erro webhook:", err.message);
  }
}

// -----------------------------
// RECEBENDO MENSAGENS
// -----------------------------
app.post("/telegram_webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.message;
    if (!msg) return;

    const chat_id = msg.chat.id;
    const text = msg.text?.toLowerCase() || "";

    // marca para follow up
    leads[chat_id] = Date.now();

    if (text === "/start") {
      return sendButtons(chat_id, "🔥 Antes de continuar, você tem +18?");
    }

    if (text.includes("✅")) {
      return sendPackOptions(chat_id);
    }

    if (text.includes("sim")) {
      return sendPackOptions(chat_id);
    }

  } catch (err) {
    console.error("Erro no webhook:", err);
  }
});

// -----------------------------
// FUNÇÕES DE MENSAGEM
// -----------------------------
async function sendButtons(chat_id, text) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text,
    reply_markup: {
      keyboard: [[{ text: "✅ Sim, tenho 18+" }], [{ text: "❌ Não" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendPackOptions(chat_id) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text: "Perfeito 😏 Agora escolha uma opção:",
    reply_markup: {
      keyboard: [
        [{ text: "🔥 Pack Fotos + Vídeo (20€)" }],
        [{ text: "💥 Grupo VIP Mensal (45€)" }],
        [{ text: "💎 Vitalício + Chat exclusivo (80€)" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });
}

async function sendMessage(chat_id, text) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text,
  });
}

// -----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log("🚀 Bot rodando!");
  await setupWebhook();
});
