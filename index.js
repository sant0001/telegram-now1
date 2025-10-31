// index.js — Telegram bot (MundiPay opcional)
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "200kb" }));

/*
  VARIÁVEIS DE AMBIENTE (defina no Render):
  BOT_TOKEN, BASE_URL, (opcional depois: MUNDIPAY_API_KEY, MUNDIPAY_WEBHOOK_SECRET, CHANNEL_INVITE_LINK)
*/

const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;

// Mundipay (opcional, você vai colocar depois)
const MUNDIPAY_API_KEY = process.env.MUNDIPAY_API_KEY || "";
const MUNDIPAY_WEBHOOK_SECRET = process.env.MUNDIPAY_WEBHOOK_SECRET || "";
const CHANNEL_INVITE_LINK = process.env.CHANNEL_INVITE_LINK || "https://t.me/joinchat/SEU_CANAL";

// Verifica apenas requisitos mínimos
if (!BOT_TOKEN || !BASE_URL) {
  console.error("❌ ERRO: configure BOT_TOKEN e BASE_URL no Render.");
  process.exit(1);
}

// Se não existir API Key da MundiPay, o bot avisa mas não trava
if (!MUNDIPAY_API_KEY) {
  console.warn("⚠️ MUNDIPAY_API_KEY não configurada — pagamentos desativados temporariamente.");
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Packs (produtos)
const PACKS = {
  pack1: { title: "Pack Fotos + Vídeo 🔥", price_eur: 15 },
  pack2: { title: "Assinatura VIP Mensal 💎", price_eur: 45 },
};

// Armazena ordens temporariamente (ideal usar DB no futuro)
const orders = {}; // orders[order_id] = { chat_id, package_id }

async function sendTelegram(chat_id, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text,
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error("Erro enviando mensagem:", err?.response?.data || err);
  }
}

/* ------------------------ TELEGRAM WEBHOOK ------------------------ */
app.post("/telegram_webhook", async (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  const chat_id = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start") {
    await sendTelegram(
      chat_id,
      "🔥 Confirma que você tem 18+?\n\n<b>Responda: SIM</b>"
    );
    return res.sendStatus(200);
  }

  if (text.toUpperCase() === "SIM") {
    await sendTelegram(
      chat_id,
      "✅ Perfeito.\nDigite <b>/packs</b> para ver os conteúdos disponíveis."
    );
    return res.sendStatus(200);
  }

  if (text === "/packs") {
    let list = "🔥 <b>Conteúdos disponíveis:</b>\n\n";
    Object.keys(PACKS).forEach((key) => {
      list += `/${key} — ${PACKS[key].title} — €${PACKS[key].price_eur}\n`;
    });
    list += `\nPara comprar, envie: <b>/buy pack1</b>`;
    await sendTelegram(chat_id, list);
    return res.sendStatus(200);
  }

  if (text.startsWith("/buy")) {
    const parts = text.split(" ");
    const package_id = parts[1] || "pack1";
    const pkg = PACKS[package_id];

    if (!pkg) {
      await sendTelegram(chat_id, "❌ Pacote inválido.");
      return res.sendStatus(200);
    }

    // SE A MUNDIPAY NÃO ESTIVER CONFIGURADA:
    if (!MUNDIPAY_API_KEY) {
      await sendTelegram(
        chat_id,
        "⚠️ Pagamento ainda não está liberado.\n\nEstou finalizando o sistema. Volte mais tarde! 😘"
      );
      return res.sendStatus(200);
    }

    // Se quiser ativar depois, o código de pagamento já fica pronto aqui ↓↓↓
    try {
      const order_id = `${chat_id}_${package_id}_${Date.now()}`;

      const payload = {
        amount: pkg.price_eur,
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
      orders[order_id] = { chat_id, package_id };

      await sendTelegram(chat_id, `✅ Pedido gerado!\n\n➡️ <b>Pague aqui:</b>\n${paymentUrl}`);
    } catch (err) {
      console.error("Erro MundiPay:", err?.response?.data || err);
      await sendTelegram(chat_id, "❌ Erro ao gerar pagamento.");
    }

    return res.sendStatus(200);
  }

  return res.sendStatus(200);
});

/* ------------------------ WEBHOOK MUNDIPAY (opcional) ------------------------ */
app.post("/mundipay_webhook", async (req, res) => {
  if (!MUNDIPAY_API_KEY) return res.json({ ok: true }); // ignora enquanto não configurado

  const body = req.body;

  if (MUNDIPAY_WEBHOOK_SECRET && req.headers["x-signature"]) {
    const calc = crypto
      .createHmac("sha256", MUNDIPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest("hex");

    if (calc !== req.headers["x-signature"]) {
      return res.sendStatus(403);
    }
  }

  const order_id = body?.metadata?.order_id;
  const status = body?.status;

  if (!order_id) return res.json({ ok: true });

  const info = orders[order_id];

  if (status === "paid" && info?.chat_id) {
    await sendTelegram(
      info.chat_id,
      `✅ Pagamento confirmado!\n\n➡️ Acesse:\n${CHANNEL_INVITE_LINK}`
    );
  }

  return res.json({ ok: true });
});

/* ------------------------ HEALTHCHECK ------------------------ */
app.get("/", (req, res) => res.send("BOT ONLINE ✅"));

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Bot rodando na porta", process.env.PORT)
);
