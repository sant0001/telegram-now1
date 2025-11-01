// index.js — Telegram bot com botões + fluxo de packs
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "200kb" }));

/*
  VARIÁVEIS DE AMBIENTE NO RENDER:
  BOT_TOKEN, BASE_URL, (opcional depois: MUNDIPAY_API_KEY, CHANNEL_INVITE_LINK, MUNDIPAY_WEBHOOK_SECRET)
*/

const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;
const MUNDIPAY_API_KEY = process.env.MUNDIPAY_API_KEY || "";
const MUNDIPAY_WEBHOOK_SECRET = process.env.MUNDIPAY_WEBHOOK_SECRET || "";
const CHANNEL_INVITE_LINK = process.env.CHANNEL_INVITE_LINK || "https://t.me/joinchat/SEU_CANAL";

if (!BOT_TOKEN || !BASE_URL) {
  console.error("❌ ERRO: configure BOT_TOKEN e BASE_URL no Render.");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// produtos
const PACKS = {
  pack1: { title: "🔥 Pack Fotos + Vídeo", price_eur: 20 },
  pack2: { title: "💥 Mensal Grupo VIP + Atualizações", price_eur: 45 },
  pack3: { title: "💎 Vitalício + chat exclusivo comigo", price_eur: 80 },
};

// armazena invoiced temporariamente (em produção usar DB)
const orders = {};

// função utilitária
async function sendTelegram(chat_id, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id,
    text,
    parse_mode: "HTML",
  });
}

/* ----------------------------------------------------------
   TELEGRAM MESSAGE HANDLER
-----------------------------------------------------------*/
app.post("/telegram_webhook", async (req, res) => {
  const body = req.body;

  // callback dos botões inline (packs)
  if (body.callback_query) {
    const chat_id = body.callback_query.message.chat.id;
    const pack = body.callback_query.data;

    if (PACKS[pack]) {
      await sendTelegram(
        chat_id,
        "Ótimo amor 😘\nVou gerar o link de pagamento agora ❤️"
      );

      // dispara automaticamente o fluxo /buy
      await sendTelegram(chat_id, `/buy ${pack}`);
    }
    return res.sendStatus(200);
  }

  const msg = body.message;
  if (!msg) return res.sendStatus(200);

  const chat_id = msg.chat.id;
  const text = (msg.text || "").trim();

  /* /start → Botão “SIM 18+” */
  if (text === "/start") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text: "🔥 Oi amor, antes de continuar...\nVocê tem +18?",
      reply_markup: {
        keyboard: [[{ text: "✅ Sim, tenho 18+" }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return res.sendStatus(200);
  }

  /* Quando clica no botão 18+ */
  if (text === "✅ Sim, tenho 18+") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text:
        "Perfeito meu anjo 😏\n" +
        "Vou te apresentar meus serviços agora... vê se não demora rsrs.\n\n" +
        "Posso enviar os valores?",
      reply_markup: {
        keyboard: [[{ text: "💸 Sim, quero os valores" }]],
        resize_keyboard: true,
      },
    });
    return res.sendStatus(200);
  }

  /* Quando clica “Sim, quero os valores” → botões de packs */
  if (text === "💸 Sim, quero os valores") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text: "Esses são meus packs disponíveis 👇",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 Pack Fotos + Vídeo — 20€", callback_data: "pack1" }],
          [{ text: "💥 Mensal Grupo VIP + Atualizações — 45€", callback_data: "pack2" }],
          [{ text: "💎 Vitalício + Chat exclusivo comigo — 80€", callback_data: "pack3" }],
        ],
      },
    });
    return res.sendStatus(200);
  }

  /* ----------------------------------------------------------
    /buy PACK — só executa se Mundipay tiver configurada
  -----------------------------------------------------------*/
  if (text.startsWith("/buy")) {
    const pack_id = text.split(" ")[1];

    if (!PACKS[pack_id]) {
      await sendTelegram(chat_id, "❌ Pacote inválido.");
      return res.sendStatus(200);
    }

    if (!MUNDIPAY_API_KEY) {
      await sendTelegram(
        chat_id,
        "⚠️ Pagamento ainda não está liberado.\n\nEstou finalizando o sistema. Volte mais tarde! 😘"
      );
      return res.sendStatus(200);
    }

    // Mundipay integrada
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
        {
          headers: { Authorization: `Bearer ${MUNDIPAY_API_KEY}` },
        }
      );

      const paymentUrl = resp?.data?.data?.paymentUrl;
      orders[order_id] = { chat_id, pack_id };

      await sendTelegram(chat_id, `✅ Pedido gerado!\n\n➡️ <b>Pague aqui:</b>\n${paymentUrl}`);
    } catch (err) {
      console.error("Erro Mundipay:", err?.response?.data || err);
      await sendTelegram(chat_id, "❌ Erro ao gerar pagamento.");
    }

    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

/* ----------------------------------------------------------
   MUNDIPAY WEBHOOK
-----------------------------------------------------------*/
app.post("/mundipay_webhook", async (req, res) => {
  if (!MUNDIPAY_API_KEY) return res.json({ ok: true });

  const rawBody = JSON.stringify(req.body);
  const sig = req.headers["x-signature"];

  if (MUNDIPAY_WEBHOOK_SECRET && sig) {
    const calc = crypto
      .createHmac("sha256", MUNDIPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (calc !== sig) return res.sendStatus(403);
  }

  const order_id = req.body?.metadata?.order_id;
  const status = req.body?.status;

  if (status === "paid" && orders[order_id]) {
    const { chat_id, pack_id } = orders[order_id];
    await sendTelegram(
      chat_id,
      `✅ Pagamento confirmado!\n\nPack: <b>${PACKS[pack_id].title}</b>\n\n➡️ Acesse:\n${CHANNEL_INVITE_LINK}`
    );
  }

  res.json({ ok: true });
});

/* healthcheck */
app.get("/", (req, res) => res.send("BOT ONLINE ✅"));

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Bot rodando na porta", process.env.PORT)
);
