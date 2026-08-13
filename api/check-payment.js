module.exports = async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ erro: 'id obrigatorio' });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await r.json();
    return res.status(200).json({ status: data.status });
  } catch (err) {
    return res.status(500).json({ erro: 'erro interno' });
  }
};
