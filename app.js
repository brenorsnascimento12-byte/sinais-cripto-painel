'use strict';
// Painel sinais cripto. Só desenha: todos os números vêm calculados em painel/dados.json (repositório privado).
// Segurança: todo o texto dos dados entra como texto (nunca innerHTML) — as justificações dos agentes
// vêm de posts de desconhecidos. A chave do GitHub fica só no localStorage deste telemóvel.

const REPO = 'brenorsnascimento12-byte/sinais-cripto';
const URL_DADOS = `https://api.github.com/repos/${REPO}/contents/painel/dados.json`;
const K_CHAVE = 'sinais.chave', K_DADOS = 'sinais.dados';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const REG = { alta: ['▲ Alta', '#34C38F', '#12301F'], neutro: ['■ Neutro', '#F5B83D', '#33280F'], baixa: ['▼ Baixa', '#F26B78', '#3A1A1E'] };
const R1 = { a: 'alta', n: 'neutro', b: 'baixa' };
const FAIXA = { a: 'rgba(52,195,143,.16)', n: 'rgba(245,184,61,.14)', b: 'rgba(242,107,120,.16)' };
const ui = { periodo: '1A', sel: null, periodoR: 'inicio', abertos: new Set() };
let ultimo = null;

// ---------- utilitários ----------

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f instanceof Node ? f : String(f));
  return e;
}
function svg(tag, attrs = {}) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
function num(x, casas = 2) {
  if (!fin(x)) return '—';
  return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: 'always' })
    .format(x).replace(/[  ]/g, ' ').replace('-', '−');
}
const usd = (x, casas = 0) => fin(x) ? num(x, casas) + ' $' : '—';
const pct = (x, casas = 1) => fin(x) ? (x > 0 ? '+' : '') + num(x * 100, casas) + '%' : '—';
const pctSem = (x, casas = 0) => fin(x) ? num(x * 100, casas) + '%' : '—';
const sinal = (x) => fin(x) ? (x > 0 ? '+' : '') + num(x) : '—';
function dataCurta(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—';
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}
const diasAte = (iso, hoje) => Math.round((Date.parse(iso) - Date.parse(hoje)) / 86400000);
const cor = (x) => !fin(x) || x === 0 ? 'var(--texto)' : x < 0 ? 'var(--baixa)' : 'var(--alta)';
function ler(k) { try { return localStorage.getItem(k); } catch { return null; } }
function escrever(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
function render(no) { document.getElementById('app').replaceChildren(no); }
const seguro = (f, ...a) => { try { return f(...a); } catch (e) { console.error(e); return el('div', { class: 'cartao sec' }, 'Não foi possível mostrar esta parte.'); } };

// ---------- carregar ----------

function exemploLocal() {
  const p = new URLSearchParams(location.search).get('exemplo');
  return p && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /^[a-z0-9_-]+$/.test(p) ? `exemplos/${p}.json` : null;
}

async function carregar() {
  const exemplo = exemploLocal();
  if (exemplo) {
    if (new URLSearchParams(location.search).has('semrede')) return desenhar(await (await fetch(exemplo)).json(), 'sem_rede');
    return desenhar(await (await fetch(exemplo)).json(), 'exemplo');
  }
  const chave = ler(K_CHAVE);
  if (!chave) return ecraChave();
  let guardado = null;
  try { guardado = JSON.parse(ler(K_DADOS)); } catch { guardado = null; }
  if (guardado) desenhar(guardado, 'cache');
  try {
    const r = await fetch(URL_DADOS, {
      headers: { Authorization: `Bearer ${chave}`, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' },
      cache: 'no-store', referrerPolicy: 'no-referrer'
    });
    if (r.status === 401 || r.status === 403) escrever(K_CHAVE, null);
    if (r.status === 401 || r.status === 403) return ecraChave('A chave expirou, foi apagada ou não tem acesso a sinais-cripto. Cria uma nova e cola-a aqui.');
    if (r.status === 404) return mensagem('Ainda não há dados do painel. Espera pela próxima corrida diária (05:17 UTC).');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    escrever(K_DADOS, JSON.stringify(d));
    desenhar(d, 'rede');
  } catch (e) {
    console.error(e);
    if (guardado) desenhar(guardado, 'sem_rede');
    else mensagem('Sem rede e sem dados guardados neste telemóvel. Tenta outra vez quando tiveres ligação.');
  }
}

// ---------- ecrãs simples ----------

function ecraChave(erro) {
  const input = el('input', { id: 'chave', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'github_pat_…' });
  const erroP = el('p', { role: 'alert', style: 'margin:0;font-size:13px;color:var(--baixa)' }, erro || '');
  const form = el('form', {
    style: 'display:flex;flex-direction:column;gap:10px',
    onsubmit: (e) => {
      e.preventDefault();
      const v = input.value.trim();
      // Só chaves «fine-grained» (github_pat_): podem ficar limitadas a um repositório e a só leitura.
      if (!/^github_pat_[A-Za-z0-9_]{20,}$/.test(v)) { erroP.textContent = 'Isto não parece uma chave fine-grained do GitHub (começa por github_pat_).'; return; }
      escrever(K_CHAVE, v);
      input.value = '';
      carregar();
    }
  }, el('label', { for: 'chave', style: 'font-size:13px;font-weight:600' }, 'Chave do GitHub'), input,
  el('button', { type: 'submit', class: 'btn' }, 'Guardar e abrir o painel'));
  const passo = (n, ...t) => el('li', { style: 'display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;font-size:13px;line-height:1.5;color:#B7BFCC' },
    el('span', { class: 'mono', style: 'width:24px;height:24px;border-radius:50%;background:#1A2333;color:var(--azul);display:flex;align-items:center;justify-content:center;font-size:12px' }, String(n)),
    el('span', {}, ...t));
  render(el('div', { class: 'wrap', style: 'max-width:440px;gap:20px' },
    el('span', { class: 'sec', style: 'font-size:12px;letter-spacing:.12em;text-transform:uppercase' }, 'Sinais cripto'),
    el('h1', { style: 'font-size:26px;line-height:1.2' }, 'Ligar o painel aos teus dados'),
    el('p', { class: 'sec', style: 'margin:0;font-size:14px;line-height:1.55' }, 'Os dados ficam no teu repositório privado. O painel só os lê com uma chave do GitHub, que fica guardada apenas neste telemóvel.'),
    el('ol', { style: 'margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px' },
      passo(1, 'No GitHub: ', el('strong', { style: 'color:var(--texto)' }, 'Settings → Developer settings → Fine-grained tokens → Generate new token'), '.'),
      passo(2, 'Repositório: ', el('strong', { style: 'color:var(--texto)' }, 'só sinais-cripto'), '. Permissão: ', el('strong', { style: 'color:var(--texto)' }, 'Contents → Read-only'), '. Validade: 1 ano.'),
      passo(3, 'Copia a chave e cola-a aqui em baixo.')),
    erroP, form,
    el('div', { class: 'cartao', style: 'font-size:12px;line-height:1.55;gap:6px;padding:14px' },
      el('strong', {}, 'Segurança'),
      el('span', { class: 'sec' }, 'A chave só lê este repositório e não consegue mudar nada. Não vai para o GitHub nem para as notificações.'),
      el('span', { class: 'sec' }, 'Perdeste o telemóvel? Apaga a chave no GitHub e cria outra.')),
    el('span', { class: 'ter', style: 'font-size:12px' }, 'Dica: no Chrome, ⋮ → «Adicionar ao ecrã principal» para abrir como uma app.')));
  input.focus();
}

function mensagem(t) {
  render(el('div', { class: 'wrap' }, el('div', { class: 'cartao' }, el('p', { style: 'margin:0;line-height:1.5' }, t),
    el('button', { type: 'button', class: 'btn', onclick: carregar }, 'Tentar outra vez'))));
}

// ---------- painel ----------

function desenhar(d, origem) {
  ultimo = { d, origem };
  if (!d || typeof d !== 'object') return mensagem('O ficheiro de dados não é válido.');
  const avisos = [];
  if (origem === 'sem_rede') avisos.push(`Sem rede: a mostrar os dados guardados de ${dataCurta(d.dia)}.`);
  if (d.falhou && d.falhou.dia) avisos.push(`A corrida de ${dataCurta(d.falhou.dia)} falhou: a mostrar a última decisão boa, de ${dataCurta(d.dia)}. Vê o separador Actions no GitHub.`);
  const agoraLx = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Lisbon' });
  if (!d.falhou && typeof d.dia === 'string' && d.dia < agoraLx.slice(0, 10) && Number(agoraLx.slice(11, 13)) >= 9)
    avisos.push(`Ainda sem a corrida de hoje: a mostrar os dados de ${dataCurta(d.dia)}.`);
  const e = d.estado || {};
  const falhas = [...(e.agentes_falharam || []), ...(e.fontes_falharam || [])];
  const topo = el('header', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' },
    el('div', { style: 'display:flex;flex-direction:column;gap:2px' }, el('h1', {}, 'Sinais cripto'),
      el('span', { class: 'sec', style: 'font-size:12px' }, `Atualizado a ${dataCurta(d.dia)} · fecho de ${dataCurta(d.base_data)} · regras v2`)),
    el('div', { class: 'sec', style: 'display:flex;align-items:center;gap:8px;font-size:12px' },
      el('span', { 'aria-hidden': 'true', style: `width:8px;height:8px;border-radius:50%;background:${falhas.length ? 'var(--neutro)' : 'var(--alta)'}` }),
      el('span', {}, falhas.length ? `Falhas hoje: ${falhas.join(', ')}` : fin(e.agentes_ok) ? `${e.agentes_ok} de 5 agentes · fontes OK` : 'Estado da corrida desconhecido'),
      el('button', { type: 'button', class: 'botao-icone', 'aria-label': 'Atualizar', onclick: carregar }, '↻')));
  const caixaAvisos = avisos.map((t) => el('div', { class: 'aviso', role: 'status', style: 'background:#2A2312;color:#F5D48A;border:1px solid #6B5320' }, t));
  const rodape = el('footer', { class: 'ter', style: 'display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;padding-top:8px' },
    el('span', {}, 'Só de leitura · o sistema nunca compra nem vende: quem executa és tu'),
    el('span', { style: 'display:flex;gap:16px' }, linkRegistar(d, 'Registar operação no GitHub'),
      el('button', { type: 'button', style: 'background:none;border:none;color:var(--ter);text-decoration:underline;padding:0;font-size:12px', onclick: () => ecraChave() }, 'Trocar chave')));
  if (!d.hoje) return render(el('div', { class: 'wrap' }, topo, ...caixaAvisos,
    el('div', { class: 'cartao' }, 'Ainda não há decisão para este dia. Vê o separador Actions no GitHub.'), rodape));
  render(el('div', { class: 'wrap' }, topo, ...caixaAvisos,
    el('div', { class: 'topo' }, el('div', { class: 'th' }, seguro(blocoHoje, d)), ...[seguro(mosaicos, d)].flat()),
    el('div', { class: 'secs' }, seguro(secGrafico, d), seguro(secGatilhos, d), seguro(secRendimento, d), seguro(secCarteira, d),
      seguro(secMercado, d), seguro(secAgentes, d), seguro(secHistorico, d), seguro(secNormal, d)),
    rodape));
}
function redesenhar() { if (ultimo) desenhar(ultimo.d, ultimo.origem); }

function linkRegistar(d, texto, classe) {
  const href = typeof d.ligacao_registar === 'string' && d.ligacao_registar.startsWith('https://github.com/') ? d.ligacao_registar : `https://github.com/${REPO}/actions`;
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer', class: classe }, texto);
}

function blocoHoje(d) {
  const h = d.hoje, reg = REG[h.regime] || REG.neutro;
  const banda = fin(h.alvo) && fin(h.banda) ? [Math.max(0, h.alvo - h.banda), Math.min(1, h.alvo + h.banda)] : [0, 0];
  const A = {
    comprar: ['Comprar', 'var(--alta)'], vender: ['Vender uma parte', 'var(--neutro)'], sem_acao: ['Sem ação', 'var(--sec)'],
    espera: ['À espera', 'var(--azul)'], veto: ['Compra adiada', 'var(--neutro)'], travao: ['Compras paradas', 'var(--baixa)'], simulacao: ['Faria', 'var(--azul)']
  }[h.estado_ui] || ['Sem ação', 'var(--sec)'];
  const acao = (h.acoes || [])[0];
  let titulo;
  if (acao) titulo = acao.acao === 'comprar' ? `Comprar ${num(acao.montante_usdc)} USDC de BTC` : `Vender ${num(acao.quantidade, 6)} BTC (≈ ${num(acao.montante_usdc)} USDC)`;
  else if (h.estado_ui === 'espera' && h.proxima_ordem_possivel) titulo = `Ordem possível a ${dataCurta(h.proxima_ordem_possivel)}`;
  else titulo = { travao: 'Travão da carteira ativo', veto: 'Os agentes travaram a compra', simulacao: 'Nada a comprar' }[h.estado_ui] || 'Dentro da banda';
  const frase = (t) => { t = String(t || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : ''; };
  let detalhe = acao ? `Ordem limite no Kraken Pro perto de ${usd(acao.preco_ref)}.` : frase(h.motivo_sem_acao);
  if (h.estado_ui === 'sem_acao') detalhe = `O peso está entre ${pctSem(banda[0])} e ${pctSem(banda[1])}: nada a fazer hoje. Os preços que fariam o sistema agir estão em «Preços-gatilho».`;
  if (h.modo === 'simulacao') detalhe += ' Simulação: se começasses hoje com 100 USDC. Nada a fazer até iniciares a carteira.';
  if (h.estado_ui === 'travao') detalhe += ' As vendas continuam permitidas; o travão só desliga quando correres «retomar».';
  const jaRegistou = acao && h.operacao_registada_hoje;
  if (jaRegistou) {
    titulo = 'Operação de hoje registada';
    detalhe = 'Já registaste uma operação hoje. A recomendação da manhã deixa de valer: a próxima chega amanhã, com a carteira atualizada.';
  }
  const pos = (x) => `${Math.max(0, Math.min(100, (fin(x) ? x : 0) * 100))}%`;
  const inclin = fin(h.mm200) && fin(h.mm200_ha20) ? (h.mm200 > h.mm200_ha20 ? ', que está a subir' : ', que está a descer') : '';
  const v = h.veto || {};
  const linhaVeto = (v.agentes || []).length
    ? `Agentes: ${v.agentes.length} de 5 com baixa forte${v.trava ? ` — a travar compras (dia ${v.dia} de ${v.max_dias})` : ' (são precisos 4)'}`
    : 'Agentes: 0 de 5 com baixa forte (são precisos 4)';
  return el('section', { class: 'cartao', 'aria-label': 'Hoje', style: 'padding:24px;gap:18px' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' },
      el('div', { style: 'display:flex;gap:10px;align-items:center' },
        el('span', { class: 'sec', style: 'font-size:12px;letter-spacing:.12em;text-transform:uppercase' }, 'Hoje · BTC'),
        h.modo === 'simulacao' && el('span', { style: 'font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--azul);border:1px solid #3A5A8C;border-radius:999px;padding:3px 8px' }, 'SIMULAÇÃO')),
      el('span', { class: 'chip', style: `background:${reg[2]};color:${reg[1]}` }, reg[0])),
    el('p', { style: 'margin:0;font-size:14px;line-height:1.5;color:#B7BFCC' },
      `Preço ${usd(h.preco, 2)}, ${pct(fin(h.preco) && fin(h.mm200) ? h.preco / h.mm200 - 1 : null)} face à média de 200 dias (${usd(h.mm200)})${inclin}.`),
    el('div', { style: 'display:flex;flex-direction:column;gap:8px' },
      el('div', { class: 'sec', style: 'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px' },
        el('span', {}, 'Peso em BTC ', el('strong', { class: 'mono', style: 'color:var(--texto)' }, pctSem(h.peso))),
        el('span', {}, 'Alvo ', el('strong', { class: 'mono', style: 'color:var(--texto)' }, pctSem(h.alvo)), ` · banda ${pctSem(banda[0])}–${pctSem(banda[1])}`)),
      el('div', { role: 'img', 'aria-label': `Peso ${pctSem(h.peso)}, alvo ${pctSem(h.alvo)}, banda de ${pctSem(banda[0])} a ${pctSem(banda[1])}`, style: 'position:relative;height:16px;border-radius:999px;background:#1C222B' },
        el('div', { style: `position:absolute;top:0;bottom:0;left:${pos(banda[0])};width:${(banda[1] - banda[0]) * 100}%;background:#24344F;border-radius:4px` }),
        el('div', { style: `position:absolute;top:-4px;bottom:-4px;left:${pos(h.alvo)};width:2px;background:var(--azul)` }),
        el('div', { style: `position:absolute;top:50%;left:${pos(h.peso)};width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:${A[1]};border:3px solid var(--cartao)` })),
      el('div', { class: 'mono ter', style: 'display:flex;justify-content:space-between;font-size:11px' }, el('span', {}, '0%'), el('span', {}, '50%'), el('span', {}, '100%'))),
    el('div', { class: 'fundo2', style: `display:flex;flex-direction:column;gap:6px;padding:16px;border:1px solid ${A[1] === 'var(--sec)' ? 'var(--borda)' : A[1]};border-radius:12px` },
      el('span', { style: `font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${A[1]}` }, A[0]),
      el('span', { style: 'font-size:26px;font-weight:700;line-height:1.2' }, titulo),
      el('span', { style: 'font-size:14px;line-height:1.5;color:#B7BFCC' }, detalhe),
      acao && !jaRegistou && h.modo === 'real' && linkRegistar(d, 'Registar no GitHub depois de executar', 'btn')),
    el('div', { class: 'sec', style: 'display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;border-top:1px solid var(--borda);padding-top:12px' },
      el('span', {}, linhaVeto), el('span', {}, 'Ordens sempre ', el('strong', { style: 'color:var(--texto)' }, 'limite'), ' no Kraken Pro')));
}

function mosaico(href, titulo, n, r, corN) {
  return el('a', { class: 'mosaico', href }, el('span', { class: 'r' }, titulo),
    el('span', { class: 'n', style: corN ? `color:${corN}` : null }, n), el('span', { class: 'r' }, r));
}
function mosaicos(d) {
  const m = d.mosaicos || {}, real = d.hoje.modo === 'real';
  const fg = m.fear_greed, ev = m.proximo_evento;
  const dif = fin(m.valor) && fin(m.dca_valor) ? m.valor - m.dca_valor : null;
  const a = real ? [
    mosaico('#rendimento', 'Valor da carteira', `${num(m.valor)} USDC`, `depositado ${num(m.depositado)}`),
    mosaico('#rendimento', 'Rendimento', `${sinal(m.ganho)} USDC`, `${pct(m.ganho_pct)} · estratégia ${pct(m.estrategia_pct)}`, cor(m.ganho)),
    mosaico('#carteira', 'vs referência «só BTC»', `${sinal(dif)} USDC`, `DCA vale ${num(m.dca_valor)}`, cor(dif)),
    mosaico('#historico', 'Próximo depósito', dataCurta(m.proximo_deposito), m.proximo_deposito ? `daqui a ${diasAte(m.proximo_deposito, d.dia)} dias · 50 €` : '')
  ] : [
    mosaico('#rendimento', 'Carteira', 'Por iniciar', 'Regista «iniciar» no GitHub quando quiseres começar'),
    mosaico('#normal', 'O que esperar', '~9 ordens/ano', 'quedas de −34% a −53% nos grandes crashes')
  ];
  const b = [
    mosaico('#grafico', 'BTC', usd(d.hoje.preco, 2), `${pct(m.btc_var_1d)} 1 dia · ${pct(m.btc_var_7d)} 7 dias`),
    mosaico('#mercado', 'Fear & Greed', fg ? `${fg.valor} ${fg.classe}` : '—', fg && fin(fg.ontem) ? `ontem ${fg.ontem}` : ''),
    mosaico('#mercado', 'Próximo evento', ev ? `${String(ev.evento || '').split(' (')[0]} · ${dataCurta(ev.data)}` : '—', ev ? `daqui a ${diasAte(ev.data, d.dia)} dias` : ''),
    real && mosaico('#historico', 'Ordens este ano', String(fin(m.ordens_ano) ? m.ordens_ano : 0), `comissões ${num(m.comissoes_ano)} USDC`)
  ];
  return [el('div', { class: 'ta col' }, ...a), el('div', { class: 'tb col' }, ...b)];
}

// ---------- secções ----------

function linha(xs, ys, lo, hi, w, h) {
  const esc = hi > lo ? hi - lo : 1;
  return xs.map((x, i) => `${i ? 'L' : 'M'}${(x * w).toFixed(1)} ${(h - ((ys[i] - lo) / esc) * h).toFixed(1)}`).join(' ');
}
function caixa(id, titulo, sub, extra, ...filhos) {
  return el('section', { id, class: 'cartao' + (extra ? ' ' + extra : ''), 'aria-label': titulo },
    el('div', { style: 'display:flex;flex-direction:column;gap:4px' }, el('h2', {}, titulo), sub && el('span', { class: 'sec', style: 'font-size:13px' }, sub)),
    ...filhos);
}
function botoes(rotulo, opcoes, atual, aoEscolher) {
  return el('div', { class: 'botoes', role: 'group', 'aria-label': rotulo },
    ...opcoes.map(([v, t]) => el('button', { type: 'button', 'aria-pressed': String(v === atual), onclick: () => aoEscolher(v) }, t)));
}

function secGrafico(d) {
  const s = d.serie_btc;
  if (!s || !Array.isArray(s.preco) || s.preco.length < 2) return caixa('grafico', 'BTC e tendência', 'Ainda sem série de preços.', 'larga');
  const n = s.preco.length, span = { '3M': 91, '6M': 182, '1A': 365 }[ui.periodo] || 365;
  const i0 = Math.max(0, n - span), idx = Array.from({ length: n - i0 }, (_, k) => k + i0);
  const vals = idx.flatMap((i) => [s.preco[i], s.mm200[i]]).filter(fin);
  const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.02;
  const xs = idx.map((_, k) => k / (idx.length - 1));
  const area = el('div', { class: 'grafico', style: 'height:260px' });
  let ini = 0;
  idx.forEach((i, k) => {
    if (k === idx.length - 1 || s.regime[idx[k + 1]] !== s.regime[i]) {
      const fim = k === idx.length - 1 ? 1 : (xs[k] + xs[k + 1]) / 2;
      area.append(el('div', { 'aria-hidden': 'true', style: `position:absolute;top:0;bottom:0;left:${ini * 100}%;width:${(fim - ini) * 100}%;background:${FAIXA[s.regime[i]] || 'transparent'}` }));
      ini = fim;
    }
  });
  const g = svg('svg', { viewBox: '0 0 1000 260', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Preço do BTC e média de 200 dias' });
  g.append(svg('path', { d: linha(xs, idx.map((i) => s.mm200[i]), lo, hi, 1000, 260), fill: 'none', stroke: '#9CC2FF', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }),
    svg('path', { d: linha(xs, idx.map((i) => s.preco[i]), lo, hi, 1000, 260), fill: 'none', stroke: '#E8EBF0', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
  area.append(g);
  for (const o of d.operacoes || []) {
    const k = idx.findIndex((i) => s.datas[i] === o.data);
    if (k < 0 || !fin(o.preco)) continue;
    area.append(el('div', { 'aria-hidden': 'true', style: `position:absolute;left:${xs[k] * 100}%;top:${(1 - (o.preco - lo) / (hi - lo)) * 100}%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:${o.acao === 'comprar' ? 'var(--alta)' : 'var(--neutro)'};border:2px solid var(--fundo2)` }));
  }
  const k = ui.sel == null || ui.sel >= idx.length ? idx.length - 1 : ui.sel, i = idx[k];
  area.append(el('div', { 'aria-hidden': 'true', style: `position:absolute;top:0;bottom:0;left:${xs[k] * 100}%;width:1px;background:#E8EBF0;opacity:.5` }));
  const escolher = (e) => {
    const r = area.getBoundingClientRect();
    ui.sel = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (idx.length - 1));
    redesenhar();
  };
  area.append(el('div', { style: 'position:absolute;inset:0;cursor:crosshair;touch-action:pan-y', onpointerdown: escolher }));
  const reg = REG[R1[s.regime[i]]] || REG.neutro;
  return el('section', { id: 'grafico', class: 'cartao larga', 'aria-label': 'BTC e tendência' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' }, el('h2', {}, 'BTC e tendência'),
      botoes('Período', [['3M', '3M'], ['6M', '6M'], ['1A', '1A']], ui.periodo, (v) => { ui.periodo = v; ui.sel = null; redesenhar(); })),
    el('div', { class: 'sec', style: 'display:flex;gap:16px;flex-wrap:wrap;font-size:12px' },
      legenda('#E8EBF0', 'Preço'), legenda('#9CC2FF', 'Média 200 dias'), legenda('#1C3A2C', 'Alta', true), legenda('#3A3016', 'Neutro', true), legenda('#3F2025', 'Baixa', true)),
    area,
    el('div', { class: 'fundo2', style: 'display:flex;gap:18px;flex-wrap:wrap;font-size:13px;padding:10px 12px' },
      el('span', { class: 'sec' }, `${dataCurta(s.datas[i])} ${String(s.datas[i]).slice(0, 4)}`),
      el('span', {}, 'Preço ', el('strong', { class: 'mono' }, usd(s.preco[i]))),
      el('span', {}, 'Média ', el('strong', { class: 'mono', style: 'color:var(--azul)' }, usd(s.mm200[i]))),
      el('span', { style: `color:${reg[1]};font-weight:600` }, reg[0]),
      el('span', { class: 'sec' }, 'Toca no gráfico para ver outro dia')));
}
function legenda(c, t, bloco) {
  return el('span', { style: 'display:inline-flex;align-items:center;gap:6px' },
    el('span', { 'aria-hidden': 'true', style: bloco ? `width:10px;height:10px;background:${c}` : `width:14px;height:2px;background:${c}` }), t);
}

function secGatilhos(d) {
  const p = d.hoje.preco;
  const lista = [...(d.gatilhos || []).filter((g) => fin(g.preco)), { tipo: 'agora', preco: p, texto: 'Preço agora', detalhe: '' }]
    .sort((a, b) => b.preco - a.preco);
  return caixa('gatilhos', 'Preços-gatilho', 'A que preço de fecho o sistema muda de ideias', null,
    el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, ...lista.map((g) => {
      const agora = g.tipo === 'agora', reg = g.tipo === 'regime';
      return el('div', { class: 'degrau', style: agora ? 'background:#1A2333;border-color:#3A5A8C' : reg ? 'border-color:#6B5320' : null },
        el('span', { class: 'mono', style: `font-weight:700;color:${agora ? 'var(--azul)' : reg ? 'var(--neutro)' : 'var(--texto)'}` }, usd(g.preco)),
        el('span', { style: `font-size:13px;${agora ? 'color:var(--azul);font-weight:600' : ''}` }, g.texto, g.detalhe && el('span', { class: 'sec', style: 'font-weight:400' }, ' — ' + g.detalhe)),
        el('span', { class: 'mono', style: `font-size:12px;text-align:right;color:${agora ? 'var(--azul)' : reg ? 'var(--neutro)' : 'var(--sec)'}` }, agora ? '—' : pct(g.preco / p - 1)));
    })),
    el('span', { class: 'ter', style: 'font-size:12px' }, 'A média de 200 dias move-se todos os dias: estes preços são recalculados a cada fecho.'));
}

function secRendimento(d) {
  if (!d.rendimento) return caixa('rendimento', 'Rendimento', 'Começa quando iniciares a carteira (Registar operação → iniciar).');
  const r = d.rendimento[ui.periodoR] || d.rendimento.inicio || {};
  const real = r.real || {}, dca = r.dca || {};
  const L = [
    ['Ganho (USDC)', (x) => sinal(x.ganho), (x) => x.ganho],
    ['Rendimento simples', (x) => pct(x.simples_pct), (x) => x.simples_pct],
    ['Estratégia (pond. pelo tempo)', (x) => pct(x.estrategia_pct), (x) => x.estrategia_pct],
    ['Taxa anual equivalente', (x) => pct(x.taxa_anual, 0), (x) => x.taxa_anual],
    ['Comissões', (x) => num(x.comissoes), () => null],
    ['Realizado / por realizar', (x) => `${num(x.realizado)} / ${num(x.por_realizar)}`, (x) => (fin(x.realizado) && fin(x.por_realizar) ? x.realizado + x.por_realizar : null)]
  ];
  return el('section', { id: 'rendimento', class: 'cartao', 'aria-label': 'Rendimento' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' }, el('h2', {}, 'Rendimento'),
      botoes('Período do rendimento', [['mes', 'Este mês'], ['ano', 'Este ano'], ['inicio', 'Desde o início']], ui.periodoR, (v) => { ui.periodoR = v; redesenhar(); })),
    el('div', { style: 'overflow-x:auto' }, el('table', {},
      el('thead', {}, el('tr', { class: 'sec' }, el('th', {}),
        el('th', { scope: 'col', style: 'text-align:right;font-weight:500' }, 'Carteira'),
        el('th', { scope: 'col', style: 'text-align:right;font-weight:500' }, 'Só BTC (DCA)'))),
      el('tbody', {}, ...L.map(([nome, f, v]) => el('tr', {}, el('th', { scope: 'row' }, nome),
        el('td', { style: `color:${cor(v(real))}` }, f(real)), el('td', { style: `color:${cor(v(dca))}` }, f(dca))))))),
    el('span', { class: 'ter', style: 'font-size:12px;line-height:1.5' }, '«Estratégia» mede só as decisões do sistema, sem o efeito dos depósitos. A taxa anual só aparece ao fim de 90 dias. Realizado: estimativa — para o IRS confirma com um contabilista.'));
}

function secCarteira(d) {
  const c = d.carteira;
  if (!c || !Array.isArray(c.real) || c.real.length < 2) return caixa('carteira', 'Carteira vs «só BTC»', 'Começa quando iniciares a carteira.');
  const n = c.real.length, xs = c.real.map((_, i) => i / (n - 1));
  const vals = [...c.real, ...c.dca, ...c.depositado].filter(fin), lo = Math.min(...vals) * 0.9, hi = Math.max(...vals) * 1.05;
  const g = svg('svg', { viewBox: '0 0 1000 180', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Valor da carteira, da referência e do depositado' });
  g.append(svg('path', { d: linha(xs, c.depositado, lo, hi, 1000, 180), fill: 'none', stroke: '#5D6677', 'stroke-width': 2, 'stroke-dasharray': '6 4', 'vector-effect': 'non-scaling-stroke' }),
    svg('path', { d: linha(xs, c.dca, lo, hi, 1000, 180), fill: 'none', stroke: '#F5B83D', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }),
    svg('path', { d: linha(xs, c.real, lo, hi, 1000, 180), fill: 'none', stroke: '#34C38F', 'stroke-width': 2.5, 'vector-effect': 'non-scaling-stroke' }));
  const p = svg('svg', { viewBox: '0 0 1000 60', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Peso em BTC ao longo do tempo' });
  p.append(svg('path', { d: linha(xs, c.peso, 0, 1, 1000, 60), fill: 'none', stroke: '#E8EBF0', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
  const alvo = fin(d.hoje.alvo) ? d.hoje.alvo : 0.6, b = fin(d.hoje.banda) ? d.hoje.banda : 0.1;
  return el('section', { id: 'carteira', class: 'cartao', 'aria-label': 'Carteira vs só BTC' },
    el('h2', {}, 'Carteira vs «só BTC»'),
    el('div', { class: 'sec', style: 'display:flex;gap:16px;flex-wrap:wrap;font-size:12px' }, legenda('#34C38F', 'Carteira v2'), legenda('#F5B83D', 'Só BTC'), legenda('#5D6677', 'Depositado')),
    el('div', { class: 'grafico', style: 'height:180px' }, g),
    el('div', { class: 'mono ter', style: 'display:flex;justify-content:space-between;font-size:11px' }, el('span', {}, dataCurta(c.datas[0])), el('span', {}, dataCurta(c.datas[n - 1]))),
    el('span', { style: 'font-size:13px;color:#B7BFCC' }, `Peso em BTC ao longo do tempo (alvo atual ${pctSem(alvo)}, banda ${pctSem(Math.max(0, alvo - b))}–${pctSem(alvo + b)})`),
    el('div', { class: 'grafico', style: 'height:60px' },
      el('div', { 'aria-hidden': 'true', style: `position:absolute;left:0;right:0;top:${(1 - Math.min(1, alvo + b)) * 100}%;height:${(Math.min(1, alvo + b) - Math.max(0, alvo - b)) * 100}%;background:#24344F` }), p));
}

function secMercado(d) {
  const m = d.mercado || {}, fg = m.fear_greed_7d || [], etf = (m.etf_btc_10d || []).filter((e) => fin(e.musd));
  const maxE = Math.max(1, ...etf.map((e) => Math.abs(e.musd)));
  const soma5 = etf.slice(-5).reduce((a, e) => a + e.musd, 0);
  return caixa('mercado', 'Calendário e mercado', null, null,
    ...(m.eventos || []).map((e) => el('div', { class: 'fundo2', style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px' },
      el('div', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' }, el('span', { style: 'font-weight:600;font-size:14px' }, e.evento),
        el('span', { class: 'sec', style: 'font-size:12px' }, `${dataCurta(e.data)}${e.detalhe ? ' · ' + e.detalhe : ''}`)),
      el('span', { class: 'mono', style: `font-size:18px;font-weight:700;white-space:nowrap;color:${diasAte(e.data, d.dia) <= 7 ? 'var(--neutro)' : 'var(--texto)'}` }, `${diasAte(e.data, d.dia)} dias`))),
    fg.length > 0 && el('span', { style: 'font-size:13px;color:#B7BFCC' }, 'Fear & Greed, últimos 7 dias'),
    fg.length > 0 && el('div', { style: 'display:flex;gap:6px;align-items:flex-end;height:74px' }, ...fg.map((b) => el('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:4px' },
      el('span', { class: 'mono sec', style: 'font-size:11px' }, String(b.valor)),
      el('div', { title: `${dataCurta(b.data)}: ${b.classe}`, style: `width:100%;height:${Math.max(2, b.valor / 100 * 52)}px;border-radius:4px 4px 0 0;background:${b.valor < 25 ? 'var(--baixa)' : b.valor < 45 ? 'var(--neutro)' : b.valor <= 55 ? 'var(--sec)' : 'var(--alta)'}` })))),
    etf.length > 0 && el('span', { style: 'font-size:13px;color:#B7BFCC' }, 'Fluxos dos ETF de BTC (milhões $) · últimos 5 dias: ', el('strong', { class: 'mono', style: `color:${cor(soma5)}` }, sinal(soma5).replace(/,\d+$/, ''))),
    ...etf.map((e) => el('div', { style: 'display:grid;grid-template-columns:52px minmax(0,1fr) 60px;gap:8px;align-items:center;font-size:12px' },
      el('span', { class: 'mono sec' }, dataCurta(e.data)),
      el('div', { style: 'position:relative;height:10px;background:var(--fundo2);border-radius:4px' },
        el('div', { style: `position:absolute;top:0;bottom:0;left:${e.musd < 0 ? 50 - Math.abs(e.musd) / maxE * 50 : 50}%;width:${Math.abs(e.musd) / maxE * 50}%;background:${cor(e.musd)};border-radius:4px` })),
      el('span', { class: 'mono', style: `text-align:right;color:${cor(e.musd)}` }, (e.musd > 0 ? '+' : '') + num(e.musd, 0)))));
}

function secAgentes(d) {
  const OP = (o) => !o || !o.direcao ? ['—', 'var(--sec)'] : o.direcao === 'neutro' ? ['■ neutro', 'var(--sec)']
    : [`${o.direcao === 'alta' ? '▲ alta' : '▼ baixa'} ${o.forca || ''}`.trim(), o.direcao === 'alta' ? 'var(--alta)' : 'var(--baixa)'];
  const v = d.hoje.veto || {};
  return el('section', { id: 'agentes', class: 'cartao larga', 'aria-label': 'Agentes' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' },
      el('div', { style: 'display:flex;flex-direction:column;gap:4px' }, el('h2', {}, 'Agentes'),
        el('span', { class: 'sec', style: 'font-size:13px' }, 'Não decidem: só podem adiar compras se 4 de 5 disserem baixa forte')),
      el('span', { class: 'fundo2', style: 'font-size:13px;padding:6px 10px;border-radius:999px;border:1px solid var(--borda)' }, 'Travão: ',
        el('strong', { class: 'mono' }, `${(v.agentes || []).length} de 5`), ' com baixa forte')),
    el('div', { class: 'agentes' }, ...(d.agentes || []).map((a) => {
      const aberto = ui.abertos.has(a.id);
      const just = (a.opinioes && a.opinioes.BTC && a.opinioes.BTC.justificacao) || 'Sem opinião hoje (o agente não respondeu).';
      return el('article', { class: 'fundo2', style: 'border:1px solid var(--borda);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0' },
        el('div', { style: 'display:flex;flex-direction:column;gap:2px' }, el('h3', {}, a.nome), el('span', { class: 'sec', style: 'font-size:12px' }, a.papel)),
        ...['BTC', 'ETH', 'SOL'].map((mo) => {
          const [t, c] = OP(a.opinioes && a.opinioes[mo]);
          return el('div', { style: 'display:flex;justify-content:space-between;font-size:13px' }, el('span', { class: 'mono sec' }, mo), el('span', { style: `font-weight:600;color:${c}` }, t));
        }),
        el('button', {
          type: 'button', 'aria-expanded': String(aberto), style: 'min-height:44px;text-align:left;background:transparent;border:1px solid #2E3644;border-radius:8px;color:var(--azul);font-size:12px;padding:0 10px',
          onclick: () => { if (aberto) ui.abertos.delete(a.id); else ui.abertos.add(a.id); redesenhar(); }
        }, aberto ? 'Esconder o porquê' : 'Porquê? (BTC)'),
        aberto && el('p', { style: 'margin:0;font-size:12px;line-height:1.55;color:#B7BFCC;overflow-wrap:anywhere' }, just),
        el('span', { class: 'ter', style: 'font-size:11px' }, a.n_7d
          ? `Acerto: ${pctSem(a.acerto_7d)} a 7 dias (${a.n_7d} leituras) · ${pctSem(a.acerto_14d)} a 14`
          : 'Acerto 7/14 dias: ainda sem leituras avaliadas'));
    })));
}

function secHistorico(d) {
  const C = { decisao: 'var(--sec)', deposito: 'var(--azul)', operacao: 'var(--alta)' };
  const h = d.historico || [];
  return caixa('historico', 'Histórico e operações', null, null,
    h.length ? el('ol', { style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column' }, ...h.map((x) =>
      el('li', { style: 'display:grid;grid-template-columns:56px 14px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #1C222B' },
        el('span', { class: 'mono sec', style: 'font-size:12px;padding-top:1px' }, dataCurta(x.data)),
        el('span', { 'aria-hidden': 'true', style: `width:10px;height:10px;margin-top:4px;border-radius:50%;background:${C[x.tipo] || 'var(--sec)'}` }),
        el('span', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' }, el('span', { style: 'font-size:13px;font-weight:600' }, x.titulo),
          x.detalhe && el('span', { class: 'sec', style: 'font-size:12px' }, x.detalhe)))))
      : el('span', { class: 'sec', style: 'font-size:13px' }, 'Ainda sem histórico.'),
    linkRegistar(d, 'Registar uma operação ou um depósito →'));
}

function secNormal(d) {
  const n = d.normal || {}, q = (n.quedas_v2 || []).filter(fin), qb = (n.quedas_btc || []).filter(fin);
  const c = (t, s) => el('div', { class: 'fundo2', style: 'padding:12px;display:flex;flex-direction:column;gap:4px;min-width:0' },
    el('span', { class: 'mono', style: 'font-size:20px;font-weight:700' }, t), el('span', { class: 'sec', style: 'font-size:12px;line-height:1.4' }, s));
  return caixa('normal', 'O que é normal', 'Do backtest 2013–2023 com estas mesmas regras', null,
    el('div', { style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px' },
      c(q.length ? `${pctSem(Math.max(...q))} a ${pctSem(Math.min(...q))}` : '—', `quedas da v2 nos 3 grandes crashes${qb.length ? ` (o BTC caiu ${pctSem(-Math.max(...qb))}–${pctSem(-Math.min(...qb))})` : ''}`),
      c(fin(n.ordens_ano) ? `~${num(n.ordens_ano, 1)} / ano` : '—', 'ordens esperadas'),
      c(pctSem(n.exposicao_media), 'tempo médio investido em BTC'),
      c('«só BTC» à frente', 'em subidas fortes; a v2 ganha nas quedas')),
    el('span', { class: 'ter', style: 'font-size:12px' }, 'Se a carteira cair 40% numa queda do BTC, isto é o esperado — não um erro.'));
}

// ---------- arranque ----------

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
carregar();
