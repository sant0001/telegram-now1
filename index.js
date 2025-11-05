// ============================
// BOT TELEGRAM HOT (INLINE + STORYTELLING)
// ============================
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// ENV VARS — RENDER
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;
const MEDIA_FILE = process.env.MEDIA_FILE;  // Foto/vídeo padrão (ID ou URL)
const M20 = process.env.M20; // Link Mundipay 20€
const M45 = process.env.M45; // Link Mundipay 45€
const M80 = process.env.M80; // Link Mundipay 80€

axios.defaults.timeout = 8000;

// LEADS EM REMARKETING
const remarketing = {}; // { chat_id: { lastInteraction, sent5, sent15, sent60 } }

// =============== FUNÇÕES DE ENVIO ===============
async function sendMedia(chat_id, caption, buttons = []) {
  const isVideo = MEDIA_FILE.endsWith(".mp4") || MEDIA_FILE.includes("video");
  const endpoint = isVideo ? "sendVideo" : "sendPhoto";

  return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
    chat_id,
    [isVideo ? "video" : "photo"]: MEDIA_FILE,
    caption,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons }
  }).catch(err => console.log("ERRO AO ENVIAR MIDIA:", err.response?.data));
}

// =============== STORYTELLING FLOW ===============
async function etapa_boas_vindas(chat_id) {
  return sendMedia(
    chat_id,
    "Oi amor 😈\n\nEu estava te esperando…\nAntes de continuar, me fala uma coisa:",
    [[{ text: "✅ Tenho +18", callback_data: "idade_ok" }]]
  );
}

async function etapa_historia(chat_id) {
  return sendMedia(
    chat_id,
    "Perfeito 😏\n\nMe chamo **Ana**, tenho 19 anos…\n\nSou daquele tipo que tem cara de santinha, mas um jeito que entrega que eu não sou tão inocente assim… 😇🔥\n\nQuer ver o que eu faço quando fico com vontade?",
    [[{ text: "🔥 Quero ver mais", callback_data: "abrir_desejo" }]]
  );
}

async function etapa_desejo(chat_id) {
  return sendMedia(
    chat_id,
    "Às vezes eu fico pensando se alguém aí poderia aguentar meu ritmo…\n\nNão gosto de enrolação.\nSe você curte uma novinha safadinha e direta, você está no lugar certo 😈",
    [[{ text: "💋 Me mostra os valores", callback_data: "mostrar_valores" }]]
  );
}

async function etapa_valores(chat_id) {
  remarketing[chat_id] = { lastInteraction: Date.now() };

  return sendMedia(
    chat_id,
    "*Escolha seu acesso VIP:*\n\n🔥 Conteúdo exclusivo\n✨ Novinha, natural, zero frescura\n🔒 Total sigilo",
    [
      [{ text: "🔥 Pack Fotos + Vídeo — 20€", callback_data: "pack20" }],
      [{ text: "💥 Grupo VIP Mensal — 45€", callback_data: "pack45" }],
      [{ text: "💎 Vitalício (Chat exclusivo comigo) — 80€", callback_data: "pack80" }]
    ]
  );
}

async function etapa_pagamento(chat_id, link) {
  return sendMedia(
    chat_id,
    "🔐 Última etapa!\n\nClique abaixo para pagar e entrar no VIP 💞",
    [
      [{ text: "💳 Finalizar pagamento", url: link }],
      [{ text: "🔍 Já paguei — verificar", callback_data: "verificar" }]
    ]
  );
}

async function etapa_verificacao(chat_id) {
  return sendMedia(
    chat_id,
    "⏳ Estou verificando aqui…\nSe já tiver sido aprovado você vai entrar no VIP automaticamente 💕"
  );
}

// =============== REMARKETING AUTOMÁTICO ===============
setInterval(() => {
  const agora = Date.now();

  Object.keys(remarketing).forEach(chat_id => {
    const lead = remarketing[chat_id];
    const elapsed = (agora - lead.lastInteraction) / 1000;

    if (!lead.sent5 && elapsed >= 300) {
      lead.sent5 = true;
      sendMedia(chat_id, "👀 Continua aí? Tô pronta pra você…", [
        [{ text: "💋 Ver valores novamente", callback_data: "mostrar_valores" }]
      ]);
    }

    if (!lead.sent15 && elapsed >= 900) {
      lead.sent15 = true;
      sendMedia(chat_id, "🔥 Eu fico mol… digo, ansiosa quando você some 😈", [
        [{ text: "💋 Ver valores novamente", callback_data: "mostrar_valores" }]
      ]);
    }

    if (!lead.sent60 && elapsed >= 3600) {
      delete remarketing[chat_id];
      sendMedia(chat_id, "⏳ Última chamada… depois disso só no próximo VIP", [
        [{ text: "💋 Ver valores novamente", callback_data: "mostrar_valores" }]
      ]);
    }
  });

}, 4000);

// =============== WEBHOOK DE MENSAGENS ===============
app.post("/telegram_webhook", (req, res) => {
  res.sendStatus(200);

  const msg = req.body.message;
  const callback = req.body.callback_query;

  if (msg) return etapa_boas_vindas(msg.chat.id);

  if (callback) {
    const chat_id = callback.message.chat.id;
    const data = callback.data;

    if (data === "idade_ok") return etapa_historia(chat_id);
    if (data === "abrir_desejo") return etapa_desejo(chat_id);
    if (data === "mostrar_valores") return etapa_valores(chat_id);

    if (data === "pack20") return etapa_pagamento(chat_id, M20);
    if (data === "pack45") return etapa_pagamento(chat_id, M45);
    if (data === "pack80") return etapa_pagamento(chat_id, M80);

    if (data === "verificar") return etapa_verificacao(chat_id);
  }
});

// =============== CONFIGURA WEBHOOK RENDER ===============
async function setupWebhook() {
  await axios.get(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/telegram_webhook`
  );
}

app.get("/", (req, res) => res.send("🔥 BOT ATIVO E RODANDO"));

app.listen(process.env.PORT || 10000, async () => {
  console.log("✅ BOT ATIVO NA RENDER");
  await setupWebhook();
});
