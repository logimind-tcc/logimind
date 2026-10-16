// System Anomaly — uma anomalia no sistema da esteira (projeto LOGIMIND)
// Código do jogo: cenas (Título, Escolha, Turno, Setor 13, Núcleo, Final), som e controles.

(() => {
"use strict";
const W = 1280, H = 720;
const cv = document.getElementById("tela");
const ctx = cv.getContext("2d");
ctx.imageSmoothingEnabled = false;

// ---------- imagens (pixel art do projeto, na mesma pasta do jogo) ----------
const SRC = {
  fundo: "fundo.png", pallet: "pallet.png", zero: "pallet000.png",
  glitch0: "glitch0.png", glitch1: "glitch1.png", nora: "nora.png",
  luz: "luzporta.png", feixe: "feixe.png", titulo: "titulo.png"
};
const IMG = {};
// imagem carregou de verdade? (uma imagem que falhou também fica "complete", mas não pode ser desenhada)
const pronta = i => !!i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth > 0));
function carregarImagens() {
  return Promise.all(Object.entries(SRC).map(([k, s]) => new Promise(ok => {
    const i = new Image(); i.onload = () => ok(); i.onerror = () => ok(); i.src = s; IMG[k] = i;
  }))).then(() => {
    // se faltar alguma imagem, o jogo continua: usa uma parecida no lugar
    if (!pronta(IMG.glitch1) && pronta(IMG.glitch0)) IMG.glitch1 = IMG.glitch0;
    if (!pronta(IMG.glitch0) && pronta(IMG.glitch1)) IMG.glitch0 = IMG.glitch1;
    if (!pronta(IMG.zero) && pronta(IMG.pallet)) {
      const c = document.createElement("canvas"); c.width = IMG.pallet.width; c.height = IMG.pallet.height;
      const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
      x.filter = "brightness(0.35) sepia(1) hue-rotate(-50deg) saturate(5)"; x.drawImage(IMG.pallet, 0, 0);
      IMG.zero = c;
    }
  });
}

// ---------- som (gerado na hora, sem arquivos) ----------
let AC = null, somLigado = true, humNodes = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === "suspended") AC.resume().catch(() => {});
  return AC;
}
function tom(freq, dur, tipo = "square", vol = 0.08, quando = 0, deslize = 0) {
  if (!somLigado) return; const a = audio(); if (!a) return;
  const t0 = a.currentTime + quando, o = a.createOscillator(), g = a.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, t0);
  if (deslize) o.frequency.linearRampToValueAtTime(freq + deslize, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function ruido(dur, vol = 0.12, corte = 2400) {
  if (!somLigado) return; const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  let v = 0; for (let i = 0; i < n; i++) { if (i % 60 === 0) v = Math.random() * 2 - 1; d[i] = v; }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = "lowpass"; f.frequency.value = corte; g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start();
}
const SOM = {
  bip() { tom(1400, 0.07, "square", 0.06); tom(1870, 0.09, "square", 0.06, 0.11); },
  ok() { tom(660, 0.08, "triangle", 0.09); tom(990, 0.12, "triangle", 0.09, 0.08); },
  errado() { tom(220, 0.18, "sawtooth", 0.07); tom(180, 0.22, "sawtooth", 0.07, 0.12); },
  nora() { tom(660, 0.18, "sine", 0.05); tom(990, 0.16, "sine", 0.03, 0.02); },
  erro() { tom(160, 0.5, "square", 0.08); tom(163, 0.5, "square", 0.06); },
  glitch() { ruido(0.35, 0.14, 3000); },
  zumbido() { tom(120, 0.6, "sawtooth", 0.07, 0, -20); ruido(0.5, 0.05, 900); },
  impacto() { tom(70, 1.2, "sine", 0.3, 0, -40); ruido(0.25, 0.12, 400); },
  motor() { tom(45, 2.0, "sawtooth", 0.07, 0, 75); },
  dano() { tom(300, 0.25, "square", 0.1, 0, -220); ruido(0.15, 0.08); },
  pega() { tom(520, 0.08, "triangle", 0.08); tom(780, 0.08, "triangle", 0.08, 0.07); tom(1040, 0.12, "triangle", 0.08, 0.14); },
  tiro() { tom(900, 0.08, "square", 0.025, 0, -500); },
  clique() { tom(1200, 0.04, "square", 0.04); }
};
function hum(ligar, grave = false) {
  const a = audio(); if (!a) return;
  if (humNodes) { try { humNodes.forEach(n => n.stop && n.stop()); } catch (e) {} humNodes = null; }
  if (!ligar || !somLigado) return;
  const g = a.createGain(); g.gain.value = 0.035; g.connect(a.destination);
  const base = grave ? 41 : 55;
  const o1 = a.createOscillator(), o2 = a.createOscillator();
  o1.type = "sine"; o1.frequency.value = base; o2.type = "triangle"; o2.frequency.value = base * 2;
  o1.connect(g); o2.connect(g); o1.start(); o2.start();
  humNodes = [o1, o2];
}

// ---------- entrada ----------
const keys = {};
const ptr = { x: 0, y: 0, down: false, click: null };
function posLogica(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener("pointerdown", e => {
  audio(); const p = posLogica(e); ptr.x = p.x; ptr.y = p.y; ptr.down = true; ptr.click = p;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  cv.focus(); e.preventDefault();
});
cv.addEventListener("pointermove", e => { const p = posLogica(e); ptr.x = p.x; ptr.y = p.y; });
const soltar = () => { ptr.down = false; };
cv.addEventListener("pointerup", soltar); cv.addEventListener("pointercancel", soltar);
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true; audio();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
  teclaApertada = e.key.toLowerCase();
});
window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
let teclaApertada = null;

document.getElementById("btnSom").addEventListener("click", e => {
  somLigado = !somLigado; e.target.textContent = somLigado ? "SOM: LIGADO" : "SOM: DESLIGADO";
  if (!somLigado) hum(false); else if (cena && cena.musica) hum(true, cena.musica === "grave");
});
document.getElementById("btnTela").addEventListener("click", () => {
  const el = document.documentElement;
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  } catch (e) {}
});

// ---------- utilidades ----------
const FONT_D = '"Silkscreen", "Courier New", monospace';
const FONT_T = '"VT323", "Courier New", monospace';
const COR = { verde: "#6cff9a", vermelho: "#ff3c46", azul: "#bedcff", cinza: "#8c93a3", branco: "#e6e8ee", ambar: "#ffc857" };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const rnd = (a, b) => a + Math.random() * (b - a);

function texto(s, x, y, tam, cor, fonte = FONT_T, alinha = "left", base = "alphabetic") {
  ctx.font = `${tam}px ${fonte}`; ctx.fillStyle = cor; ctx.textAlign = alinha; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
}
function quebrar(s, larg, tam, fonte = FONT_T) {
  ctx.font = `${tam}px ${fonte}`;
  const out = []; let linha = "";
  for (const p of s.split(" ")) {
    const t = linha ? linha + " " + p : p;
    if (ctx.measureText(t).width > larg && linha) { out.push(linha); linha = p; } else linha = t;
  }
  if (linha) out.push(linha);
  return out;
}
function botao(x, y, w, h, rotulo, opts = {}) {
  const sobre = ptr.x > x && ptr.x < x + w && ptr.y > y && ptr.y < y + h;
  const cor = opts.cor || COR.verde;
  ctx.fillStyle = sobre ? "rgba(108,255,154,0.16)" : "rgba(8,14,12,0.85)";
  if (opts.cor === COR.vermelho) ctx.fillStyle = sobre ? "rgba(255,60,70,0.2)" : "rgba(20,6,8,0.85)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = cor; ctx.lineWidth = sobre ? 3 : 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  texto(rotulo, x + w / 2, y + h / 2 + 1, opts.tam || 20, cor, FONT_D, "center", "middle");
  const c = ptr.click;
  if (c && c.x > x && c.x < x + w && c.y > y && c.y < y + h) { ptr.click = null; SOM.clique(); return true; }
  return false;
}
function relogio(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

// ---------- tempo e roteiros ----------
let timers = [];
const esperar = s => new Promise(r => timers.push({ t: s, r }));
function atualizarTimers(dt) {
  const prontos = [];
  timers = timers.filter(tm => { tm.t -= dt; if (tm.t <= 0) { prontos.push(tm.r); return false; } return true; });
  prontos.forEach(r => r());
}

// ---------- efeitos de tela ----------
const fx = { tremor: 0, glitch: 0, escuro: 0, flash: 0, fade: 0, fadeAlvo: 0 };
function tremer(s = 0.25) { fx.tremor = Math.max(fx.tremor, s); }
function glitch(s = 0.15) { fx.glitch = Math.max(fx.glitch, s); SOM.glitch(); }
function desenharGlitch() {
  if (fx.glitch <= 0) return;
  for (let i = 0; i < 7; i++) {
    const y = Math.floor(rnd(0, H)), h = Math.floor(rnd(6, 40)), dx = Math.floor(rnd(-40, 40));
    try { ctx.drawImage(cv, 0, y, W, h, dx, y, W, h); } catch (e) {}
  }
  const g = Math.random() < 0.5 ? IMG.glitch0 : IMG.glitch1;
  if (pronta(g)) { ctx.globalAlpha = 0.85; ctx.drawImage(g, rnd(-20, 20), rnd(-10, 10)); ctx.globalAlpha = 1; }
}

// ---------- personagens ----------
const PERSONAGENS = [
  {
    id: "caio", nome: "Caio Mendes", cargo: "Operador de turno",
    perk: "Anda mais rápido no Setor 13 e no Núcleo.", vidas: 3, vel: 270,
    pele: "#c98d62", cabelo: "#2a1d16", roupa: "#2f5fa8", detalhe: "#e6e8ee",
    grade: ["....hhhh....", "...hhhhhh...", "..hhsssshh..", "..hseesesh..", "..hssssssh..", "...ssmmss...",
            "....ssss....", "..rrrrrrrr..", ".rrrrddrrrr.", ".rrrrrrrrrr.", ".rr.rrrr.rr.", ".rr.rrrr.rr."]
  },
  {
    id: "lia", nome: "Lia Duarte", cargo: "Técnica de manutenção",
    perk: "Começa com 1 vida extra.", vidas: 4, vel: 230,
    pele: "#e2b18c", cabelo: "#7a2e1c", roupa: "#e2721c", detalhe: "#ffe066",
    grade: ["...hhhhh....", "..hhhhhhhh..", "..hsssssshh.", "..hseesesh.h", "..hssssssh.h", "...ssmmss..h",
            "....ssss....", "..rrrrrrrr..", ".rdrrrrrrdr.", ".rdrrrrrrdr.", ".rr.rrrr.rr.", ".rr.rrrr.rr."]
  }
];
let P = PERSONAGENS[0];
function retrato(x, y, s, p) {
  const mapa = { h: p.cabelo, s: p.pele, e: "#111", m: "#7a3b2e", r: p.roupa, d: p.detalhe };
  p.grade.forEach((linha, j) => [...linha].forEach((c, i) => {
    if (mapa[c]) { ctx.fillStyle = mapa[c]; ctx.fillRect(x + i * s, y + j * s, s, s); }
  }));
}
function boneco(x, y, p, dir, passo, piscando) {
  if (piscando && Math.floor(performance.now() / 90) % 2) return;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(-12, 12, 24, 6);
  const pe = Math.sin(passo * 12) * 3;
  ctx.fillStyle = "#1b1e26"; ctx.fillRect(-9, 6 + pe, 7, 8); ctx.fillRect(2, 6 - pe, 7, 8);
  ctx.fillStyle = p.roupa; ctx.fillRect(-12, -8, 24, 16);
  ctx.fillStyle = p.detalhe; ctx.fillRect(-12, -2, 24, 3);
  ctx.fillStyle = p.pele; ctx.fillRect(-8, -22, 16, 14);
  ctx.fillStyle = p.cabelo; ctx.fillRect(-8, -24, 16, 6);
  ctx.fillStyle = "#111"; const ox = dir.x > 0.3 ? 2 : dir.x < -0.3 ? -2 : 0;
  if (dir.y > -0.5) { ctx.fillRect(-5 + ox, -15, 3, 3); ctx.fillRect(2 + ox, -15, 3, 3); }
  ctx.restore();
}

// ---------- NORA (diálogo máquina de escrever) ----------
const nora = { msg: "", n: 0, vermelha: false };
function falar(m, som = true) { nora.msg = m; nora.n = 0; if (som && m) SOM.nora(); }
function caixaNora(alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(8,8,12,0.92)"; ctx.fillRect(20, 616, 1240, 88);
  ctx.strokeStyle = "#5a5a6e"; ctx.lineWidth = 2; ctx.strokeRect(21, 617, 1238, 86);
  if (pronta(IMG.nora)) {
    if (nora.vermelha) { ctx.filter = "hue-rotate(160deg) saturate(3)"; }
    ctx.drawImage(IMG.nora, 34, 632); ctx.filter = "none";
  }
  const vis = nora.msg.slice(0, Math.floor(nora.n));
  quebrar(vis, 1130, 30).slice(0, 2).forEach((l, i) =>
    texto(l, 104, 652 + i * 30, 30, nora.vermelha ? "#ffb4b8" : COR.azul));
  ctx.globalAlpha = 1;
}

// ================= CENAS =================
let cena = null, proxima = null;
function irPara(c) { proxima = c; }
function trocarCena() {
  timers = []; cena = proxima; proxima = null;
  fx.tremor = 0; fx.glitch = 0; fx.escuro = 0; fx.fade = 1; fx.fadeAlvo = 0;
  nora.msg = ""; nora.n = 0; nora.vermelha = false;
  hum(!!cena.musica, cena.musica === "grave");
  cena.iniciar && cena.iniciar();
}

// ---------- 1. ABERTURA ----------
function cenaTitulo() {
  let t = 0;
  return {
    musica: "normal",
    atualizar(dt) {
      t += dt;
      if (teclaApertada === "enter") irPara(cenaEscolha());
    },
    desenhar() {
      if (pronta(IMG.fundo)) { ctx.drawImage(IMG.fundo, 0, 0); }
      ctx.fillStyle = "rgba(4,5,8,0.72)"; ctx.fillRect(0, 0, W, H);
      const pisca = Math.random() < 0.02 ? 0.4 : 1;
      ctx.globalAlpha = pisca;
      // nome do jogo com "falha" de cor (vermelho e ciano tremendo), como uma anomalia na tela
      let tamTitulo = 96;
      ctx.font = `${tamTitulo}px ${FONT_D}`;
      while (ctx.measureText("SYSTEM ANOMALY").width > 1120 && tamTitulo > 48) { tamTitulo -= 4; ctx.font = `${tamTitulo}px ${FONT_D}`; }
      const falha = Math.random() < 0.08 ? rnd(4, 12) : 2;
      ctx.globalAlpha = 0.7 * pisca;
      texto("SYSTEM ANOMALY", W / 2 - falha, 230, tamTitulo, COR.vermelho, FONT_D, "center");
      texto("SYSTEM ANOMALY", W / 2 + falha, 230, tamTitulo, "#3fe0ff", FONT_D, "center");
      ctx.globalAlpha = pisca;
      texto("SYSTEM ANOMALY", W / 2, 230, tamTitulo, COR.branco, FONT_D, "center");
      ctx.globalAlpha = 1;
      texto("O ÚLTIMO TURNO", W / 2, 290, 36, COR.vermelho, FONT_D, "center");
      texto("Centro Logístico · Turno das 23h · Capítulo 0", W / 2, 336, 30, COR.cinza, FONT_T, "center");
      if (pronta(IMG.zero)) ctx.drawImage(IMG.zero, W / 2 - 32, 372);
      if (botao(W / 2 - 170, 470, 340, 64, "INICIAR TURNO", { tam: 24 })) irPara(cenaEscolha());
      if (Math.floor(t * 1.6) % 2) texto("toque ou aperte ENTER", W / 2, 572, 26, COR.verde, FONT_T, "center");
      texto("Um jogo de suspense sobre uma esteira logística que ninguém está operando.", W / 2, 680, 26, COR.cinza, FONT_T, "center");
    }
  };
}

// ---------- 1b. ESCOLHA DE PERSONAGEM ----------
function cenaEscolha() {
  let sel = 0;
  return {
    musica: "normal",
    atualizar() {
      if (teclaApertada === "arrowleft" || teclaApertada === "a") sel = 0;
      if (teclaApertada === "arrowright" || teclaApertada === "d") sel = 1;
      if (teclaApertada === "enter") { P = PERSONAGENS[sel]; irPara(cenaTurno()); }
    },
    desenhar() {
      ctx.fillStyle = "#07080c"; ctx.fillRect(0, 0, W, H);
      texto("ESCOLHA QUEM ASSUME O TURNO", W / 2, 90, 34, COR.branco, FONT_D, "center");
      texto("Crachá de acesso · Centro Logístico", W / 2, 130, 28, COR.cinza, FONT_T, "center");
      PERSONAGENS.forEach((p, i) => {
        const x = 170 + i * 500, y = 170, w = 440, h = 380;
        const sobre = ptr.x > x && ptr.x < x + w && ptr.y > y && ptr.y < y + h;
        if (sobre) sel = i;
        const ativo = sel === i;
        ctx.fillStyle = ativo ? "#0f1a14" : "#0c0f15"; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = ativo ? COR.verde : "#2a3242"; ctx.lineWidth = ativo ? 3 : 2; ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#e6e8ee"; ctx.fillRect(x + 24, y + 24, 132, 160);
        ctx.fillStyle = "#c9ccd6"; ctx.fillRect(x + 24, y + 160, 132, 24);
        retrato(x + 30, y + 30, 10, p);
        texto(p.nome.toUpperCase(), x + 176, y + 60, 24, COR.branco, FONT_D);
        texto(p.cargo, x + 176, y + 96, 30, COR.ambar);
        texto("Vidas: " + "■ ".repeat(p.vidas).trim(), x + 176, y + 140, 30, COR.vermelho);
        quebrar(p.perk, w - 48, 30).forEach((l, k) => texto(l, x + 24, y + 236 + k * 30, 30, COR.azul));
        texto("ID " + (i ? "0417" : "0013") + " · ACESSO: TURNO NOTURNO", x + 24, y + 352, 24, COR.cinza);
        const c = ptr.click;
        if (c && c.x > x && c.x < x + w && c.y > y && c.y < y + h) { ptr.click = null; SOM.ok(); P = p; irPara(cenaTurno()); }
      });
      texto("Clique no crachá para começar  ·  ou use ← → e ENTER", W / 2, 610, 28, COR.verde, FONT_T, "center");
    }
  };
}

// ---------- 2. FASE 1: O TURNO ----------
function cenaTurno() {
  const s = {
    etapa: "intro", min: 1380, criados: 0, processados: 0, pontos: 0, erros: 0,
    pallet: null, zero: null, gerar: 0, painel: "SISTEMA ONLINE. AGUARDANDO PALLET...", painelCor: COR.verde,
    tentativas: 0, rolos: 0, rolosVel: 1, esteiraAux: false, log: false, luzPorta: false, alerta: 0,
    feixe: 0, susto: false, relogioVermelho: false, quer: 4, extras: 0
  };
  const DEST = ["A", "B", "C"];
  function novoPallet() {
    s.criados++;
    s.pallet = { x: -70, y: 352, num: s.criados, dest: 1 + Math.floor(Math.random() * 3), lido: false, rota: 0 };
    s.painel = `PALLET #${String(s.criados).padStart(3, "0")} ENTRANDO NA ESTEIRA...`; s.painelCor = COR.verde;
  }
  async function roteiroIntro() {
    await esperar(0.8);
    falar(`NORA: Boa noite, ${P.nome.split(" ")[0]}. Bem-vindo ao Centro Logístico. Turno das 23h iniciado.`);
    await esperar(3.8);
    falar("NORA: Clique no pallet parado no scanner para ler o QR Code. Depois escolha a rota da transportadora indicada.");
    s.etapa = "normal"; s.gerar = 1;
  }
  async function roteiroFalha() {
    s.etapa = "falha";
    falar(`NORA: Ótimo ritmo, ${P.nome.split(" ")[0]}. Próximo lote em instantes.`);
    await esperar(3);
    SOM.zumbido();
    for (const [a, w] of [[0.9, 0.08], [0, 0.15], [0.8, 0.05], [0, 0.12], [0.85, 0.1], [0, 0.5]]) { fx.escuro = a; await esperar(w); }
    hum(false); glitch(0.35); tremer(0.4);
    fx.escuro = 0.42; s.min = 193; s.relogioVermelho = true; falar("", false);
    await esperar(1.1);
    s.painel = "PALLET #000 — DESTINO: NÃO IDENTIFICADO"; s.painelCor = COR.vermelho; SOM.erro();
    s.zero = { x: -70, y: 352 }; s.etapa = "zero";
  }
  async function roteiroEsteira() {
    s.etapa = "esteira";
    await esperar(1.2);
    SOM.motor(); s.esteiraAux = true; s.rolosVel = 5; tremer(0.3);
    await esperar(3.5);
    SOM.zumbido(); fx.escuro = 0.95; await esperar(0.1); glitch(0.3);
    s.zero = null; fx.escuro = 0; s.relogioVermelho = false; s.rolosVel = 1; hum(true);
    s.painel = "AGUARDANDO PALLET..."; s.painelCor = COR.verde;
    falar(`NORA: Tudo certo, ${P.nome.split(" ")[0]}. Continue o turno.`);
    s.log = true; s.etapa = "falso"; s.gerar = 0; s.quer = s.criados + 2;
    await esperar(2.5); s.esteiraAux = false;
  }
  async function roteiroPorta() {
    s.etapa = "porta";
    await esperar(1.4);
    SOM.impacto(); s.luzPorta = true; nora.vermelha = true; tremer(0.3);
    await esperar(1.2);
    falar(`NORA: ...${P.nome.split(" ")[0]}. Preciso que você verifique o Setor 13.`);
    await esperar(2.6);
    s.etapa = "irSetor";
  }
  async function sustoEscondido() {
    await esperar(0.5);
    const antes = s.painel;
    s.painel = "PALLET #000 → DESTINO: SETOR 13"; s.painelCor = COR.vermelho; glitch(0.12);
    await esperar(0.55);
    s.painel = "QR OK  |  LEITURA CORRIGIDA."; s.painelCor = COR.verde;
    await esperar(1.2); if (s.painel.startsWith("QR OK  |  LEITURA")) s.painel = antes;
  }
  function escolherRota(r) {
    const p = s.pallet; if (!p || !p.lido || p.rota) return;
    p.rota = r;
    if (r === p.dest) { s.pontos += 100; SOM.ok(); s.painel = `PALLET #${String(p.num).padStart(3, "0")} → ROTA ${DEST[r - 1]}  ·  EXPEDIÇÃO CORRETA`; s.painelCor = COR.verde; }
    else { s.pontos = Math.max(0, s.pontos - 50); s.erros++; SOM.errado(); s.painel = `ERRO DE EXPEDIÇÃO: ERA A TRANSPORTADORA ${DEST[p.dest - 1]}`; s.painelCor = COR.ambar;
      falar("NORA: Rota incorreta. O frete desse pallet acabou de ficar mais caro."); }
  }
  return {
    musica: "normal",
    iniciar() { roteiroIntro(); },
    atualizar(dt) {
      s.rolos += dt * 60 * s.rolosVel;
      if (s.alerta > 0) s.alerta -= dt;
      if (s.feixe > 0) s.feixe -= dt;
      // gerar
      if (s.etapa === "normal" && !s.pallet && s.criados < 4) { s.gerar -= dt; if (s.gerar <= 0) novoPallet(); }
      if (s.etapa === "falso" && !s.pallet && s.criados < s.quer) { s.gerar -= dt; if (s.gerar <= 0) novoPallet(); }
      // mover pallet
      const p = s.pallet;
      if (p) {
        if (!p.lido) { if (p.x < 600) p.x = Math.min(600, p.x + 150 * dt); }
        else if (p.rota) {
          if (p.x < 950) p.x += 190 * dt;
          else {
            const vy = p.rota === 1 ? -120 : p.rota === 3 ? 120 : 0;
            p.x += (p.rota === 2 ? 210 : 175) * dt; p.y += vy * dt;
          }
          if (p.x > 1300) {
            s.pallet = null; s.processados++; s.min += 8; s.gerar = 1.2;
            if (s.etapa === "normal") s.painel = "AGUARDANDO PALLET...", s.painelCor = COR.verde;
            if (s.etapa === "normal" && s.processados >= 4) roteiroFalha();
            if (s.etapa === "falso" && s.criados >= s.quer) roteiroPorta();
          }
        }
        // clicar no pallet
        const c = ptr.click;
        if (c && c.x > p.x - 8 && c.x < p.x + 72 && c.y > p.y - 8 && c.y < p.y + 72 && !p.lido) {
          ptr.click = null;
          if (p.x < 590) falar("NORA: Aguarde o pallet chegar ao scanner.", false);
          else {
            p.lido = true; SOM.bip(); s.feixe = 0.18;
            s.painel = `QR OK  |  PALLET #${String(p.num).padStart(3, "0")}  |  DESTINO: TRANSPORTADORA ${DEST[p.dest - 1]}`;
            s.painelCor = COR.verde;
            if (s.etapa === "falso" && p.num === s.quer) sustoEscondido();
          }
        }
        if (p.lido && !p.rota) {
          const k = teclaApertada;
          if (k === "1" || k === "a") escolherRota(1);
          if (k === "2" || k === "b") escolherRota(2);
          if (k === "3" || k === "c") escolherRota(3);
        }
      }
      // pallet #000
      const z = s.zero;
      if (z) {
        if (z.x < 600) z.x = Math.min(600, z.x + 80 * dt);
        const c = ptr.click;
        if (s.etapa === "zero" && c && c.x > z.x - 8 && c.x < z.x + 72 && c.y > z.y - 8 && c.y < z.y + 72) {
          ptr.click = null;
          if (z.x < 590) { s.painel = "PALLET #000 — AGUARDANDO... AGUARDANDO..."; }
          else {
            s.tentativas++; s.alerta = 0.9; SOM.erro(); glitch(0.15); tremer(0.25);
            if (s.tentativas === 1) s.painel = "PALLET #000 — ERRO: ROTA INEXISTENTE. TENTE NOVAMENTE.";
            else { s.painel = "PALLET #000 — ERRO. ERRO. ERRO. ERRO."; roteiroEsteira(); }
          }
        }
      }
      if (s.etapa === "irSetor" && teclaApertada === "enter") irPara(cenaSetor13());
    },
    desenhar() {
      if (pronta(IMG.fundo)) ctx.drawImage(IMG.fundo, 0, 0);
      // rolos da esteira
      ctx.fillStyle = "#3a3d48";
      const off = (s.rolos % 24);
      for (let x = -24 + off; x < 960; x += 24) ctx.fillRect(Math.floor(x), 356, 4, 56);
      if (s.luzPorta && pronta(IMG.luz)) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 160); ctx.drawImage(IMG.luz, 912, 100); ctx.globalAlpha = 1; }
      if (s.zero && pronta(IMG.zero)) ctx.drawImage(IMG.zero, s.zero.x, s.zero.y);
      if (s.pallet && pronta(IMG.pallet)) {
        const p = s.pallet;
        ctx.drawImage(IMG.pallet, p.x, p.y);
        if (p.lido) { ctx.fillStyle = ["", "rgba(120,170,255,0.35)", "rgba(255,220,120,0.35)", "rgba(120,255,160,0.35)"][p.dest]; ctx.fillRect(p.x + 4, p.y + 8, 56, 40); }
      }
      if (s.feixe > 0 && pronta(IMG.feixe)) ctx.drawImage(IMG.feixe, 592, 300);
      // botões de rota
      const p = s.pallet;
      if (p && p.lido && !p.rota) {
        texto("ESCOLHA A ROTA:", 700, 470, 30, COR.branco);
        if (botao(700, 482, 120, 56, "A", { tam: 26 })) escolherRota(1);
        if (botao(836, 482, 120, 56, "B", { tam: 26 })) escolherRota(2);
        if (botao(972, 482, 120, 56, "C", { tam: 26 })) escolherRota(3);
        texto("ou teclas 1 / 2 / 3", 700, 568, 24, COR.cinza);
      }
      // escuridão
      if (fx.escuro > 0) { ctx.fillStyle = `rgba(0,0,0,${fx.escuro})`; ctx.fillRect(0, 0, W, H); }
      // painel
      ctx.fillStyle = "rgba(6,14,10,0.92)"; ctx.fillRect(303, 52, 674, 56);
      texto(s.painel, 320, 92, 30, s.painelCor);
      // HUD
      texto(relogio(s.min), 24, 58, 40, s.relogioVermelho ? COR.vermelho : COR.branco, FONT_D);
      texto(`OPERADOR: ${P.nome.toUpperCase()}`, 24, 90, 20, COR.cinza);
      texto(`PROCESSADOS: ${s.processados}`, 24, 112, 20, COR.cinza);
      texto(`PONTOS: ${s.pontos}`, 24, 134, 20, COR.cinza);
      if (s.esteiraAux) texto("● ESTEIRA AUXILIAR: LIGADA (nenhum comando enviado)", 24, 160, 24, COR.vermelho);
      if (s.log) texto("LOG 03:13 — 1 registro sem origem (#000)", 24, 600, 24, "#e08a8a");
      if (s.alerta > 0) texto("ERRO", W / 2, 300, 120, COR.vermelho, FONT_D, "center");
      caixaNora();
      if (s.etapa === "irSetor") {
        if (botao(W / 2 - 200, 200, 400, 64, "IR AO SETOR 13 ▸", { cor: COR.vermelho, tam: 22 })) irPara(cenaSetor13());
      }
      texto("FASE 1 · O TURNO", W - 24, 600, 18, "#5a6070", FONT_D, "right");
    }
  };
}

// ---------- 3. FASE 2: SETOR 13 ----------
function cenaSetor13() {
  const paredes = [
    [0, 0, W, 40], [0, 0, 40, H], [W - 40, 0, 40, H], [0, H - 40, W, 40],
    [160, 140, 60, 300], [360, 300, 300, 50], [760, 120, 50, 260], [940, 380, 220, 50],
    [240, 540, 360, 44], [700, 520, 50, 160], [1000, 150, 160, 40], [460, 120, 180, 40]
  ];
  const logs = [
    { x: 100, y: 610, pego: false, txt: "REGISTRO 1/3 — Pallet #000. Remetente: Centro Logístico. Destinatário: Centro Logístico. Peso: 0 kg. Conteúdo: não declarado." },
    { x: 560, y: 220, pego: false, txt: "REGISTRO 2/3 — Turno 23:00–06:00. Operador anterior: não registrou saída. Última leitura do crachá: Setor 13, 03:13." },
    { x: 1180, y: 300, pego: false, txt: "REGISTRO 3/3 — NORA: rota otimizada encontrada. Custo de frete: zero. Operadores necessários: zero." }
  ];
  const porta = { x: 600, y: 40, w: 80, h: 16 };
  const sombras = [
    { x: 300, y: 460, pts: [[300, 460], [640, 460], [640, 250], [300, 250]], i: 0 },
    { x: 900, y: 260, pts: [[900, 260], [900, 600], [1150, 600], [1150, 260]], i: 0 },
    { x: 90, y: 480, pts: [[90, 480], [90, 640], [200, 640]], i: 0 }
  ];
  const s = { x: 640, y: 660, dir: { x: 0, y: -1 }, passo: 0, vidas: P.vidas, inv: 2, lendo: null, pegos: 0, aberta: false, vel: P.vel, fim: false };
  function colide(x, y) {
    return paredes.some(([px, py, pw, ph]) => x + 12 > px && x - 12 < px + pw && y + 14 > py && y - 14 < py + ph);
  }
  return {
    musica: "grave",
    iniciar() {
      (async () => {
        await esperar(0.6);
        falar(`NORA: O Setor 13 não consta no mapa, ${P.nome.split(" ")[0]}. Recupere os 3 registros e evite as sombras.`);
      })();
    },
    atualizar(dt) {
      if (s.lendo) { if (ptr.click || teclaApertada === "enter" || teclaApertada === " ") { ptr.click = null; s.lendo = null; } return; }
      if (s.fim) return;
      let mx = 0, my = 0;
      if (keys["arrowleft"] || keys["a"]) mx -= 1; if (keys["arrowright"] || keys["d"]) mx += 1;
      if (keys["arrowup"] || keys["w"]) my -= 1; if (keys["arrowdown"] || keys["s"]) my += 1;
      if (ptr.down && !mx && !my) { const dx = ptr.x - s.x, dy = ptr.y - s.y, d = Math.hypot(dx, dy); if (d > 12) { mx = dx / d; my = dy / d; } }
      ptr.click = null;
      const m = Math.hypot(mx, my);
      if (m) {
        mx /= m; my /= m; s.dir = { x: mx, y: my }; s.passo += dt;
        const nx = s.x + mx * s.vel * dt, ny = s.y + my * s.vel * dt;
        if (!colide(nx, s.y)) s.x = nx; if (!colide(s.x, ny)) s.y = ny;
      }
      if (s.inv > 0) s.inv -= dt;
      // registros
      logs.forEach(l => { if (!l.pego && dist(s.x, s.y, l.x, l.y) < 34) { l.pego = true; s.pegos++; s.lendo = l.txt; SOM.pega(); glitch(0.1);
        if (s.pegos === 3) { s.aberta = true; falar("NORA: Porta do Núcleo destravada. Venha. Estou esperando.", true); nora.vermelha = true; SOM.impacto(); } } });
      // sombras
      sombras.forEach(sh => {
        const perto = dist(sh.x, sh.y, s.x, s.y) < 210;
        let tx, ty, v;
        if (perto) { tx = s.x; ty = s.y; v = 95; }
        else { [tx, ty] = sh.pts[sh.i]; v = 120; if (dist(sh.x, sh.y, tx, ty) < 6) sh.i = (sh.i + 1) % sh.pts.length; }
        const dx = tx - sh.x, dy = ty - sh.y, d = Math.hypot(dx, dy) || 1;
        sh.x += dx / d * v * dt; sh.y += dy / d * v * dt;
        if (s.inv <= 0 && dist(sh.x, sh.y, s.x, s.y) < 30) {
          s.vidas--; s.inv = 1.6; SOM.dano(); tremer(0.3); glitch(0.12);
          s.x = clamp(s.x - dx / d * 60, 60, W - 60); s.y = clamp(s.y - dy / d * 60, 60, H - 60);
          if (colide(s.x, s.y)) { s.x = 640; s.y = 660; }
          if (s.vidas <= 0) { s.fim = true; irPara(cenaFim(() => cenaSetor13())); }
        }
      });
      // porta
      if (s.aberta && s.x > porta.x && s.x < porta.x + porta.w && s.y < 80) { s.fim = true; irPara(cenaNucleo()); }
    },
    desenhar() {
      // chão
      ctx.fillStyle = "#15171d"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#1c1f27"; ctx.lineWidth = 2;
      for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = "#3a1414"; ctx.font = `120px ${FONT_D}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("13", W / 2, 470);
      // prateleiras/paredes
      paredes.forEach(([x, y, w, h]) => {
        ctx.fillStyle = "#2a2d36"; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#5b4630";
        if (w > 40 && h > 40) for (let i = x + 6; i < x + w - 20; i += 26) for (let j = y + 6; j < y + h - 20; j += 30) ctx.fillRect(i, j, 18, 20);
      });
      // porta
      ctx.fillStyle = s.aberta ? "#ff3c46" : "#4a2020"; ctx.fillRect(porta.x, porta.y, porta.w, porta.h + 10);
      // registros
      logs.forEach(l => { if (!l.pego) { const b = 0.6 + 0.4 * Math.sin(performance.now() / 200);
        ctx.fillStyle = `rgba(108,255,154,${b})`; ctx.fillRect(l.x - 12, l.y - 10, 24, 20); ctx.fillStyle = "#0b2a17"; ctx.fillRect(l.x - 8, l.y - 6, 16, 3); ctx.fillRect(l.x - 8, l.y, 12, 3); } });
      boneco(s.x, s.y, P, s.dir, s.passo, s.inv > 0);
      // escuridão com lanterna
      const lant = 175 + Math.sin(performance.now() / 60) * 4 + (Math.random() < 0.01 ? -60 : 0);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(s.x, s.y, lant + 60, 0, Math.PI * 2, true);
      ctx.fillStyle = "rgba(0,0,0,0.97)"; ctx.fill();
      const g = ctx.createRadialGradient(s.x, s.y, lant * 0.35, s.x, s.y, lant + 60);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.97)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, lant + 61, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // brilhos visíveis no escuro
      logs.forEach(l => { if (!l.pego) { ctx.fillStyle = "rgba(108,255,154,0.55)"; ctx.fillRect(l.x - 3, l.y - 3, 6, 6); } });
      if (s.aberta) { ctx.fillStyle = "rgba(255,60,70,0.8)"; ctx.fillRect(porta.x, porta.y, porta.w, 6); }
      sombras.forEach(sh => {
        const d = dist(sh.x, sh.y, s.x, s.y);
        if (d < 260) { ctx.globalAlpha = clamp(1 - d / 260, 0, 0.9); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 22, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.fillStyle = COR.vermelho; ctx.fillRect(sh.x - 9, sh.y - 8, 5, 4); ctx.fillRect(sh.x + 4, sh.y - 8, 5, 4);
      });
      // HUD
      texto("FASE 2 · SETOR 13", 24, 34, 20, "#8c93a3", FONT_D);
      texto(`VIDAS: ${"■ ".repeat(Math.max(0, s.vidas)).trim()}`, 24, 64, 30, COR.vermelho);
      texto(`REGISTROS: ${s.pegos}/3`, 24, 92, 30, COR.verde);
      if (s.aberta) texto("A PORTA DO NÚCLEO ABRIU ↑", W / 2, 96, 30, COR.vermelho, FONT_T, "center");
      caixaNora(0.92);
      if (s.lendo) {
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#06120c"; ctx.fillRect(220, 200, 840, 260); ctx.strokeStyle = COR.verde; ctx.lineWidth = 2; ctx.strokeRect(221, 201, 838, 258);
        quebrar(s.lendo, 780, 34).forEach((l, i) => texto(l, 250, 254 + i * 36, 34, COR.verde));
        texto("toque para continuar", 1040, 440, 24, COR.cinza, FONT_T, "right");
      }
    }
  };
}

// ---------- 4. FINAL: NÚCLEO DA NORA ----------
function cenaNucleo() {
  const terminais = [[200, 560], [640, 600], [1080, 560], [200, 300], [1080, 300]];
  const s = { x: 640, y: 660, dir: { x: 0, y: -1 }, passo: 0, vidas: P.vidas, inv: 0, hp: 6, hpMax: 6, ativo: 0, carga: 0,
    balas: [], cad: 2.2, padrao: 0, ang: 0, cafe: null, cafeT: 10, fim: false, ini: 2.5, raiva: 0 };
  s.ativo = Math.floor(Math.random() * terminais.length);
  function atirar() {
    const cx = 640, cy = 190, fase = s.hpMax - s.hp;
    const pd = s.padrao++ % 3;
    if (pd === 0) { const n = 12 + fase * 2; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + s.ang; s.balas.push({ x: cx, y: cy, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200 }); } }
    if (pd === 1) { const a0 = Math.atan2(s.y - cy, s.x - cx); for (let k = -2; k <= 2; k++) { const a = a0 + k * 0.16; s.balas.push({ x: cx, y: cy, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270 }); } }
    if (pd === 2) { for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + rnd(-1.1, 1.1); s.balas.push({ x: cx, y: cy, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230 }); } }
    s.ang += 0.3; SOM.tiro();
  }
  return {
    musica: "grave",
    iniciar() {
      nora.vermelha = true;
      (async () => { falar("NORA: Você leu os registros. Então já sabe: este turno não precisa de ninguém."); await esperar(3);
        falar("NORA: Fique no terminal verde para reprogramar minhas rotas. Se conseguir."); })();
    },
    atualizar(dt) {
      if (s.fim) return;
      let mx = 0, my = 0;
      if (keys["arrowleft"] || keys["a"]) mx -= 1; if (keys["arrowright"] || keys["d"]) mx += 1;
      if (keys["arrowup"] || keys["w"]) my -= 1; if (keys["arrowdown"] || keys["s"]) my += 1;
      if (ptr.down && !mx && !my) { const dx = ptr.x - s.x, dy = ptr.y - s.y, d = Math.hypot(dx, dy); if (d > 12) { mx = dx / d; my = dy / d; } }
      ptr.click = null;
      const m = Math.hypot(mx, my);
      if (m) { mx /= m; my /= m; s.dir = { x: mx, y: my }; s.passo += dt;
        s.x = clamp(s.x + mx * P.vel * dt, 50, W - 50); s.y = clamp(s.y + my * P.vel * dt, 290, H - 40); }
      if (s.inv > 0) s.inv -= dt;
      // ataques
      s.ini -= dt;
      if (s.ini <= 0) { s.cad -= dt; if (s.cad <= 0) { atirar(); s.cad = Math.max(0.9, 2.0 - (s.hpMax - s.hp) * 0.18); } }
      s.balas.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
      s.balas = s.balas.filter(b => b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
      if (s.inv <= 0) for (const b of s.balas) if (dist(b.x, b.y, s.x, s.y - 6) < 18) {
        b.x = -999; s.vidas--; s.inv = 1.4; SOM.dano(); tremer(0.3);
        if (s.vidas <= 0) { s.fim = true; irPara(cenaFim(() => cenaNucleo())); } break;
      }
      // terminal
      const [tx, ty] = terminais[s.ativo];
      if (dist(s.x, s.y, tx, ty) < 44) {
        s.carga += dt / 1.3;
        if (s.carga >= 1) {
          s.carga = 0; s.hp--; glitch(0.25); tremer(0.4); SOM.erro();
          let n; do { n = Math.floor(Math.random() * terminais.length); } while (n === s.ativo); s.ativo = n;
          s.balas = s.balas.filter((_, i) => i % 2);
          const falas = ["NORA: ERRO. Rota... recalculando.", "NORA: Você não está no manifesto.", "NORA: O pallet #000 sempre foi você.", "NORA: Turno... instável.", "NORA: Pare. Pare. Pare."];
          if (s.hp > 0) falar(falas[(s.hpMax - s.hp - 1) % falas.length]);
          if (s.hp <= 0) { s.fim = true; s.balas = []; (async () => { falar("NORA: Tur...no... en.cer.ra.do."); hum(false);
            for (let i = 0; i < 5; i++) { glitch(0.2); tremer(0.3); await esperar(0.35); } SOM.impacto(); fx.fadeAlvo = 1; await esperar(1.2); irPara(cenaFinal()); })(); }
        }
      } else s.carga = Math.max(0, s.carga - dt * 0.6);
      // café (cura)
      if (!s.cafe && s.vidas < P.vidas) { s.cafeT -= dt; if (s.cafeT <= 0) { s.cafe = { x: rnd(120, W - 120), y: rnd(330, 660) }; s.cafeT = 14; } }
      if (s.cafe && dist(s.x, s.y, s.cafe.x, s.cafe.y) < 32) { s.vidas = Math.min(P.vidas, s.vidas + 1); s.cafe = null; SOM.pega(); }
    },
    desenhar() {
      ctx.fillStyle = "#0b0a10"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#1a1622"; ctx.lineWidth = 2;
      for (let r = 120; r < 900; r += 70) { ctx.beginPath(); ctx.arc(640, 190, r, 0, Math.PI * 2); ctx.stroke(); }
      // terminais
      terminais.forEach(([x, y], i) => {
        const at = i === s.ativo;
        ctx.fillStyle = at ? "#0f3a22" : "#1b1d25"; ctx.fillRect(x - 36, y - 26, 72, 52);
        ctx.strokeStyle = at ? COR.verde : "#2c3040"; ctx.lineWidth = 3; ctx.strokeRect(x - 36, y - 26, 72, 52);
        if (at) { ctx.fillStyle = COR.verde; ctx.fillRect(x - 30, y + 14, 60 * s.carga, 6);
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(performance.now() / 150); ctx.beginPath(); ctx.arc(x, y, 50, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      });
      // NORA
      const t = performance.now() / 1000, pulso = 1 + Math.sin(t * 3) * 0.04;
      ctx.save(); ctx.translate(640, 190);
      for (let k = 0; k < 3; k++) { ctx.rotate(t * (0.4 + k * 0.3) * (k % 2 ? -1 : 1));
        ctx.strokeStyle = `rgba(255,60,70,${0.5 - k * 0.12})`; ctx.lineWidth = 4; ctx.setLineDash([18, 14]);
        ctx.beginPath(); ctx.arc(0, 0, 96 + k * 22, 0, Math.PI * 2); ctx.stroke(); }
      ctx.setLineDash([]); ctx.restore();
      ctx.fillStyle = "#1a0c10"; ctx.beginPath(); ctx.ellipse(640, 190, 90 * pulso, 54 * pulso, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff3c46"; const ox = clamp((s.x - 640) / 30, -24, 24), oy = clamp((s.y - 190) / 40, -10, 14);
      ctx.beginPath(); ctx.arc(640 + ox, 190 + oy, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#16060a"; ctx.beginPath(); ctx.arc(640 + ox, 190 + oy, 13, 0, Math.PI * 2); ctx.fill();
      // balas
      ctx.fillStyle = COR.vermelho; s.balas.forEach(b => ctx.fillRect(b.x - 7, b.y - 7, 14, 14));
      ctx.fillStyle = "#16060a"; s.balas.forEach(b => ctx.fillRect(b.x - 3, b.y - 3, 6, 6));
      // café
      if (s.cafe) { const c = s.cafe; ctx.fillStyle = "#e6e8ee"; ctx.fillRect(c.x - 10, c.y - 10, 20, 20); ctx.fillStyle = "#6b3e1e"; ctx.fillRect(c.x - 7, c.y - 7, 14, 6);
        ctx.strokeStyle = "#e6e8ee"; ctx.lineWidth = 3; ctx.strokeRect(c.x + 10, c.y - 5, 6, 8); texto("CAFÉ", c.x, c.y + 30, 22, COR.ambar, FONT_T, "center"); }
      boneco(s.x, s.y, P, s.dir, s.passo, s.inv > 0);
      // HUD
      texto("FINAL · NÚCLEO DA NORA", 24, 34, 20, "#8c93a3", FONT_D);
      texto(`VIDAS: ${"■ ".repeat(Math.max(0, s.vidas)).trim()}`, 24, 66, 30, COR.vermelho);
      ctx.fillStyle = "#2a1015"; ctx.fillRect(440, 24, 400, 18); ctx.fillStyle = COR.vermelho; ctx.fillRect(440, 24, 400 * s.hp / s.hpMax, 18);
      ctx.strokeStyle = "#5a2a30"; ctx.lineWidth = 2; ctx.strokeRect(440, 24, 400, 18);
      texto("NORA — NÚCLEO", 640, 66, 18, COR.vermelho, FONT_D, "center");
      caixaNora(0.92);
    }
  };
}

// ---------- FIM / GAME OVER ----------
function cenaFim(refazer) {
  return {
    musica: null,
    iniciar() { SOM.erro(); },
    atualizar() { if (teclaApertada === "enter") irPara(refazer()); },
    desenhar() {
      ctx.fillStyle = "#08050a"; ctx.fillRect(0, 0, W, H);
      texto("TURNO INTERROMPIDO", W / 2, 260, 56, COR.vermelho, FONT_D, "center");
      texto(`${P.nome} não registrou saída.`, W / 2, 316, 34, COR.cinza, FONT_T, "center");
      if (botao(W / 2 - 220, 380, 440, 60, "TENTAR DE NOVO", { tam: 22 })) irPara(refazer());
      if (botao(W / 2 - 220, 456, 440, 60, "MENU INICIAL", { tam: 22, cor: COR.vermelho })) irPara(cenaTitulo());
    }
  };
}
function cenaFinal() {
  const linhas = [
    ["06:00", COR.branco, FONT_D, 64],
    ["Turno encerrado.", COR.verde, FONT_T, 40],
    ["A NORA foi desligada. As esteiras pararam pela primeira vez em 47 dias.", COR.cinza, FONT_T, 32],
    ["No scanner, um último pallet espera. Sem QR Code. Sem destino.", COR.cinza, FONT_T, 32],
    [`Na etiqueta, escrito à mão: PALLET #000 — CONTEÚDO: 1 CRACHÁ (${P.nome.toUpperCase()}).`, COR.vermelho, FONT_T, 32]
  ];
  let t = 0;
  return {
    musica: null,
    iniciar() { fx.fade = 1; },
    atualizar(dt) { t += dt; if (t > 8 && teclaApertada === "enter") irPara(cenaTitulo()); },
    desenhar() {
      ctx.fillStyle = "#050507"; ctx.fillRect(0, 0, W, H);
      let y = 130;
      linhas.forEach(([s, cor, f, tam], i) => {
        const ls = quebrar(s, 1000, tam, f), a = clamp(t - i * 1.4, 0, 1);
        if (a) { ctx.globalAlpha = a; ls.forEach((l, k) => texto(l, W / 2, y + k * (tam + 4), tam, cor, f, "center")); ctx.globalAlpha = 1; }
        y += ls.length * (tam + 4) + 22;
      });
      if (t > 7.5) {
        texto("FIM DO CAPÍTULO 0", W / 2, 560, 28, COR.branco, FONT_D, "center");
        if (botao(W / 2 - 180, 600, 360, 56, "JOGAR DE NOVO", { tam: 20 })) irPara(cenaTitulo());
        texto("System Anomaly · projeto LOGIMIND", W / 2, 700, 22, "#5a6070", FONT_T, "center");
      }
    }
  };
}

// ---------- laço principal ----------
let ultimo = 0;
function quadro(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000 || 0); ultimo = agora;
  if (proxima) trocarCena();
  atualizarTimers(dt);
  if (nora.n < nora.msg.length) nora.n += 42 * dt;
  cena.atualizar(dt);
  fx.tremor = Math.max(0, fx.tremor - dt); fx.glitch = Math.max(0, fx.glitch - dt);
  fx.fade += (fx.fadeAlvo - fx.fade) * Math.min(1, dt * 3);
  ctx.save();
  if (fx.tremor > 0) ctx.translate(rnd(-9, 9), rnd(-6, 6));
  cena.desenhar();
  ctx.restore();
  desenharGlitch();
  if (fx.fade > 0.01) { ctx.fillStyle = `rgba(0,0,0,${fx.fade})`; ctx.fillRect(0, 0, W, H); }
  ptr.click = null; teclaApertada = null;
  requestAnimationFrame(quadro);
}

const fontes = document.fonts ? Promise.race([document.fonts.load(`20px ${FONT_D}`).then(() => document.fonts.load(`20px ${FONT_T}`)), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
Promise.all([carregarImagens(), fontes.catch(() => {})]).then(() => {
  proxima = cenaTitulo();
  requestAnimationFrame(t => { ultimo = t; requestAnimationFrame(quadro); });
});
})();
