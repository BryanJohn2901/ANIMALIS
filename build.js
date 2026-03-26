/**
 * Build de produção - ANIMALIS
 * Gera pasta dist estática: HTML minificado, assets copiados, caminhos válidos.
 */
const fs = require('fs');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');

const ROOT = path.resolve(__dirname);
const DIST = path.join(ROOT, 'dist');
const SRC_HTML = path.join(ROOT, 'index.html');
const DIST_HTML = path.join(DIST, 'index.html');

// ——— Limpar e criar dist ———
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });
console.log('[build] Pasta dist criada/limpa.');

// ——— Copiar assets (img) mantendo estrutura ———
const imgSrc = path.join(ROOT, 'img');
const imgDest = path.join(DIST, 'img');
if (fs.existsSync(imgSrc)) {
  fs.mkdirSync(imgDest, { recursive: true });
  const files = fs.readdirSync(imgSrc);
  for (const file of files) {
    const srcFile = path.join(imgSrc, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, path.join(imgDest, file));
    }
  }
  console.log('[build] Pasta img copiada para dist/img');
}

// ——— Ler HTML ———
let html = fs.readFileSync(SRC_HTML, 'utf8');

// ——— Minificar scripts inline (sem src) e depois HTML ———
async function minifyInlineScripts(htmlContent) {
  const parts = [];
  const regex = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(htmlContent)) !== null) {
    parts.push(htmlContent.slice(lastIndex, match.index));
    const attrs = match[1];
    let code = match[2].trim();
    if (code) {
      try {
        const result = await minifyJs(code, {
          compress: { passes: 1, drop_console: false },
          mangle: false,
          format: { comments: false }
        });
        code = result.code;
      } catch (e) {
        console.warn('[build] Script inline não minificado:', e.message);
      }
    }
    parts.push(`<script${attrs}>${code}</script>`);
    lastIndex = regex.lastIndex;
  }
  parts.push(htmlContent.slice(lastIndex));
  return parts.join('');
}

// ——— Minificar HTML (preservando scripts de terceiros e lógica) ———
async function run() {
  html = await minifyInlineScripts(html);

  const minified = await minifyHtml(html, {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: false,
    keepClosingSlash: true,
    decodeEntities: true,
    sortAttributes: false,
    sortClassName: false
  });

  fs.writeFileSync(DIST_HTML, minified, 'utf8');
  console.log('[build] index.html minificado em dist/index.html');

  // Revisão de caminhos: garantir que img/ está correto (já está como img/ebookAnimali.png)
  const distContent = fs.readFileSync(DIST_HTML, 'utf8');
  if (!distContent.includes('img/')) {
    console.warn('[build] Nenhum caminho img/ encontrado no HTML.');
  } else {
    console.log('[build] Caminhos locais (img/) verificados.');
  }

  const sizeBefore = Buffer.byteLength(html, 'utf8');
  const sizeAfter = Buffer.byteLength(minified, 'utf8');
  console.log(`[build] HTML: ${(sizeBefore / 1024).toFixed(2)} KB → ${(sizeAfter / 1024).toFixed(2)} KB`);
  console.log('[build] Concluído. dist/ pronto para deploy.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
