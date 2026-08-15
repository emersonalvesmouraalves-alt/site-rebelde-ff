# 1. index.html - adiciona campos de nome e whatsapp no formulario
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_input = '''      <input id="pix-uid-input" type="text" placeholder="Seu UID do Free Fire" style="width:100%;padding:12px;border-radius:8px;border:1px solid #444;background:#222;color:#fff;font-size:16px;box-sizing:border-box;">
      <button onclick="confirmarUid()"'''

new_input = '''      <input id="pix-nome-input" type="text" placeholder="Seu nome" style="width:100%;padding:12px;border-radius:8px;border:1px solid #444;background:#222;color:#fff;font-size:16px;box-sizing:border-box;margin-bottom:8px;">
      <input id="pix-whatsapp-input" type="text" placeholder="Seu WhatsApp (com DDD)" style="width:100%;padding:12px;border-radius:8px;border:1px solid #444;background:#222;color:#fff;font-size:16px;box-sizing:border-box;margin-bottom:8px;">
      <input id="pix-uid-input" type="text" placeholder="Seu UID do Free Fire" style="width:100%;padding:12px;border-radius:8px;border:1px solid #444;background:#222;color:#fff;font-size:16px;box-sizing:border-box;">
      <button onclick="confirmarUid()"'''

assert old_input in html, "FORM nao encontrado"
html = html.replace(old_input, new_input)

old_func = '''async function confirmarUid() {
  const uid = document.getElementById('pix-uid-input').value.trim();
  if (!uid) { alert('Digite seu UID'); return; }

  document.getElementById('pix-passo-uid').style.display = 'none';
  document.getElementById('pix-passo-carregando').style.display = 'block';

  try {
    const resp = await fetch('/api/create-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: uid, packageId: pixPacoteAtual }),
    });'''

new_func = '''async function confirmarUid() {
  const nome = document.getElementById('pix-nome-input').value.trim();
  const whatsapp = document.getElementById('pix-whatsapp-input').value.trim();
  const uid = document.getElementById('pix-uid-input').value.trim();
  if (!nome) { alert('Digite seu nome'); return; }
  if (!whatsapp) { alert('Digite seu WhatsApp'); return; }
  if (!uid) { alert('Digite seu UID'); return; }

  document.getElementById('pix-passo-uid').style.display = 'none';
  document.getElementById('pix-passo-carregando').style.display = 'block';

  try {
    const resp = await fetch('/api/create-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: uid, packageId: pixPacoteAtual, nome: nome, whatsapp: whatsapp }),
    });'''

assert old_func in html, "FUNCAO nao encontrada"
html = html.replace(old_func, new_func)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("index.html atualizado")

# 2. api/create-pix.js - aceita e valida nome/whatsapp
with open('api/create-pix.js', 'r', encoding='utf-8') as f:
    cp = f.read()

cp = cp.replace(
    "const { uid, packageId } = req.body || {};\n\n  if (!uid || !packageId) {\n    return res.status(400).json({ erro: 'UID e pacote sao obrigatorios' });\n  }",
    "const { uid, packageId, nome, whatsapp } = req.body || {};\n\n  if (!uid || !packageId || !nome || !whatsapp) {\n    return res.status(400).json({ erro: 'Nome, WhatsApp, UID e pacote sao obrigatorios' });\n  }"
)
cp = cp.replace(
    "metadata: { uid, packageId, likes: pacote.likes, dias: pacote.dias },",
    "metadata: { uid, packageId, likes: pacote.likes, dias: pacote.dias, nome, whatsapp },"
)

with open('api/create-pix.js', 'w', encoding='utf-8') as f:
    f.write(cp)

print("create-pix.js atualizado")

# 3. api/webhook.js - manda aviso no Telegram com nome/whatsapp/uid/valor
with open('api/webhook.js', 'r', encoding='utf-8') as f:
    wh = f.read()

wh = wh.replace(
    "async function enviarLike(uid) {",
    '''async function notificarDono(texto) {
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

async function enviarLike(uid) {'''
)

wh = wh.replace(
    "    const meta = payment.metadata || {};\n    const uid = meta.uid;\n    const dias = meta.dias;",
    "    const meta = payment.metadata || {};\n    const uid = meta.uid;\n    const dias = meta.dias;\n    const nome = meta.nome || 'Nao informado';\n    const whatsapp = meta.whatsapp || 'Nao informado';\n    const valor = payment.transaction_amount;"
)

wh = wh.replace(
    "    await saveUsos(gistId, usos);\n    await enviarLike(uid);",
    '''    await saveUsos(gistId, usos);
    await enviarLike(uid);

    const textoAviso = `💰 NOVA VENDA CONFIRMADA\\n\\nNome: ${nome}\\nWhatsApp: ${whatsapp}\\nUID: ${uid}\\nValor: R$ ${valor}\\nDias de auto-like: ${dias}\\nPayment ID: ${paymentId}`;
    await notificarDono(textoAviso);'''
)

with open('api/webhook.js', 'w', encoding='utf-8') as f:
    f.write(wh)

print("webhook.js atualizado")
