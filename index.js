// index.js — Telegram bot com follow-up automático + botões + venda
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "200kb" }));

/*
 VARIÁVEIS NO RENDER:
 BOT_TOKEN, BASE_URL
 (opcionais depois: MUNDIPAY_API_KEY, CHANNEL_INVITE_LINK, MUNDIPAY_WEBHOOK_SECRET)
*/
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;
const MUNDIPAY_API_KEY = process.env.MUNDIPAY_API_KEY || "";
const MUNDIPAY_WEBHOOK_SECRET = process.env.MUNDIPAY_WEBHOOK_SECRET || "";
const CHANNEL_INVITE_LINK = process.env.CHANNEL_INVITE_LINK || "https://t.me/joinchat/SEU_CANAL";

if (!BOT_TOKEN || !BASE_URL) {
  console.error("❌ Configure BOT_TOKEN e BASE_URL no Render.");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PACKS = {
  pack1: { title: "🔥 Pack Fotos + Vídeo", price_eur: 20 },
  pack2: { title: "💥 Grupo VIP + Atualizações", price_eur: 45 },
  pack3: { title: "💎 Vitalício + chat exclusivo comigo", price_eur: 80 },
};

// memória de interação do lead
let lastActivity = {};
let followSent = {}; // evita enviar repetido

// função utilitária
async function sendText(chat_id, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id,
    text,
    parse_mode: "HTML",
  });
}

// registra última atividade sempre que o lead interagir
function updateActivity(chat_id) {
  lastActivity[chat_id] = Date.now();
  followSent[chat_id] = { _5min: false, _15min: false, _1h: false };
}

/* =====================================================
   WEBHOOK TELEGRAM (mensagens + botões)
===================================================== */
app.post("/telegram_webhook", async (req, res) => {
  const body = req.body;

  // BOTÕES INLINE (packs)
  if (body.callback_query) {
    const chat_id = body.callback_query.message.chat.id;
    const pack = body.callback_query.data;
    updateActivity(chat_id);

    if (PACKS[pack]) {
      await sendText(chat_id, "Ui… gostei da sua escolha 😘\nVou gerar o link de pagamento agora ❤️");
      await sendText(chat_id, `/buy ${pack}`);
    }

    return res.sendStatus(200);
  }

  const msg = body.message;
  if (!msg) return res.sendStatus(200);

  const text = (msg.text || "").trim();
  const chat_id = msg.chat.id;

  updateActivity(chat_id);

  if (text === "/start") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text: "🔥 E aí amor...\nAntes de qualquer coisa...\nVocê tem +18?",
      reply_markup: {
        keyboard: [[{ text: "✅ Sim, tenho 18+" }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return res.sendStatus(200);
  }

  if (text === "✅ Sim, tenho 18+") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text:
        "Hmmm perfeito 😏\n" +
        "Eu sou a <b>novinha mais safadinha daqui</b>...\n" +
        "Meus conteúdos são <b>EXCLUSIVOS</b>, nada vai pra feed.\n\n" +
        "Quer que eu te mostre meus valores? 😘",
      reply_markup: {
        keyboard: [[{ text: "💸 Sim, quero os valores" }]],
        resize_keyboard: true,
      },
    });
    return res.sendStatus(200);
  }

  if (text === "💸 Sim, quero os valores") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text: "Escolhe com calma amor 😈",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 Pack Fotos + Vídeo — 20€", callback_data: "pack1" }],
          [{ text: "💥 Grupo VIP + Atualizações — 45€", callback_data: "pack2" }],
          [{ text: "💎 Vitalício + Chat exclusivo — 80€", callback_data: "pack3" }],
        ],
      },
    });
    return res.sendStatus(200);
  }

  if (text.startsWith("/buy")) {
    const pack_id = text.split(" ")[1];

    if (!MUNDIPAY_API_KEY) {
      await sendText(
        chat_id,
        "⚠️ O pagamento ainda não está liberado.\nEstou finalizando o sistema, volta daqui a pouquinho 😘"
      );
      return res.sendStatus(200);
    }

    try {
      const order_id = `${chat_id}_${pack_id}_${Date.now()}`;
      orders[order_id] = { chat_id, pack_id };

      const payload = {
        amount: PACKS[pack_id].price_eur,
        currency: "EUR",
        paymentMethod: "crypto",
        metadata: { order_id },
        redirectUrl: `${BASE_URL}/success?uid=${chat_id}`,
        webhookUrl: `${BASE_URL}/mundipay_webhook`,
      };

      const resp = await axios.post(
        "https://api.mundipay.io/api/v1/payment/create",
        payload,
        { headers: { Authorization: `Bearer ${MUNDIPAY_API_KEY}` } }
      );

      const paymentUrl = resp?.data?.data?.paymentUrl;
      await sendText(chat_id, `✅ Pedido gerado!\n\n➡️ <b>Pague aqui:</b>\n${paymentUrl}`);

    } catch (err) {
      await sendText(chat_id, "❌ Erro ao gerar pagamento.");
    }

    return res.sendStatus(200);
  }

  // fallback — se o lead DIGITAR ao invés de clicar
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id,
    text: "Amor, só clicar nos botões tá? 😘",
  });

  return res.sendStatus(200);
});

/* =====================================================
   FOLLOW-UP AUTOMÁTICO (5min → 15min → 1h)
===================================================== */
setInterval(async () => {
  const now = Date.now();

  for (const chat_id in lastActivity) {
    const inactivity = (now - lastActivity[chat_id]) / 1000; // segundos

    if (inactivity >= 300 && !followSent[chat_id]._5min) {
      followSent[chat_id]._5min = true;
      await sendText(
        chat_id,
        "😏 Tô aqui pensando em você… já escolheu seu pack?"
      );
    }

    if (inactivity >= 900 && !followSent[chat_id]._15min) {
      followSent[chat_id]._15min = true;
      await sendText(
        chat_id,
        "👀 Eu ainda estou aqui… imaginando o que você vai querer ver primeiro…"
      );
    }

    if (inactivity >= 3600 && !followSent[chat_id]._1h) {
      followSent[chat_id]._1h = true;
      await sendText(
        chat_id,
        "💋 Última chance amor… depois disso vou focar em quem realmente quer 😘"
      );

      // remove da memória
      delete lastActivity[chat_id];
      delete followSent[chat_id];
    }
  }
}, 60 * 1000); // roda a cada 1 min

/* HEALTHCHECK */
app.get("/", (req, res) => res.send("BOT ONLINE ✅"));

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Bot rodando na porta", process.env.PORT)
);
