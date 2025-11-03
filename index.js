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

axios.defaults.timeout = 8000;

// -----------------------------
// LEADS / FOLLOW UP
// -----------------------------
const leads = {}; // chat_id: { lastInteraction }

// follow up messages
async function followUp(chat_id, stage) {
  const messages = {
    5: "👀 Ainda aí? Se quiser, posso te mostrar meus conteúdos novamente…",
    15: "🔥 Eu ainda estou aqui… pronta pra você 😈",
    60: "⏳ Só vou te avisar porque sou boazinha… as vagas estão acabando."
  };

  return sendButtonsFollow(chat_id, messages[stage]);
}

// Interval do remarketing
setInterval(() => {
  const now = Date.now();
  Object.keys(leads).forEach(chat_id => {
    const lead = leads[chat_id];
    const elapsed = (now - lead.lastInteraction) / 1000;

    if (!lead.sent5 && elapsed >= 300) {
      lead.sent5 = true;
      followUp(chat_id, 5);
    }

    if (!lead.sent15 && elapsed >= 900) {
      lead.sent15 = true;
      followUp(chat_id, 15);
    }

    if (!lead.sent60 && elapsed >= 3600) {
      delete leads[chat_id];
      followUp(chat_id, 60);
    }
  });
}, 5000);

// -----------------------------
// HEALTH CHECK PARA A RENDER
// -----------------------------
app.get("/health", (req, res) => res.status(200).send("OK ✅"));

// -----------------------------
// WEBHOOK AUTOMÁTICO
// -----------------------------
async function setupWebhook() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/telegram_webhook`;
    await axios.get(url);
    console.log("✅ Webhook configurado");
  } catch (err) {
    console.log("❌ Erro webhook:", err.message);
  }
}

// -----------------------------
// RECEBENDO MENSAGENS DO TELEGRAM
// -----------------------------
app.post("/telegram_webhook", async (req, res) => {
  res.sendStatus(200);

  const msg = req.body.message;
  if (!msg) return;

  const chat_id = msg.chat.id;
  const text = msg.text?.toLowerCase() || "";

  // registra interação p/ remarketing
  leads[chat_id] = leads[chat_id] || {};
  leads[chat_id].lastInteraction = Date.now();

  if (text === "/start") {
    return sendAgeButton(chat_id);
  }

  // ETAPA 2 — confirmação de maior de idade
  if (text.includes("✅")) {
    return sendIntro(chat_id);
  }

  // ETAPA 3 — quer ver mais
  if (text.includes("quero ver mais")) {
    return sendPackOptions(chat_id);
  }

  // follow-up "ver valores novamente"
  if (text.includes("ver valores")) {
    return sendPackOptions(chat_id);
  }
});

// -----------------------------
// FUNÇÕES DE MENSAGEM
// -----------------------------
async function sendAgeButton(chat_id) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text: "🔥 Oi amor, antes de continuar…\nVocê tem **18+**?",
    reply_markup: {
      keyboard: [[{ text: "✅ Sim, tenho 18+" }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

async function sendIntro(chat_id) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text:
      "Perfeito 😏\n\n" +
      "Meu nome é *Ana*, eu sou **atrevida**, curiosa… e gosto de provocar.\n" +
      "Eu não fico mandando fotinha boba. Eu gosto de **causar desejo**.\n\n" +
      "Quer que eu te mostre o que eu faço no privado? 😈",
    reply_markup: {
      keyboard: [[{ text: "🔥 Quero ver mais 😈" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    }
  });
}

async function sendPackOptions(chat_id) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text: "Agora escolhe uma opção, amor 😈",
    reply_markup: {
      keyboard: [
        [{ text: "🔥 Pack Fotos + Vídeo (20€)" }],
        [{ text: "💥 Grupo VIP Mensal (45€)" }],
        [{ text: "💎 Vitalício + Chat exclusivo (80€)" }]
      ],
      resize_keyboard: true
    }
  });
}

async function sendButtonsFollow(chat_id, text) {
  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    chat_id,
    text,
    reply_markup: {
      keyboard: [[{ text: "👀 Ver valores novamente" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    }
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
