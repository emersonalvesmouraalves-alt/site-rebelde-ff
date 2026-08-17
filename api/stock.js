const PASSE_BASE_URL = 'https://passe.soyxapasse.com.br';

module.exports = async (req, res) => {
  try {
    const resp = await fetch(`${PASSE_BASE_URL}/api/v1/stock`);
    const data = await resp.json();
    const pers = data.personagens || {};

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      totalPasses: data.total_passes ?? '?',
      personagensDisponiveis: pers.disponivel ?? '?',
    });
  } catch (err) {
    console.error('Erro ao buscar estoque:', err);
    return res.status(500).json({ erro: 'Falha ao buscar estoque' });
  }
};
