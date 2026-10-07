// =====================================================================
// LOGIMIND - GÊMEO DIGITAL 3D DA ESTEIRA
// Desenha a maquete em 3D (Three.js) e repete na tela o que a esteira
// de verdade está fazendo: lona andando, sensor, câmera lendo o QR,
// braço levando a caixa até o caminhão A, B ou C.
//
// O painel.js chama as funções de window.Gemeo quando o ESP32 avisa algo:
//   Gemeo.esteira(true/false)     esteira rodando ou parada
//   Gemeo.caixaDetectada()        o sensor viu uma caixa
//   Gemeo.sensorLivre()           a caixa saiu da frente do sensor
//   Gemeo.codigoLido(pedido)      a webcam leu o QR e o painel calculou a saída
//   Gemeo.separar("A")            o braço começou a levar a caixa
//   Gemeo.servos([b, o, c, g])    ângulos reais dos 4 servos (vêm do ESP32)
//   Gemeo.bracoPronto()           o braço terminou
//   Gemeo.config({...})           ângulos calibrados (vêm do ESP32)
//   Gemeo.contagem()              3, 2, 1... "Coloque o pallet"
//   Gemeo.cancelado()             a caixa segue pela esteira sem o braço
//   Gemeo.limparBaias()           tira as caixas dos caminhões
// =====================================================================
(function () {

const vazio = () => {};
const API_VAZIA = {
  pronto: false, esteira: vazio, caixaDetectada: vazio, sensorLivre: vazio, codigoLido: vazio,
  separar: vazio, servos: vazio, bracoPronto: vazio, config: vazio, contagem: vazio,
  cancelado: vazio, limparBaias: vazio, registrar: vazio
};
window.Gemeo = API_VAZIA;

const palco = document.getElementById("gemeoPalco");
if (!palco) return;
const avisoErro = document.getElementById("gemeoErro");
const camadaHolo = document.getElementById("gemeoHolos");
const elContagem = document.getElementById("gemeoContagem");
const linhaTempo = document.getElementById("linhaTempo");
const hud = {
  esteira: document.getElementById("hudEsteira"),
  sensor: document.getElementById("hudSensor"),
  braco: document.getElementById("hudBraco"),
  codigo: document.getElementById("hudCodigo")
};

// ---------- linha do tempo (funciona mesmo sem 3D) ----------
function registrar(texto, tipo = "") {
  if (!linhaTempo) return;
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const li = document.createElement("li");
  li.className = "evento " + tipo;
  li.innerHTML = `<time>${hora}</time><span></span>`;
  li.querySelector("span").textContent = texto;
  const vazio = linhaTempo.querySelector(".vazio");
  if (vazio) vazio.remove();
  linhaTempo.prepend(li);
  while (linhaTempo.children.length > 7) linhaTempo.lastChild.remove();
}
function hudTexto(chave, texto, classe = "") {
  const el = hud[chave];
  if (!el) return;
  el.textContent = texto;
  el.className = classe;
}

// Sem 3D (Three.js não carregou ou o computador não tem WebGL):
// pelo menos a linha do tempo e os chips continuam funcionando.
function apiSem3D() {
  if (avisoErro) avisoErro.hidden = false;
  let rodando = null;
  return Object.assign({}, API_VAZIA, {
    registrar,
    esteira(r) { if (r === rodando) return; rodando = r; hudTexto("esteira", r ? "rodando" : "parada", r ? "ok" : ""); registrar(r ? "Esteira ligada" : "Esteira parada", r ? "ok" : ""); },
    caixaDetectada() { hudTexto("sensor", "caixa detectada", "alerta"); registrar("Sensor detectou um pallet", "alerta"); },
    sensorLivre() { hudTexto("sensor", "livre", ""); },
    codigoLido(p) { hudTexto("codigo", p.pedido, "ok"); registrar(`QR ${p.pedido} lido → ${p.veiculo}, saída ${p.transportadora}`, "ok"); },
    separar(l) { hudTexto("braco", "levando para " + l, "alerta"); registrar(`Braço levando o pallet para a saída ${l}`, "alerta"); },
    bracoPronto() { hudTexto("braco", "pronto", ""); }
  });
}

if (typeof THREE === "undefined") {
  window.Gemeo = apiSem3D();
  return;
}

// =====================================================================
// Cena, câmera e luzes
// =====================================================================
let renderizador;
try {
  renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: false });
} catch (e) {
  window.Gemeo = apiSem3D();
  return;
}
renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderizador.outputEncoding = THREE.sRGBEncoding;
renderizador.shadowMap.enabled = true;
renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
palco.prepend(renderizador.domElement);
renderizador.domElement.className = "gemeo-canvas";

const cena = new THREE.Scene();
cena.background = new THREE.Color(0x070c18);
cena.fog = new THREE.Fog(0x070c18, 150, 290);

const camera = new THREE.PerspectiveCamera(36, 16 / 9, 1, 600);
const alvoCamera = new THREE.Vector3(10, 8, 6);
const orbita = { azimute: 0.55, elevacao: 0.6, distancia: 132 };
function posicionarCamera() {
  const { azimute, elevacao, distancia } = orbita;
  camera.position.set(
    alvoCamera.x + distancia * Math.cos(elevacao) * Math.sin(azimute),
    alvoCamera.y + distancia * Math.sin(elevacao),
    alvoCamera.z + distancia * Math.cos(elevacao) * Math.cos(azimute)
  );
  camera.lookAt(alvoCamera);
}
posicionarCamera();

cena.add(new THREE.HemisphereLight(0x9cc0ff, 0x0b1220, 0.75));
const sol = new THREE.DirectionalLight(0xffffff, 0.9);
sol.position.set(-40, 90, 60);
sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 250 });
cena.add(sol);
const luzAzul = new THREE.PointLight(0x3b82ff, 1.1, 160);
luzAzul.position.set(40, 30, -40);
cena.add(luzAzul);

// ---------- materiais ----------
const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: cor, roughness: 0.55, metalness: 0.25 }, extra));
const M = {
  chao: mat(0x0b1426, { roughness: 0.95, metalness: 0 }),
  metal: mat(0x2b3a5c, { metalness: 0.6, roughness: 0.35 }),
  metalClaro: mat(0x6f86b8, { metalness: 0.7, roughness: 0.3 }),
  escuro: mat(0x111827, { roughness: 0.6 }),
  azul: mat(0x1358e3, { emissive: 0x0b3fa8, emissiveIntensity: 0.35 }),
  neon: new THREE.MeshBasicMaterial({ color: 0x4d8dff }),
  mdf: mat(0xc99a62, { roughness: 0.85, metalness: 0 }),
  servo: mat(0x2453c9, { roughness: 0.4 }),
  borracha: mat(0x1a1f2b, { roughness: 0.9, metalness: 0 })
};
const CORES_SAIDA = { A: 0x4f8cff, B: 0x8b5cf6, C: 0x14b8a6 };

function caixa(l, a, p, material, x = 0, y = 0, z = 0, pai = cena) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  pai.add(m);
  return m;
}
function cilindro(r, h, material, pai = cena, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
  m.castShadow = true;
  m.receiveShadow = true;
  pai.add(m);
  return m;
}

// ---------- chão com grade ----------
const chao = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.chao);
chao.rotation.x = -Math.PI / 2;
chao.receiveShadow = true;
cena.add(chao);
const grade = new THREE.GridHelper(240, 48, 0x1d3b78, 0x13254a);
grade.position.y = 0.05;
cena.add(grade);

// =====================================================================
// Esteira (corre no eixo X, da esquerda para a direita)
// =====================================================================
const ESTEIRA = { inicio: -44, fim: 16, topo: 12.6, largura: 12 };
const comprimento = ESTEIRA.fim - ESTEIRA.inicio;
const meioX = (ESTEIRA.inicio + ESTEIRA.fim) / 2;

caixa(comprimento, 3, 15, M.metal, meioX, 10.4, 0);
[[-40, -6], [-40, 6], [12, -6], [12, 6], [-14, -6], [-14, 6]].forEach(([x, z]) => caixa(2, 9, 2, M.metal, x, 4.5, z));
caixa(comprimento, 0.5, 0.5, M.neon, meioX, 12.2, 7.6);
caixa(comprimento, 0.5, 0.5, M.neon, meioX, 12.2, -7.6);

// lona com listras que andam
const telaLona = document.createElement("canvas");
telaLona.width = 256; telaLona.height = 64;
const ctxLona = telaLona.getContext("2d");
ctxLona.fillStyle = "#151b28"; ctxLona.fillRect(0, 0, 256, 64);
ctxLona.strokeStyle = "#2a3a5e"; ctxLona.lineWidth = 7;
for (let i = -64; i < 320; i += 32) { ctxLona.beginPath(); ctxLona.moveTo(i, 0); ctxLona.lineTo(i + 22, 32); ctxLona.lineTo(i, 64); ctxLona.stroke(); }
const texturaLona = new THREE.CanvasTexture(telaLona);
texturaLona.wrapS = texturaLona.wrapT = THREE.RepeatWrapping;
texturaLona.repeat.set(7, 1);
texturaLona.encoding = THREE.sRGBEncoding;
const lona = caixa(comprimento, 0.6, ESTEIRA.largura, mat(0xffffff, { map: texturaLona, roughness: 0.9, metalness: 0 }), meioX, ESTEIRA.topo - 0.3, 0);

const rolos = [ESTEIRA.inicio, ESTEIRA.fim].map((x) => {
  const r = cilindro(1.7, 13.4, M.metalClaro);
  r.rotation.x = Math.PI / 2;
  r.position.set(x, 11.4, 0);
  return r;
});

// motor na lateral
const motor = cilindro(2.2, 6, M.escuro);
motor.rotation.x = Math.PI / 2;
motor.position.set(ESTEIRA.inicio + 2, 11.4, -10.5);

// ---------- sensor HC-SR04 ----------
const X_SENSOR = 4;
caixa(1, 6, 1, M.metal, X_SENSOR, 15, -9.5);
caixa(6, 3, 1, M.azul, X_SENSOR, 16.5, -8.7);
[-1.4, 1.4].forEach((dx) => {
  const olho = cilindro(1, 1.4, M.metalClaro, cena, 16);
  olho.rotation.x = Math.PI / 2;
  olho.position.set(X_SENSOR + dx, 16.5, -7.9);
});
const matFeixe = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35 });
const feixeSensor = caixa(0.6, 0.6, 15, matFeixe, X_SENSOR, 16.5, -0.3);
feixeSensor.castShadow = false;

// ---------- webcam num suporte ----------
const X_PARADA = 9.5;
// poste ao lado da esteira (antes do braço, para não esconder os caminhões)
caixa(1.6, 44, 1.6, M.metal, X_PARADA - 13, 22, -11);
caixa(13, 1.6, 1.6, M.metal, X_PARADA - 6.5, 43.5, -11);
caixa(1.6, 1.6, 11, M.metal, X_PARADA, 43.5, -5.5);
const corpoCam = caixa(7, 4, 4, M.escuro, X_PARADA, 41, 0);
const lente = cilindro(1.5, 1, M.neon, cena, 20);
lente.position.set(X_PARADA, 38.7, 0);
const matCone = new THREE.MeshBasicMaterial({ color: 0x3b9eff, transparent: true, opacity: 0, depthWrite: false });
const coneCamera = new THREE.Mesh(new THREE.ConeGeometry(7.5, 18, 32, 1, true), matCone);
coneCamera.position.set(X_PARADA, 29.5, 0);
cena.add(coneCamera);
const matScan = new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const linhaScan = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), matScan);
linhaScan.rotation.x = -Math.PI / 2;
linhaScan.position.set(X_PARADA, 21, 0);
cena.add(linhaScan);

// =====================================================================
// Braço (4 servos: base, ombro, cotovelo, garra)
// =====================================================================
const BASE_BRACO = new THREE.Vector3(32, 0, 0);
const L1 = 13, L2 = 13;
const pedestal = cilindro(6.5, 4, M.escuro);
pedestal.position.set(BASE_BRACO.x, 2, BASE_BRACO.z);
const anel = cilindro(6.9, 0.4, M.neon);
anel.position.set(BASE_BRACO.x, 4.1, BASE_BRACO.z);

const torre = new THREE.Group();
torre.position.set(BASE_BRACO.x, 4, BASE_BRACO.z);
cena.add(torre);
caixa(8, 6, 7, M.mdf, 0, 3, 0, torre);
caixa(2.4, 3, 3.6, M.servo, 0, 6.2, 4.2, torre);

const ombro = new THREE.Group();
ombro.position.set(0, 6, 0);
torre.add(ombro);
caixa(2, L1, 1.2, M.mdf, 0, L1 / 2, 2.6, ombro);
caixa(2, L1, 1.2, M.mdf, 0, L1 / 2, -2.6, ombro);
caixa(2.6, 2.6, 6.6, M.servo, 0, 0, 0, ombro);

const cotovelo = new THREE.Group();
cotovelo.position.set(0, L1, 0);
ombro.add(cotovelo);
caixa(1.8, L2, 1.8, M.mdf, 0, L2 / 2, 0, cotovelo);
const pulso = new THREE.Group();
pulso.position.set(0, L2, 0);
cotovelo.add(pulso);
caixa(2.6, 1.6, 8, M.servo, 0, 0.6, 0, pulso);
const dedoA = caixa(1.6, 4.4, 0.8, M.mdf, 0, 3, 3, pulso);
const dedoB = caixa(1.6, 4.4, 0.8, M.mdf, 0, 3, -3, pulso);
const pontaGarra = new THREE.Object3D();
pontaGarra.position.set(0, 3.2, 0);
pulso.add(pontaGarra);

// =====================================================================
// Ângulos: calibração (o ESP32 manda a dele; estes são os padrões)
// =====================================================================
const CAL = {
  esteira: 90, saidas: [40, 130, 170],
  alto: [70, 110], pegar: [115, 75], soltar: [105, 85],
  garra: [40, 100]
};
const servoAtual = [90, 70, 110, 40];
const servoAlvo = [90, 70, 110, 40];

function aplicarServos() {
  const [b, o, c, g] = servoAtual;
  torre.rotation.y = THREE.MathUtils.degToRad(b - CAL.esteira);
  ombro.rotation.z = THREE.MathUtils.degToRad(o - 90);
  const relCotovelo = 66 - (c - CAL.pegar[1]) * 0.743;
  cotovelo.rotation.z = THREE.MathUtils.degToRad(relCotovelo);
  const [ga, gf] = CAL.garra;
  const fechamento = THREE.MathUtils.clamp((g - ga) / ((gf - ga) || 1), 0, 1);
  const meia = THREE.MathUtils.lerp(5.6, 4.5, fechamento);
  dedoA.position.z = meia;
  dedoB.position.z = -meia;
}

// =====================================================================
// Caminhões A, B e C, em volta do braço, no ângulo de cada saída
// =====================================================================
function direcaoDoAngulo(angulo) {
  const psi = THREE.MathUtils.degToRad(angulo - CAL.esteira);
  return new THREE.Vector3(-Math.cos(psi), 0, Math.sin(psi));
}

function etiquetaTexto(texto, cor) {
  const tela = document.createElement("canvas");
  tela.width = 128; tela.height = 128;
  const c = tela.getContext("2d");
  c.fillStyle = "#" + cor.toString(16).padStart(6, "0");
  c.beginPath(); c.roundRect ? c.roundRect(8, 8, 112, 112, 22) : c.rect(8, 8, 112, 112); c.fill();
  c.fillStyle = "#ffffff";
  c.font = "800 78px Sora, Arial, sans-serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(texto, 64, 70);
  const t = new THREE.CanvasTexture(tela);
  t.encoding = THREE.sRGBEncoding;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(7, 7, 1);
  return s;
}

const caminhoes = {};
function criarCaminhao(letra) {
  const cor = CORES_SAIDA[letra];
  const g = new THREE.Group();
  const matCor = mat(cor, { emissive: cor, emissiveIntensity: 0.18 });
  caixa(14, 1.4, 9, M.metal, 0, 2.6, 0, g);          // carroceria
  caixa(14, 3, 0.6, matCor, 0, 4.5, 4.5, g);
  caixa(14, 3, 0.6, matCor, 0, 4.5, -4.5, g);
  caixa(0.6, 3, 9, matCor, -7, 4.5, 0, g);
  caixa(5, 6, 9, matCor, 9.6, 4.6, 0, g);             // cabine
  caixa(0.4, 2.6, 7, mat(0x9fd0ff, { metalness: 0.9, roughness: 0.1 }), 12.2, 5.6, 0, g);
  [[-4.5, 4.8], [-4.5, -4.8], [9, 4.8], [9, -4.8]].forEach(([x, z]) => {
    const r = cilindro(1.6, 1.2, M.borracha, g, 18);
    r.rotation.x = Math.PI / 2;
    r.position.set(x, 1.6, z);
  });
  const placa = etiquetaTexto(letra, cor);
  placa.position.set(0, 14, 0);
  g.add(placa);
  const piso = new THREE.Mesh(new THREE.RingGeometry(10.5, 11.2, 48), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = 0.1;
  g.add(piso);
  cena.add(g);
  return { grupo: g, cor, caixas: [], piso };
}
["A", "B", "C"].forEach((l) => { caminhoes[l] = criarCaminhao(l); });

function posicionarCaminhoes() {
  ["A", "B", "C"].forEach((letra, i) => {
    const d = direcaoDoAngulo(CAL.saidas[i]);
    const c = caminhoes[letra];
    c.grupo.position.copy(BASE_BRACO).addScaledVector(d, 28);
    c.grupo.rotation.y = Math.atan2(-d.z, d.x);  // cabine apontando para fora
  });
}
posicionarCaminhoes();

function pontoCarroceria(letra) {
  const c = caminhoes[letra];
  const n = c.caixas.length;
  const local = new THREE.Vector3(-3.5 + (n % 2) * 6, 3.3 + 3.2 + Math.floor(n / 2) * 6.4, 0);
  return c.grupo.localToWorld(local);
}

// =====================================================================
// Caixa (pallet) com o QR Code
// =====================================================================
function texturaCaixa(codigo) {
  const tela = document.createElement("canvas");
  tela.width = 256; tela.height = 256;
  const c = tela.getContext("2d");
  c.fillStyle = "#d9a86a"; c.fillRect(0, 0, 256, 256);
  c.fillStyle = "#c08a4c"; c.fillRect(0, 0, 256, 34);
  c.fillStyle = "#ffffff"; c.fillRect(64, 58, 128, 128);
  c.fillStyle = "#0b1220";
  // QR "desenhado": 3 cantos + pontos a partir do texto
  [[72, 66], [148, 66], [72, 142]].forEach(([x, y]) => { c.fillRect(x, y, 36, 36); c.fillStyle = "#fff"; c.fillRect(x + 7, y + 7, 22, 22); c.fillStyle = "#0b1220"; c.fillRect(x + 12, y + 12, 12, 12); });
  let semente = 0;
  for (const ch of codigo || "?") semente = (semente * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < 26; i++) {
    semente = (semente * 1103515245 + 12345) >>> 0;
    const x = 112 + (semente % 6) * 9, y = 112 + ((semente >> 8) % 7) * 9;
    c.fillRect(x, y, 8, 8);
  }
  c.fillStyle = "#0b1220";
  c.font = "800 34px Sora, Arial, sans-serif";
  c.textAlign = "center";
  c.fillText(codigo || "?", 128, 228);
  const t = new THREE.CanvasTexture(tela);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

let caixaAtual = null;   // { mesh, estado: "chegando" | "esteira" | "braco" | "caminhao" | "saindo", codigo }
const animacoes = [];    // tweens simples

function criarCaixa(codigo) {
  const textura = texturaCaixa(codigo);
  const lado = mat(0xffffff, { map: textura, roughness: 0.85, metalness: 0 });
  const liso = mat(0xd9a86a, { roughness: 0.9, metalness: 0 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), [liso, liso, lado, liso, lado, liso]);
  m.castShadow = true;
  m.receiveShadow = true;
  cena.add(m);
  return m;
}
function trocarCodigoCaixa(codigo) {
  if (!caixaAtual) return;
  const t = texturaCaixa(codigo);
  caixaAtual.mesh.material[2].map = t;
  caixaAtual.mesh.material[4].map = t;
  caixaAtual.mesh.material[2].needsUpdate = caixaAtual.mesh.material[4].needsUpdate = true;
  caixaAtual.codigo = codigo;
}

function animar(duracao, passo, fim) {
  animacoes.push({ t: 0, duracao, passo, fim });
}
const suave = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// =====================================================================
// Hologramas (etiquetas HTML que seguem um ponto 3D)
// =====================================================================
const holos = [];
function criarHolo(classe, html, ancora, deslocY = 0) {
  const el = document.createElement("div");
  el.className = "holo " + classe;
  el.innerHTML = html;
  camadaHolo.appendChild(el);
  const h = { el, ancora, deslocY };
  holos.push(h);
  return h;
}
function removerHolo(h) {
  if (!h) return;
  h.el.classList.add("saindo");
  setTimeout(() => h.el.remove(), 400);
  const i = holos.indexOf(h);
  if (i >= 0) holos.splice(i, 1);
}
let holoCaixa = null;
const vetorTela = new THREE.Vector3();
function atualizarHolos() {
  const w = palco.clientWidth, hgt = palco.clientHeight;
  holos.forEach((h) => {
    const alvo = typeof h.ancora === "function" ? h.ancora() : h.ancora;
    if (!alvo) return;
    vetorTela.copy(alvo); vetorTela.y += h.deslocY;
    vetorTela.project(camera);
    const x = (vetorTela.x * 0.5 + 0.5) * w;
    const y = (-vetorTela.y * 0.5 + 0.5) * hgt;
    h.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    h.el.style.opacity = vetorTela.z < 1 ? "" : "0";
  });
}
const posCaixa = () => caixaAtual ? caixaAtual.mesh.getWorldPosition(new THREE.Vector3()) : null;

// =====================================================================
// Estado da esteira e eventos
// =====================================================================
let esteiraRodando = false;
let velocidadeLona = 0;
let separando = null;    // { letra, real, inicio, garraFechada, simulacao }
let scanAte = 0;

function esteira(rodando) {
  if (rodando === esteiraRodando) return;
  esteiraRodando = rodando;
  hudTexto("esteira", rodando ? "rodando" : "parada", rodando ? "ok" : "");
  registrar(rodando ? "Esteira ligada" : "Esteira parada", rodando ? "ok" : "");
}

function contagem() {
  if (!elContagem) return;
  let n = 3;
  elContagem.hidden = false;
  const mostrar = () => {
    elContagem.innerHTML = n > 0 ? `<b>${n}</b>` : `<b class="texto">Coloque o pallet</b>`;
    elContagem.classList.remove("pulso"); void elContagem.offsetWidth; elContagem.classList.add("pulso");
    n--;
    if (n >= -1) setTimeout(mostrar, n >= 0 ? 1000 : 1600);
    else elContagem.hidden = true;
  };
  mostrar();
}

function caixaDetectada() {
  hudTexto("sensor", "caixa detectada", "alerta");
  matFeixe.color.set(0xef4444); matFeixe.opacity = 0.75;
  if (caixaAtual && caixaAtual.estado !== "caminhao") {
    removerHolo(holoCaixa);
  } else {
    caixaAtual = { mesh: criarCaixa("?"), estado: "chegando", codigo: "?" };
  }
  const m = caixaAtual.mesh;
  m.position.set(ESTEIRA.inicio + 6, ESTEIRA.topo + 4, 0);
  m.rotation.set(0, 0, 0);
  const x0 = m.position.x;
  animar(1.3, (t) => { m.position.x = x0 + (X_PARADA - x0) * suave(t); }, () => { if (caixaAtual) caixaAtual.estado = "esteira"; });
  holoCaixa = criarHolo("alerta", `<small>SENSOR HC-SR04</small><strong>PALLET DETECTADO</strong><em>aguardando leitura do QR</em>`, posCaixa, 7);
  registrar("Sensor detectou um pallet", "alerta");
}

function sensorLivre() {
  hudTexto("sensor", "livre", "");
  matFeixe.color.set(0x22c55e); matFeixe.opacity = 0.35;
}

function codigoLido(p) {
  const codigo = (p && p.pedido) || "?";
  if (!caixaAtual || caixaAtual.estado === "caminhao") {
    // QR lido sem o sensor ter visto a caixa (ex.: modo demonstração): a caixa aparece na hora
    caixaAtual = { mesh: criarCaixa(codigo), estado: "esteira", codigo };
    caixaAtual.mesh.position.set(X_PARADA, ESTEIRA.topo + 4, 0);
  }
  trocarCodigoCaixa(codigo);
  scanAte = performance.now() + 1600;
  hudTexto("codigo", codigo, "ok");
  removerHolo(holoCaixa);
  const frete = p && p.frete != null ? Number(p.frete).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
  const letra = (p && p.transportadora) || "?";
  holoCaixa = criarHolo("lido saida-" + letra,
    `<small>QR CODE LIDO</small><strong>${codigo}</strong>` +
    `<span class="rota">${p && p.veiculo ? p.veiculo : ""} <i>→</i> saída <b>${letra}</b></span>` +
    (frete ? `<em>frete ${frete}</em>` : ""), posCaixa, 7);
  registrar(`QR ${codigo} lido → ${p && p.veiculo ? p.veiculo + ", " : ""}saída ${letra}`, "ok");
}

// ---------- braço ----------
function poseSequencia(letra) {
  const i = { A: 0, B: 1, C: 2 }[letra] ?? 0;
  const [ga, gf] = CAL.garra;
  const base = CAL.esteira, saida = CAL.saidas[i];
  const A = CAL.alto, P = CAL.pegar, S = CAL.soltar;
  return [
    [base, A[0], A[1], ga],
    [base, P[0], P[1], ga],
    [base, P[0], P[1], gf],
    [base, A[0], A[1], gf],
    [saida, A[0], A[1], gf],
    [saida, S[0], S[1], gf],
    [saida, S[0], S[1], ga],
    [saida, A[0], A[1], ga],
    [base, A[0], A[1], ga]
  ];
}

function separar(letra) {
  letra = String(letra || "").toUpperCase();
  if (!"ABC".includes(letra) || !letra) return;
  separando = { letra, real: false, inicio: performance.now(), garraFechada: false, simulacao: null };
  hudTexto("braco", "levando para " + letra, "alerta");
  registrar(`Braço levando o pallet para a saída ${letra}`, "alerta");
  caminhoes[letra].piso.material.opacity = 1;
  // Se em 0,8 s não chegar nenhum ângulo do ESP32, o 3D simula o movimento
  setTimeout(() => {
    if (separando && separando.letra === letra && !separando.real) iniciarSimulacao(letra);
  }, 800);
}

function iniciarSimulacao(letra) {
  const poses = poseSequencia(letra);
  separando.simulacao = { poses, indice: 0, t: 0 };
}

function servos(lista) {
  if (!Array.isArray(lista) || lista.length < 4) return;
  for (let i = 0; i < 4; i++) servoAlvo[i] = Number(lista[i]) || servoAlvo[i];
  if (separando && !separando.simulacao) separando.real = true;
}

function bracoPronto() {
  const letra = separando && separando.letra;
  // dá tempo da simulação terminar; depois garante a caixa no caminhão
  const fim = () => {
    if (caixaAtual && caixaAtual.estado !== "caminhao" && letra) colocarNoCaminhao(letra, true);
    finalizarSeparacao();
  };
  // (se o 3D estiver simulando, a própria simulação termina sozinha)
  if (!(separando && separando.simulacao)) setTimeout(fim, 400);
}

function finalizarSeparacao() {
  if (!separando) return;
  caminhoes[separando.letra].piso.material.opacity = 0.55;
  separando = null;
  hudTexto("braco", "pronto", "");
}

function pegarCaixa() {
  if (!caixaAtual || (caixaAtual.estado !== "esteira" && caixaAtual.estado !== "chegando")) return;
  caixaAtual.estado = "braco";
  const m = caixaAtual.mesh;
  const de = m.getWorldPosition(new THREE.Vector3());
  pontaGarra.updateWorldMatrix(true, false);
  animar(0.35, (t) => {
    const ate = pontaGarra.getWorldPosition(new THREE.Vector3());
    m.position.lerpVectors(de, ate, suave(t));
  }, () => {
    if (!caixaAtual || caixaAtual.mesh !== m) return;
    pontaGarra.attach(m);
    m.position.set(0, 0, 0);
  });
  removerHolo(holoCaixa);
  holoCaixa = null;
}

function colocarNoCaminhao(letra, rapido = false) {
  if (!caixaAtual) return;
  const m = caixaAtual.mesh;
  cena.attach(m);
  caixaAtual.estado = "caminhao";
  const de = m.position.clone();
  const ate = pontoCarroceria(letra);
  const c = caminhoes[letra];
  c.caixas.push(m);
  if (c.caixas.length > 4) { const velha = c.caixas.shift(); cena.remove(velha); }
  const rotIni = m.rotation.y;
  animar(rapido ? 0.4 : 0.7, (t) => {
    m.position.lerpVectors(de, ate, suave(t));
    m.position.y += Math.sin(t * Math.PI) * 3;
    m.rotation.y = rotIni + (c.grupo.rotation.y - rotIni) * t;
    m.scale.setScalar(1 - 0.25 * suave(t));
  });
  const holoChegou = criarHolo("chegou saida-" + letra, `<strong>Saída ${letra}</strong><em>${caixaAtual.codigo} carregado</em>`, () => c.grupo.position, 20);
  setTimeout(() => removerHolo(holoChegou), 2600);
  registrar(`${caixaAtual.codigo} colocado no caminhão ${letra}`, "ok");
  caixaAtual = null;
}

// liga e desliga a garra a partir do ângulo (real ou simulado)
function conferirGarra() {
  if (!separando) return;
  const [ga, gf] = CAL.garra;
  const meio = (ga + gf) / 2;
  const fechando = gf > ga ? servoAtual[3] > meio : servoAtual[3] < meio;
  if (fechando && !separando.garraFechada) {
    separando.garraFechada = true;
    pegarCaixa();
  } else if (!fechando && separando.garraFechada) {
    separando.garraFechada = false;
    if (caixaAtual && caixaAtual.estado === "braco") colocarNoCaminhao(separando.letra);
  }
}

function cancelado() {
  if (!caixaAtual || caixaAtual.estado === "caminhao") return;
  removerHolo(holoCaixa); holoCaixa = null;
  const m = caixaAtual.mesh;
  caixaAtual.estado = "saindo";
  const x0 = m.position.x;
  animar(1.6, (t) => {
    m.position.x = x0 + (ESTEIRA.fim + 14 - x0) * t;
    if (m.position.x > ESTEIRA.fim + 2) m.position.y = ESTEIRA.topo + 4 - Math.pow(m.position.x - ESTEIRA.fim - 2, 2) * 0.12;
  }, () => { cena.remove(m); });
  registrar("Desvio cancelado: o pallet segue pela esteira", "");
  caixaAtual = null;
}

function limparBaias() {
  Object.values(caminhoes).forEach((c) => { c.caixas.forEach((m) => cena.remove(m)); c.caixas = []; });
  registrar("Expedição limpa: caminhões vazios", "");
}

function config(c) {
  if (!c) return;
  if (Number.isFinite(c.esteira)) CAL.esteira = c.esteira;
  if (Array.isArray(c.saidas) && c.saidas.length === 3) CAL.saidas = c.saidas.map(Number);
  ["alto", "pegar", "soltar", "garra"].forEach((k) => { if (Array.isArray(c[k]) && c[k].length === 2) CAL[k] = c[k].map(Number); });
  posicionarCaminhoes();
}

// =====================================================================
// Girar a cena com o mouse ou o dedo
// =====================================================================
let arrastando = null;
renderizador.domElement.addEventListener("pointerdown", (e) => {
  arrastando = { x: e.clientX, y: e.clientY, az: orbita.azimute, el: orbita.elevacao };
  renderizador.domElement.setPointerCapture(e.pointerId);
  palco.classList.add("mexeu");
});
renderizador.domElement.addEventListener("pointermove", (e) => {
  if (!arrastando) return;
  orbita.azimute = arrastando.az - (e.clientX - arrastando.x) * 0.006;
  orbita.elevacao = THREE.MathUtils.clamp(arrastando.el + (e.clientY - arrastando.y) * 0.004, 0.12, 1.25);
  posicionarCamera();
});
const soltar = () => { arrastando = null; };
renderizador.domElement.addEventListener("pointerup", soltar);
renderizador.domElement.addEventListener("pointercancel", soltar);
renderizador.domElement.addEventListener("wheel", (e) => {
  e.preventDefault();
  orbita.distancia = THREE.MathUtils.clamp(orbita.distancia * (1 + Math.sign(e.deltaY) * 0.08), 70, 200);
  posicionarCamera();
}, { passive: false });

// =====================================================================
// Loop de animação
// =====================================================================
function redimensionar() {
  const w = palco.clientWidth, h = palco.clientHeight;
  if (!w || !h) return;
  renderizador.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 640 ? 48 : 36;
  camera.updateProjectionMatrix();
}
new ResizeObserver(redimensionar).observe(palco);
redimensionar();

let visivel = true;
new IntersectionObserver((e) => { visivel = e[0].isIntersecting; }, { threshold: 0.02 }).observe(palco);

let ultimo = performance.now();
const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;

  // lona e rolos
  velocidadeLona += ((esteiraRodando ? 1 : 0) - velocidadeLona) * Math.min(1, dt * 4);
  texturaLona.offset.x -= velocidadeLona * dt * 0.9;
  rolos.forEach((r) => { r.rotation.y -= velocidadeLona * dt * 4; });

  // simulação do braço (quando o ESP32 não manda ângulos)
  if (separando && separando.simulacao) {
    const s = separando.simulacao;
    s.t += dt;
    const DUR = 0.75;
    if (s.t >= DUR) { s.t = 0; s.indice++; }
    if (s.indice >= s.poses.length) {
      const letraFim = separando.letra;
      separando.simulacao = null;
      if (caixaAtual && caixaAtual.estado !== "caminhao") colocarNoCaminhao(letraFim, true);
      finalizarSeparacao();
    } else {
      const pose = s.poses[s.indice];
      for (let i = 0; i < 4; i++) servoAlvo[i] = pose[i];
    }
  }

  // servos andam até o alvo (suave, igual ao "1 grau por vez" do ESP32)
  const vel = 140 * dt; // graus por segundo
  for (let i = 0; i < 4; i++) {
    const d = servoAlvo[i] - servoAtual[i];
    servoAtual[i] += Math.abs(d) < vel ? d : Math.sign(d) * vel;
  }
  aplicarServos();
  conferirGarra();

  // câmera "escaneando"
  const scan = agora < scanAte;
  matCone.opacity += ((scan ? 0.22 : 0) - matCone.opacity) * Math.min(1, dt * 8);
  matScan.opacity = scan ? 0.55 + 0.3 * Math.sin(agora / 60) : Math.max(0, matScan.opacity - dt * 2);
  linhaScan.position.y = 20.5 + (scan ? (Math.sin(agora / 180) * 0.5 + 0.5) * 9 : 0);
  lente.material.color.setHex(scan ? 0x9fdcff : 0x4d8dff);

  // tweens
  for (let i = animacoes.length - 1; i >= 0; i--) {
    const a = animacoes[i];
    a.t += dt;
    const p = Math.min(1, a.t / a.duracao);
    a.passo(p);
    if (p >= 1) { animacoes.splice(i, 1); if (a.fim) a.fim(); }
  }

  // giro lento da cena quando ninguém mexeu
  if (!arrastando && !palco.classList.contains("mexeu") && !reduzir) {
    orbita.azimute = 0.55 + Math.sin(agora / 9000) * 0.12;
    posicionarCamera();
  }

  // fora da tela: a lógica continua, mas não desenha (economiza o computador)
  if (!visivel) return;
  renderizador.render(cena, camera);
  atualizarHolos();
}
requestAnimationFrame(quadro);

hudTexto("esteira", "parada");
hudTexto("sensor", "livre");
hudTexto("braco", "pronto");
hudTexto("codigo", "—");

window.Gemeo = {
  pronto: true, esteira, caixaDetectada, sensorLivre, codigoLido, separar, servos, bracoPronto,
  config, contagem, cancelado, limparBaias, registrar
};
})();
