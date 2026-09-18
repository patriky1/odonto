const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Upload de imagens sem dependências externas (sem multer).
 * O frontend redimensiona a foto no navegador e envia como data URL
 * (base64) em JSON; aqui o arquivo é gravado em disco e o banco guarda
 * apenas o caminho público — o dev.db não incha.
 */

const PASTA_BASE = path.join(__dirname, '../../uploads');

const TIPOS = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB por imagem

const garantirPasta = (sub) => {
  const destino = path.join(PASTA_BASE, sub);
  fs.mkdirSync(destino, { recursive: true });
  return destino;
};

/**
 * Grava uma data URL como arquivo e devolve o caminho público.
 * Retorna null quando não há imagem.
 */
const salvarDataUrl = (dataUrl, subpasta = 'geral') => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  // Já é um caminho salvo anteriormente — mantém como está
  if (dataUrl.startsWith('/uploads/')) return dataUrl;

  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw Object.assign(new Error('Formato de imagem inválido'), { status: 400 });

  const mime = m[1].toLowerCase();
  const ext = TIPOS[mime];
  if (!ext) throw Object.assign(new Error('Use imagens JPG, PNG ou WebP'), { status: 400 });

  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > TAMANHO_MAXIMO) {
    throw Object.assign(new Error('Imagem muito grande (máximo 5 MB)'), { status: 400 });
  }

  const nome = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const destino = garantirPasta(subpasta);
  fs.writeFileSync(path.join(destino, nome), buffer);

  return `/uploads/${subpasta}/${nome}`;
};

/** Remove do disco um arquivo que não é mais referenciado. */
const removerArquivo = (caminhoPublico) => {
  if (!caminhoPublico || !caminhoPublico.startsWith('/uploads/')) return;
  try {
    const relativo = caminhoPublico.replace('/uploads/', '');
    const absoluto = path.join(PASTA_BASE, relativo);
    // Impede escapar da pasta de uploads
    if (!absoluto.startsWith(PASTA_BASE)) return;
    if (fs.existsSync(absoluto)) fs.unlinkSync(absoluto);
  } catch (e) {
    console.warn('⚠️  Não foi possível remover a imagem:', e.message);
  }
};

/** Endpoint genérico de upload: recebe { imagem, pasta } e devolve { url }. */
const upload = (req, res) => {
  try {
    const { imagem, pasta = 'geral' } = req.body;
    if (!imagem) return res.status(400).json({ erro: 'Nenhuma imagem enviada', error: 'Nenhuma imagem enviada' });
    const segura = String(pasta).replace(/[^a-z0-9_-]/gi, '') || 'geral';
    const url = salvarDataUrl(imagem, segura);
    res.status(201).json({ url });
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message, error: e.message });
  }
};

module.exports = { salvarDataUrl, removerArquivo, upload, PASTA_BASE };
