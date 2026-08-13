const PACOTES = {
  p200: { likes: 200, dias: 1, valor: 2.00 },
  p400: { likes: 400, dias: 2, valor: 4.00 },
  p600: { likes: 600, dias: 3, valor: 6.00 },
  p800: { likes: 800, dias: 4, valor: 8.00 },
  p1000: { likes: 1000, dias: 5, valor: 10.00 },
  p2000: { likes: 2000, dias: 10, valor: 15.00 },
  p3000: { likes: 3000, dias: 15, valor: 20.00 },
  p4000: { likes: 4000, dias: 20, valor: 25.00 },
  p5000: { likes: 5000, dias: 25, valor: 30.00 },
  p10000: { likes: 10000, dias: 50, valor: 55.00 },
  vip_semanal: { likes: 1400, dias: 7, valor: 12.00 },
  vip_mensal: { likes: 6000, dias: 30, valor: 35.00 },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Metodo nao permitido' });
  }

  const { uid, packageId } = req.body || {};

  if (!uid || !packageId) {
    return res.status(400).json({ erro: 'UID e pacote sao obrigatorios' });
  }

  const pacote = PACOTES[packageId];
  if (!pacote) {
    return res.status(400).json({ erro: 'Pacote invalido' });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ erro: 'Configuracao ausente' });
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const notificationUrl = `https://${host}/api/webhook`;

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': `${uid}-${packageId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: pacote.valor,
        description: `Rebelde FF - ${pacote.likes} likes`,
        payment_method_id: 'pix',
        payer: { email: `comprador${Date.now()}@rebeldeff.com` },
        metadata: { uid, packageId, likes: pacote.likes, dias: pacote.dias },
        notification_url: notificationUrl,
      }),
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago:', data);
      return res.status(500).json({ erro: 'Falha ao criar pagamento' });
    }

    const txData = data.point_of_interaction && data.point_of_interaction.transaction_data;

    return res.status(200).json({
      paymentId: data.id,
      qrCode: txData && txData.qr_code,
      qrCodeBase64: txData && txData.qr_code_base64,
      status: data.status,
    });
  } catch (err) {
    console.error('Erro ao criar Pix:', err);
    return res.status(500).json({ erro: 'Erro interno' });
  }
};
