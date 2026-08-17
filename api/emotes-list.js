const PASSE_BASE_URL = 'https://passe.soyxapasse.com.br';

function precoVenda(precoOriginal) {
  if (precoOriginal === 10) return 15;
  if (precoOriginal === 12) return 18;
  return precoOriginal;
}

module.exports = async (req, res) => {
  try {
    const resp = await fetch(`${PASSE_BASE_URL}/api/v1/emotes`);
    const data = await resp.json();
    const emotes = data.emotes || [];

    const lista = emotes.map(e => ({
      slug: e.slug,
      nome: e.nome,
      precoOriginal: e.preco,
      preco: precoVenda(e.preco),
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ emotes: lista });
  } catch (err) {
    console.error('Erro ao buscar emotes:', err);
    return res.status(500).json({ erro: 'Falha ao buscar emotes' });
  }
};
