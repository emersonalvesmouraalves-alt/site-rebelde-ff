const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_FILENAME = 'usos_bot.json';

function ghHeaders() {
  return {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
  };
}

async function findGistId() {
  const res = await fetch('https://api.github.com/gists', { headers: ghHeaders() });
  const gists = await res.json();
  const found = gists.find(g => g.files && g.files[GIST_FILENAME]);
  if (!found) throw new Error('Gist nao encontrado');
  return found.id;
}

async function loadUsos(gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers: ghHeaders() });
  const data = await res.json();
  const content = data.files[GIST_FILENAME].content;
  return JSON.parse(content);
}

async function saveUsos(gistId, usos) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
    body: JSON.stringify({
      files: { [GIST_FILENAME]: { content: JSON.stringify(usos) } },
    }),
  });
}

async function notificarDono(texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.DONO_TELEGRAM_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
    });
  } catch (e) {}
}

async function enviarLike(uid) {
  const url = `https://Like200.soyxapasse.com.br/api/v1/enviar?key=${process.env.FREEFIRE_API_KEY}&uid=${uid}&region=BR`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    return { sucesso: false, erro: String(err) };
  }
}

module.exports = async (req, res) => {
  const paymentId = req.query['data.id'] || (req.body && req.body.data && req.body.data.id);

  if (!paymentId) {
    return res.status(200).json({ ok: true });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

  try {
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const payment = await paymentRes.json();

    if (payment.status !== 'approved') {
      return res.status(200).json({ ok: true });
    }

    const meta = payment.metadata || {};
    const uid = meta.uid;
    const dias = meta.dias;
    const nome = meta.nome || 'Nao informado';
    const whatsapp = meta.whatsapp || 'Nao informado';
    const valor = payment.transaction_amount;

    if (!uid || !dias) {
      return res.status(200).json({ ok: true });
    }

    const gistId = await findGistId();
    const usos = await loadUsos(gistId);

    usos.pagamentos_processados = usos.pagamentos_processados || [];
    if (usos.pagamentos_processados.includes(String(paymentId))) {
      return res.status(200).json({ ok: true, ja_processado: true });
    }

    usos.auto_data = usos.auto_data || {};
    const existente = usos.auto_data[uid];
    const diasAtuais = (existente && existente.dias_restantes) || 0;

    usos.auto_data[uid] = {
      chat_id: (existente && existente.chat_id) || 0,
      dias_restantes: diasAtuais + Number(dias),
      criado_em: new Date().toISOString().slice(0, 10),
    };

    usos.pagamentos_processados.push(String(paymentId));

    await saveUsos(gistId, usos);
    await enviarLike(uid);

    const textoAviso = `💰 NOVA VENDA CONFIRMADA\n\nNome: ${nome}\nWhatsApp: ${whatsapp}\nUID: ${uid}\nValor: R$ ${valor}\nDias de auto-like: ${dias}\nPayment ID: ${paymentId}`;
    await notificarDono(textoAviso);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro no webhook:', err);
    return res.status(200).json({ ok: true });
  }
};
