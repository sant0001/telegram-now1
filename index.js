// index.js - Telegram + NOWPayments minimal bot (Node.js + Express)
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/*
  VARIÁVEIS DE AMBIENTE (defina no Render ou localmente):
  BOT_TOKEN, NOW_API_KEY, NOW_WEBHOOK_SECRET (opcional), CHANNEL_INVITE_LINK, BASE_URL
*/
const BOT_TOKEN = process.env.BOT_TOKEN;
const NOW_API_KEY = process.env.NOW_API_KEY;
const NOW_WEBHOOK_SECRET = process.env.NOW_WEBHOOK_SECRET || '';
const CHANNEL_INVITE_LINK = process.env.CHANNEL_INVITE_LINK || 'https://t.me/joinchat/SEU_INVITE';
const BASE_URL = process.env.BASE_URL || 'https://seu-app.onrender.com';

if (!BOT_TOKEN || !NOW_API_KEY) {
  console.error("Set BOT_TOKEN and NOW_API_KEY in environment variables");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PACKS = {
  pack1: { title: "Pack Fotos + Vídeo", price_eur: 15 },
  pack2: { title: "Assinatura Mensal", price_eur: 45 }
};

// simples memória (substituir por DB em produção)
const invoices = {}; // invoices[invoice_id] = { chat_id, package_id, order_id }

async function sendTelegram(chat_id, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, { chat_id, text, parse_mode: "HTML" }, { timeout: 10000 });
  } catch (err) {
    console.error("Erro ao enviar Telegram:", err?.response?.data || err.message);
  }
}

// endpoint que Telegram vai chamar (setWebhook)
app.post('/telegram_webhook', async (req, res) => {
  const body = req.body;
  if (!body.message) return res.sendStatus(200);
  const chat_id = body.message.chat.id;
  const text = (body.message.text || "").trim();

  if (text === "/start") {
    await sendTelegram(chat_id, "Oi 🔥 confirma que você tem 18+? Responda SIM");
    return res.sendStatus(200);
  }
  if (text.toUpperCase() === "SIM") {
    await sendTelegram(chat_id, "Perfeito ✅. Digite /packs para ver opções.");
    return res.sendStatus(200);
  }
  if (text === "/packs") {
    let s = "Packs disponíveis:\n\n";
    for (const k in PACKS) s += `${k} — ${PACKS[k].title} — €${PACKS[k].price_eur}\n`;
    s += "\nPara comprar digite: /buy pack1";
    await sendTelegram(chat_id, s);
    return res.sendStatus(200);
  }
  if (text.startsWith("/buy")) {
    const parts = text.split(" ");
    const package_id = parts[1] || "pack1";
    const pkg = PACKS[package_id];
    if (!pkg) {
      await sendTelegram(chat_id, "Pacote inválido.");
      return res.sendStatus(200);
    }

    // cria invoice NOWPayments
    try {
      const order_id = `${chat_id}_${package_id}_${Date.now()}`;
      const payload = {
        price_amount: pkg.price_eur,
        price_currency: "EUR",
        pay_currency: "BTC,USDT,USDC",
        order_id,
        order_description: `Compra ${pkg.title}`,
        ipn_callback_url: `${BASE_URL}/webhook/nowpayments`,
        success_url: `${BASE_URL}/success?uid=${chat_id}&pkg=${package_id}`
      };
      const r = await axios.post("https://api.nowpayments.io/v1/invoice", payload, { headers: { "x-api-key": NOW_API_KEY }});
      const invoice_id = r.data.invoice_id || r.data.id || (r.data.data && r.data.data.invoice_id);
      const invoice_url = r.data.invoice_url || r.data.payment_url || (r.data.data && r.data.data.invoice_url);
      if (!invoice_id || !invoice_url) throw new Error("Resposta inesperada NOWPayments: " + JSON.stringify(r.data));
      invoices[invoice_id] = { chat_id, package_id, order_id };
      await sendTelegram(chat_id, `✅ Pedido gerado. Pague aqui: ${invoice_url}`);
    } catch (err) {
      console.error("Erro criando invoice:", err?.response?.data || err.message);
      await sendTelegram(chat_id, "Erro ao gerar pagamento. Tenta novamente.");
    }
    return res.sendStatus(200);
  }

  return res.sendStatus(200);
});

// webhook que NOWPayments vai chamar (IPN)
app.post('/webhook/nowpayments', async (req, res) => {
  const rawBody = JSON.stringify(req.body);
  const headers = req.headers;

  // valida HMAC (se você configurar secret no painel NOWPayments)
  const sig = headers['x-nowpayments-sig'] || headers['x-signature'] || headers['x-nowpayments-signature'];
  if (NOW_WEBHOOK_SECRET && sig) {
    const h = crypto.createHmac('sha512', NOW_WEBHOOK_SECRET).update(rawBody).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig))) {
      console.log("Assinatura inválida");
      return res.sendStatus(400);
    }
  }

  const invoice_id = req.body.invoice_id || req.body.id || (req.body.data && req.body.data.invoice_id);
  const status = (req.body.status || req.body.payment_status || (req.body.data && req.body.data.status) || "").toString().toLowerCase();

  if (!invoice_id) return res.json({ ok: false, error: "missing invoice_id" });

  // buscar mapping
  let info = invoices[invoice_id] || null;
  if (!info && req.body.order_id) {
    const parts = (req.body.order_id || "").split("_");
    if (parts.length >= 2) info = { chat_id: parts[0], package_id: parts[1] };
  }

  if (status === "finished" || status === "confirmed" || status === "paid") {
    if (info && info.chat_id) {
      await sendTelegram(info.chat_id, `Pagamento confirmado ✅\nPack: ${PACKS[info.package_id].title}\nAcesse: ${CHANNEL_INVITE_LINK}\nID: ${invoice_id}`);
    } else {
      console.log("Pago mas sem mapping:", invoice_id, req.body);
    }
  }

  return res.json({ ok: true });
});

app.get('/', (req, res) => res.send('OK'));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server listening on port", port));
