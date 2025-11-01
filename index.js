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

const orders = {};

async function sendText(chat_id, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id,
    text,
    parse_mode: "HTML",
  });
}

app.post("/telegram_webhook", async (req, res) => {
  const body = req.body;

  // callback dos botões inline (packs)
  if (body.callback_query) {
    const chat_id = body.callback_query.message.chat.id;
    const pack = body.callback_query.data;

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

  /* ===================================================
      FUNÇÃO PARA GUIAR SE TENTAR DIGITAR QUALQUER COISA
     =================================================== */
  const forceButtons = async () => {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text: "Amor, só clicar nos botões tá? 😘\nAssim eu te guio direitinho.",
      reply_markup: {
        keyboard: [[{ text: "✅ Sim, tenho 18+" }]],
        resize_keyboard: true,
      },
    });
  };

  /* ===================================================
      /START — BOTÕES
     =================================================== */
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

  /* ===================================================
      18+ CONFIRMADO
     =================================================== */
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

  /* ===================================================
      MOSTRAR PACKS
     =================================================== */
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

  /* ===================================================
     /BUY (quando clicar em um pack)
     =================================================== */
  if (text.startsWith("/buy")) {
    const pack_id = text.split(" ")[1];

    if (!PACKS[pack_id]) {
      await sendText(chat_id, "❌ Pacote inválido.");
      return res.sendStatus(200);
    }

    if (!MUNDIPAY_API_KEY) {
      await sendText(
        chat_id,
        "⚠️ O pagamento ainda não está liberado.\nEstou finalizando o sistema, volta daqui a pouquinho 😘"
      );
      return res.sendStatus(200);
    }

    try {
      const order_id = `${chat_id}_${pack_id}_${Date.now()}`;
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
      orders[order_id] = { chat_id, pack_id };

      await sendText(chat_id, `✅ Pedido gerado!\n\n➡️ Pague aqui:\n${paymentUrl}`);

    } catch (err) {
      await sendText(chat_id, "❌ Erro ao gerar pagamento.");
    }

    return res.sendStatus(200);
  }

  /* ===================================================
     QUALQUER TEXTO QUE O CLIENTE DIGITAR SEM USAR BOTÃO
     =================================================== */
  await forceButtons();
  return res.sendStatus(200);
});

/* HEALTHCHECK */
app.get("/", (req, res) => res.send("BOT ONLINE ✅"));

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Bot rodando na porta", process.env.PORT)
);
