const PASSE_BASE_URL = 'https://passe.soyxapasse.com.br';

const TRAJES_VALIDOS = ['branco', 'preto', 'diabinha', 'anjinha', 'astronauta', 'spacefarer', 'velho_rabujento'];

function nomeTraje(modelo) {
  if (modelo === 'preto') return 'Ninja-preto';
  if (modelo === 'branco') return 'Ninja-branco';
  return modelo;
}

function precoTraje(modelo) {
  return (modelo === 'preto' || modelo === 'branco') ? 25 : 20;
}

function precoVendaEmote(precoOriginal) {
  if (precoOriginal === 10) return 15;
  if (precoOriginal === 12) return 18;
  return precoOriginal;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Metodo nao permitido' });
  }

  const { tipo, uid, nome, whatsapp, modelo, slug } = req.body || {};

  if (!tipo || !uid || !nome || !whatsapp) {
    return res.status(400).json({ erro: 'Nome, WhatsApp, UID e tipo sao obrigatorios' });
  }

  let valor, descricao, metaExtra = {};

  if (tipo === 'passe') {
    valor = 6.00;
    descricao = 'Rebelde FF - Passe Booyah';
  } else if (tipo === 'personagem') {
    valor = 4.00;
    descricao = 'Rebelde FF - 50 Personagens';
  } else if (tipo === 'traje') {
    if (!modelo || !TRAJES_VALIDOS.includes(modelo)) {
      return res.status(400).json({ erro: 'Modelo de traje invalido' });
    }
    valor = precoTraje(modelo);
    descricao = `Rebelde FF - Traje ${nomeTraje(modelo)}`;
    metaExtra = { modelo };
  } else if (tipo === 'emote') {
    if (!slug) {
      return res.status(400).json({ erro: 'Emote invalido' });
    }
    try {
      const respEmotes = await fetch(`${PASSE_BASE_URL}/api/v1/emotes`);
      const dataEmotes = await respEmotes.json();
      const emotes = dataEmotes.emotes || [];
      const encontrado = emotes.find(e => e.slug === slug);
      if (!encontrado) {
        return res.status(400).json({ erro: 'Emote nao encontrado na vitrine' });
      }
      valor = precoVendaEmote(encontrado.preco);
      descricao = `Rebelde FF - Emote ${encontrado.nome}`;
      metaExtra = { slug, emoteNome: encontrado.nome };
    } catch (err) {
      console.error('Erro ao validar emote:', err);
      return res.status(500).json({ erro: 'Falha ao validar emote' });
    }
  } else {
    return res.status(400).json({ erro: 'Tipo de produto invalido' });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ erro: 'Configuracao ausente' });
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const notificationUrl = `https://${host}/api/webhook-passe`;

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': `${uid}-${tipo}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: valor,
        description: descricao,
        payment_method_id: 'pix',
        payer: { email: `comprador${Date.now()}@rebeldeff.com` },
        metadata: Object.assign({ tipo, uid, nome, whatsapp }, metaExtra),
        notification_url: notificationUrl,
      }),
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago:', data);
      return res.status(500).json({ erro: 'Falha ao criar pagamento', detalhe: data });
    }

    const txData = data.point_of_interaction && data.point_of_interaction.transaction_data;

    return res.status(200).json({
      paymentId: data.id,
      qrCode: txData && txData.qr_code,
      qrCodeBase64: txData && txData.qr_code_base64,
      status: data.status,
      valor,
    });
  } catch (err) {
    console.error('Erro ao criar Pix:', err);
    return res.status(500).json({ erro: 'Erro interno' });
  }
};
