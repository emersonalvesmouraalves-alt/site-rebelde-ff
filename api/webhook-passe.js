const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_FILENAME_LOOKUP = 'usos_bot.json';
const GIST_FILENAME_PASSE = 'usos_passe.json';
const PASSE_BASE_URL = 'https://passe.soyxapasse.com.br';
const PASSE_API_TOKEN = process.env.PASSE_API_TOKEN;

function ghHeaders() {
  return {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
  };
}

async function findGistId() {
  const res = await fetch('https://api.github.com/gists', { headers: ghHeaders() });
  const gists = await res.json();
  const found = gists.find(g => g.files && g.files[GIST_FILENAME_LOOKUP]);
  if (!found) throw new Error('Gist nao encontrado');
  return found.id;
}

async function loadUsosPasse(gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers: ghHeaders() });
  const data = await res.json();
  const arquivo = data.files[GIST_FILENAME_PASSE];
  if (!arquivo) return { pagamentos_processados: [] };
  return JSON.parse(arquivo.content);
}

async function saveUsosPasse(gistId, usos) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
    body: JSON.stringify({
      files: { [GIST_FILENAME_PASSE]: { content: JSON.stringify(usos) } },
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

async function entregarProduto(tipo, uid, extra) {
  let url, body;

  if (tipo === 'passe') {
    url = `${PASSE_BASE_URL}/api/v1/order`;
    body = { token: PASSE_API_TOKEN, player_id: uid };
  } else if (tipo === 'personagem') {
    url = `${PASSE_BASE_URL}/api/v1/order-personagem`;
    body = { token: PASSE_API_TOKEN, player_id: uid };
  } else if (tipo === 'traje') {
    url = `${PASSE_BASE_URL}/api/v1/order-traje`;
    body = { token: PASSE_API_TOKEN, player_id: uid, modelo: extra.modelo };
  } else if (tipo === 'emote') {
    url = `${PASSE_BASE_URL}/api/v1/order-emote`;
    body = { token: PASSE_API_TOKEN, player_id: uid, emote: extra.slug };
  } else {
    return { sucesso: false, erro: 'Tipo desconhecido' };
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 30000,
    });
    const data = await resp.json();
    return Object.assign({ sucesso: !!data.success }, data);
  } catch (err) {
    return { sucesso: false, erro: String(err) };
  }
}

module.exports = async (req, res) => {
  const paymentId = req.query['data.id'] || (req.body && req.body.data && req.body.data.id);
  if (!paymentId) {
    return res.status(200).json({ ok: true });
  }

  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const payment = await paymentRes.json();

    if (payment.status !== 'approved') {
      return res.status(200).json({ ok: true });
    }

    const meta = payment.metadata || {};
    const tipo = meta.tipo;
    const uid = meta.uid;
    const nome = meta.nome || 'Nao informado';
    const whatsapp = meta.whatsapp || 'Nao informado';
    const valor = payment.transaction_amount;

    if (!tipo || !uid) {
      return res.status(200).json({ ok: true });
    }

    const gistId = await findGistId();
    const usos = await loadUsosPasse(gistId);
    usos.pagamentos_processados = usos.pagamentos_processados || [];

    if (usos.pagamentos_processados.includes(String(paymentId))) {
      return res.status(200).json({ ok: true, ja_processado: true });
    }

    const resultado = await entregarProduto(tipo, uid, meta);

    usos.pagamentos_processados.push(String(paymentId));
    await saveUsosPasse(gistId, usos);

    const statusEntrega = resultado.sucesso ? '✅ Entregue' : `⚠️ Falha na entrega: ${resultado.erro || resultado.message || 'erro desconhecido'}`;

    const textoAviso = `💰 NOVA VENDA (${tipo.toUpperCase()})\n\nNome: ${nome}\nWhatsApp: ${whatsapp}\nUID: ${uid}\nValor: R$ ${valor}\nStatus entrega: ${statusEntrega}\nPayment ID: ${paymentId}`;
    await notificarDono(textoAviso);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro no webhook-passe:', err);
    return res.status(200).json({ ok: true });
  }
};
