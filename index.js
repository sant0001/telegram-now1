const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "200kb" }));

// ENV VARS
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;
const MEDIA_FILE = process.env.MEDIA_FILE; // FOTO OU VÍDEO PADRÃO

if (!BOT_TOKEN || !BASE_URL) {
  console.error("❌ BOT_TOKEN ou BASE_URL não configurados.");
  throw new Error("BOT_TOKEN ou BASE_URL ausentes");
}

axios.defaults.timeout = 8000;

// -----------------------------
// LEADS PARA REMARKETING (só após ver valores)
// -----------------------------
const remarketing = {}; // chat_id: timestamps

async function followUp(chat_id, stage) {
  const messages = {
    1: "👀 Ainda aí? Posso te mostrar os valores novamente.",
    2: "🔥 Continuo aqui... pronta pra você 😈",
    3: "⏳ Última chamada... se quiser continuar, clique abaixo 👇"
  };

  await sendMediaWithButtons(chat_id, MEDIA_FILE, messages[stage], followMenu());
}

// dispara remarketing
setInterval(() => {
  const now = Date.now();
  Object.keys(remarketing).forEach(chat_id => {
    const data = remarketing[chat_id];
    const elapsed = (now - data.lastInteraction) / 1000;

    if (!data.sent5 && elapsed >= 300) {
      data.sent5 = true;
      followUp(chat_id, 1);
    }

    if (!data.sent15 && elapsed >= 900) {
      data.sent15 = true;
      followUp(chat_id, 2);
    }

    if (!data.sent60 && elapsed >= 3600) {
      delete remarketing[chat_id];
      followUp(chat_id, 3);
    }
  });
}, 3000);

// -----------------------------
// FUNÇÕES DE ENVIO (sempre com mídia antes da mensagem)
// -----------------------------
async function sendMediaWithButtons(chat_id, media, caption, menu) {
  // detecta se é vídeo ou imagem pela extensão / tipo
  const isVideo = media.endsWith(".mp4") || media.includes("BAAC") || media.includes("video");

  const endpoint = isVideo ? "sendVideo" : "sendPhoto";

  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
    chat_id,
    [isVideo ? "video" : "photo"]: media,
    caption,
    parse_mode: "Markdown",
    reply_markup: menu
  });
}

// MENU FIXO
function mainMenu() {
  return {
    keyboard: [
      [{ text: "🔥 Conteúdos" }, { text: "💰 Valores" }],
      [{ text: "🛠 Suporte" }, { text: "❤️ Sobre mim" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

// MENU FOLLOW (remarketing)
function followMenu() {
  return {
    keyboard: [[{ text: "💰 Ver valores novamente" }]],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

// -----------------------------
// FUNIL DE MENSAGENS
// -----------------------------
async function sendStart(chat_id) {
  return sendMediaWithButtons(
    chat_id,
    MEDIA_FILE,
    "🌸 Oii... que bom te ver aqui 😏\nClique em */start* para liberar o acesso.",
    mainMenu()
  );
}

async function sendSobre(chat_id) {
  return sendMediaWithButtons(
    chat_id,
    MEDIA_FILE,
    "Eu sou a Ana 😇\nProvocante, divertida e curiosa... você vai gostar 😏",
    mainMenu()
  );
}

async function sendValores(chat_id) {
  remarketing[chat_id] = { lastInteraction: Date.now() }; // só aqui entra no remarketing

  return sendMediaWithButtons(
    chat_id,
    MEDIA_FILE,
    "*💰 PLANOS DISPONÍVEIS*\n\n🔥 Conteúdo exclusivo\n🔒 Privado e sigiloso\n\nEscolha abaixo 👇",
    mainMenu()
  );
}

// -----------------------------
// RECEBENDO MENSAGENS
// -----------------------------
app.post("/telegram_webhook", async (req, res) => {
  res.sendStatus(200);

  const msg = req.body.message;
  if (!msg) return;
  const chat_id = msg.chat.id;
  const text = msg.text?.toLowerCase() || "";

  if (text === "/start") return sendSobre(chat_id);
  if (text.includes("conteúdo")) return sendSobre(chat_id);
  if (text.includes("valores")) return sendValores(chat_id);
  if (text.includes("suporte")) return sendMediaWithButtons(chat_id, MEDIA_FILE, "Me chame no suporte: @seuuser", mainMenu());
  if (text.includes("sobre")) return sendSobre(chat_id);
});

// -----------------------------
// HEALTHCHECK + WEBHOOK AUTO
// -----------------------------
app.get("/health", (req, res) => res.status(200).send("OK ✅"));

async function setupWebhook() {
  await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/telegram_webhook`);
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log("✅ Bot rodando e webhook configurado!");
  await setupWebhook();
});
