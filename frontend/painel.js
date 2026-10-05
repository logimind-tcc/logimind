// Painel da esteira - LOGIMIND
// (Tudo fica dentro de uma função para não misturar os nomes
//  com os do global.js do site. Se misturar, o navegador trava o painel.)
(function () {

// Painel da esteira - LOGIMIND
// A webcam do notebook lê o QR Code da caixa. O site busca o pedido,
// escolhe o caminhão e a transportadora e manda o ESP32 mover o braço.
// Site e ESP32 conversam por MQTT (broker na nuvem).

// Configuração
// Troque "logimind-unasp" por um nome só do grupo, para ninguém mais usar os mesmos tópicos.
const PREFIXO = "logimind-unasp/esteira";
const ENDERECO_BROKER = "wss://broker.hivemq.com:8884/mqtt";

const TOPICO_STATUS  = PREFIXO + "/status";   // ESP32 -> site: estado da esteira e do sensor
const TOPICO_COMANDO = PREFIXO + "/comando";  // site -> ESP32: "ligar", "parar", "desviar:A", "desviar:B", "desviar:C"

// Caminhões
// Do menor para o maior. Carga útil em kg e medidas INTERNAS do baú em cm.
// Valores aproximados.
// Usar os MESMOS valores no código do ESP32.
const VEICULOS = [
  { nome: "VUC",      pesoMax: 3000,  comprimento: 420,  largura: 210, altura: 210 },
  { nome: "3/4",      pesoMax: 4000,  comprimento: 550,  largura: 240, altura: 230 },
  { nome: "Toco",     pesoMax: 6000,  comprimento: 700,  largura: 245, altura: 260 },
  { nome: "Truck",    pesoMax: 12000, comprimento: 850,  largura: 245, altura: 260 },
  { nome: "Carreta",  pesoMax: 30000, comprimento: 1460, largura: 248, altura: 270 },
  { nome: "Bitrem",   pesoMax: 37000, comprimento: 1900, largura: 248, altura: 270 },
  { nome: "Rodotrem", pesoMax: 50000, comprimento: 2500, largura: 248, altura: 270 }
];

// Pedidos de exemplo: usados só na primeira vez que a página abre.
// Depois, os pedidos ficam na planilha de recebimentos (salva no navegador).
// O texto do QR Code é o código do pedido (ex.: "P01").
// Medidas em cm e peso em kg de UM volume.
// Mais para frente, estes dados vão vir do banco MySQL.
const PEDIDOS_INICIAIS = {
  P01: { tipo: "Frágil",   quantidade: 4,  comprimento: 120, largura: 100, altura: 150, pesoUnidade: 300,  empilhavel: false },
  P02: { tipo: "Volumosa", quantidade: 14, comprimento: 120, largura: 100, altura: 180, pesoUnidade: 80,   empilhavel: true  },
  P03: { tipo: "Pesada",   quantidade: 10, comprimento: 120, largura: 100, altura: 100, pesoUnidade: 900,  empilhavel: true  },
  P04: { tipo: "Comum",    quantidade: 26, comprimento: 120, largura: 100, altura: 120, pesoUnidade: 1000, empilhavel: true  },
  P05: { tipo: "Comum",    quantidade: 2,  comprimento: 120, largura: 100, altura: 120, pesoUnidade: 500,  empilhavel: true  },
  P06: { tipo: "Larga",    quantidade: 2,  comprimento: 300, largura: 230, altura: 100, pesoUnidade: 500,  empilhavel: false }
};

// Preço do frete de cada transportadora para cada caminhão (R$).
// O site escolhe a transportadora mais barata para o caminhão escolhido.
const PRECOS = {
  A: { "VUC": 350, "3/4": 430, "Toco": 520, "Truck": 880, "Carreta": 2500, "Bitrem": 3300, "Rodotrem": 4200 },
  B: { "VUC": 380, "3/4": 410, "Toco": 560, "Truck": 850, "Carreta": 2650, "Bitrem": 3200, "Rodotrem": 4400 },
  C: { "VUC": 400, "3/4": 450, "Toco": 540, "Truck": 900, "Carreta": 2450, "Bitrem": 3350, "Rodotrem": 4100 }
};

function escolherTransportadora(caminhao) {
  let melhor = null;
  for (const letra of ["A", "B", "C"]) {
    const preco = PRECOS[letra][caminhao];
    if (melhor === null || preco < melhor.frete) melhor = { transportadora: letra, frete: preco };
  }
  return melhor;
}

// Elementos
const luzConexao     = document.getElementById("luzConexao");
const textoConexao   = document.getElementById("textoConexao");
const estadoEsteira  = document.getElementById("estadoEsteira");
const estadoSensor   = document.getElementById("estadoSensor");
const ultimoPallet   = document.getElementById("ultimoPallet");
const totalCargas    = document.getElementById("totalCargas");
const custoTotal     = document.getElementById("custoTotal");
const corpoHistorico = document.getElementById("corpoHistorico");
const verificacao    = document.getElementById("verificacaoVeiculos");
const botaoLigar     = document.getElementById("botaoLigar");
const botaoParar     = document.getElementById("botaoParar");
const botaoDemo      = document.getElementById("botaoDemo");
const avisoLeitor    = document.getElementById("avisoLeitor");

let contagem = { A: 0, B: 0, C: 0 };
let somaFrete = 0;
let cliente = null;
let modoDemo = false;
let temporizadorDemo = null;
let estavaConectado = false;
let esteiraOnline = false;   // true só quando o ESP32 manda sinal

// Logi: o personagem que conversa por voz com quem opera a esteira.
// Ele fala em voz alta (e mostra a frase embaixo dele) e ouve pelo microfone.
// Não precisa escrever nada: é só falar com ele.
const logiBoneco       = document.getElementById("logiBoneco");
const logiEstado       = document.getElementById("logiEstado");
const legendaLogi      = document.getElementById("legendaLogi");
const voceDisseTexto   = document.getElementById("voceDisseTexto");
const respostasRapidas = document.getElementById("respostasRapidas");
const botaoComecar     = document.getElementById("botaoComecar");
const botaoMicrofone   = document.getElementById("botaoMicrofone");
const textoMicrofone   = document.getElementById("textoMicrofone");
const botaoVoz         = document.getElementById("botaoVoz");
const pedirConfirmacao = document.getElementById("pedirConfirmacao");

let logiAcordado = false;
let somLigado = true;
let contextoSom = null;
let ultimaFalaLogi = "";
let pendente = null;   // pedido esperando a pessoa dizer "pode mandar"

// Muda a cara do Logi: "falando", "ouvindo", "pensando", "feliz" ou "" (normal)
function expressao(nome) {
  logiBoneco.classList.remove("falando", "ouvindo", "pensando", "feliz", "dormindo");
  if (nome) logiBoneco.classList.add(nome);
}

function estado(texto) { logiEstado.textContent = texto; }

function escolherVoz() {
  const vozes = speechSynthesis.getVoices();
  return vozes.find(v => v.lang === "pt-BR") || vozes.find(v => v.lang.startsWith("pt")) || null;
}

function bipe() {
  if (!contextoSom) return;
  const oscilador = contextoSom.createOscillator();
  const volume = contextoSom.createGain();
  oscilador.frequency.value = 880;
  volume.gain.setValueAtTime(0.1, contextoSom.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, contextoSom.currentTime + 0.15);
  oscilador.connect(volume).connect(contextoSom.destination);
  oscilador.start();
  oscilador.stop(contextoSom.currentTime + 0.15);
}

// O Logi fala (e mostra botões de resposta, se tiver)
function logiDiz(texto, respostas = [], depois = "") {
  ultimaFalaLogi = texto;
  legendaLogi.textContent = texto;
  avisoLeitor.textContent = texto;
  mostrarRespostas(respostas);

  const terminar = () => {
    expressao(depois || (microfoneLigado ? "ouvindo" : ""));
    estado(microfoneLigado ? "Estou ouvindo" : "Pronto");
    continuarOuvindo();
  };

  if (!logiAcordado || !somLigado || !("speechSynthesis" in window)) {
    expressao(depois || (microfoneLigado ? "ouvindo" : ""));
    return;
  }
  pararDeOuvir();                 // não ouvir a própria voz
  speechSynthesis.cancel();
  bipe();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 1.05;
  fala.pitch = 1.15;
  const voz = escolherVoz();
  if (voz) fala.voice = voz;
  fala.onstart = () => { expressao("falando"); estado("Falando..."); };
  fala.onend = terminar;
  fala.onerror = terminar;
  speechSynthesis.speak(fala);
}

// Botões de atalho, para quem preferir tocar em vez de falar
function mostrarRespostas(respostas) {
  respostasRapidas.innerHTML = "";
  respostas.forEach((texto, i) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "resposta" + (i === 0 && texto !== "Cancelar" ? " resposta-principal" : "");
    botao.textContent = texto;
    botao.addEventListener("click", () => voceDisse(texto, true));
    respostasRapidas.appendChild(botao);
  });
}

// Primeiro toque: o navegador só deixa falar e ouvir depois que a pessoa toca na tela
function acordarLogi() {
  logiAcordado = true;
  botaoComecar.hidden = true;
  contextoSom = new (window.AudioContext || window.webkitAudioContext)();
  ligarMicrofone();
  logiDiz("Oi, eu sou o Logi! Pode falar comigo. Quando uma caixa passar pela câmera, eu te conto tudo. Se precisar, diga ajuda.");
}

function alternarSom() {
  somLigado = !somLigado;
  botaoVoz.textContent = somLigado ? "Som ligado" : "Som desligado";
  botaoVoz.setAttribute("aria-pressed", somLigado);
  if (!somLigado) { speechSynthesis.cancel(); expressao(microfoneLigado ? "ouvindo" : ""); continuarOuvindo(); }
}

// A pessoa falou (ou tocou num botão de atalho)
function voceDisse(texto, tocou = false) {
  if (!texto.trim()) return;
  voceDisseTexto.textContent = `Você: "${texto}"`;
  mostrarRespostas([]);
  expressao("pensando");
  entender(texto, tocou);
}

// Tira acentos e deixa minúsculo para comparar as palavras
function simplificar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function contem(texto, palavras) {
  return palavras.some(p => texto.includes(p));
}

// Entende o que a pessoa pediu
function entender(textoOriginal, tocou = false) {
  const t = simplificar(textoOriginal);

  // Se estiver no meio de um cadastro, a resposta vai para o cadastro
  if (cadastro) {
    if (contem(t, ["repete", "repetir", "de novo"])) return logiDiz(ultimaFalaLogi, respostasDoPasso());
    if (contem(t, ["cancela", "parar cadastro", "desist"])) {
      cadastro = null;
      return logiDiz("Tudo bem, cancelei o cadastro.");
    }
    return passoCadastro(t);
  }
  if (contem(t, ["cadastr", "novo pedido", "registrar pedido", "adicionar pedido"])) return iniciarCadastro();
  if (codigoNaoEncontrado && !pendente && contem(t, ["nao"])) {
    codigoNaoEncontrado = null;
    return logiDiz("Tudo bem. Vou deixar essa caixa passar.");
  }
  if (contem(t, ["baixar", "exportar", "excel"])) {
    baixarPlanilha("recebimentos");
    return logiDiz("Baixei a planilha de recebimentos. É só abrir no Excel.");
  }
  if (contem(t, ["planilha", "cadastrados", "quantos pedidos faltam", "aguardando"])) {
    const total = Object.keys(pedidos).length;
    const aguardando = Object.values(pedidos).filter(p => p.situacao !== "enviado").length;
    return logiDiz(`A planilha tem ${total} ${total === 1 ? "pedido" : "pedidos"}. ${aguardando} ainda ${aguardando === 1 ? "está" : "estão"} esperando para sair.`);
  }

  if (contem(t, ["repete", "repetir", "de novo", "nao entendi"])) return logiDiz(ultimaFalaLogi, pendente ? respostasPendente() : []);
  if (contem(t, ["por que", "porque", "motivo", "explica"])) return explicarUltimo();
  if (pendente && contem(t, ["cancel", "nao", "espera"])) return cancelarPendente();
  if (pendente && contem(t, ["pode mandar", "manda", "confirm", "sim", "pode", "ok", "isso"])) return confirmarPendente();
  if (contem(t, ["camera"])) { ligarCamera(); return; }
  if (contem(t, ["parar", "para a esteira", "pare", "desligar", "desliga"])) return enviarComando("parar");
  if (contem(t, ["ligar", "liga", "iniciar", "comecar"])) return enviarComando("ligar");
  if (contem(t, ["ultimo", "qual pedido", "que pedido"])) {
    return ultimaCarga ? logiDiz(frasePedido(ultimaCarga)) : logiDiz("Ainda não li nenhum pedido.");
  }
  if (contem(t, ["frete", "quanto", "custo", "gasto"])) return logiDiz(`Até agora o frete total está em ${formatarReais(somaFrete)}.`);
  if (contem(t, ["como esta", "resumo", "status", "quantos", "situacao"])) return logiDiz(resumo());
  if (contem(t, ["ajuda", "o que voce faz", "comando", "o que posso"])) return logiDiz(textoAjuda());
  if (contem(t, ["oi ", "ola", "bom dia", "boa tarde", "boa noite"]) || t.trim() === "oi") return logiDiz("Oi! Estou cuidando da esteira. Quando uma caixa passar pela câmera, eu te conto tudo.", [], "feliz");
  if (contem(t, ["obrigad", "valeu"])) return logiDiz("De nada!", [], "feliz");

  // Com o microfone sempre ligado, ele escuta conversas por perto.
  // Só responde "não entendi" se a pessoa chamou o Logi pelo nome.
  if (!tocou && !t.includes("logi")) {
    voceDisseTexto.textContent = "";
    expressao(microfoneLigado ? "ouvindo" : "");
    return;
  }
  logiDiz("Não entendi. " + textoAjuda(), ["Ajuda", "Como está?"]);
}

function textoAjuda() {
  return "Você pode dizer: cadastrar pedido, pode mandar, cancelar, por quê, repete, ligar esteira, parar esteira, último pedido, frete, planilha ou como está.";
}

function resumo() {
  const total = contagem.A + contagem.B + contagem.C;
  return `A esteira está ${estadoEsteira.textContent.toLowerCase()}. Já separei ${total} ${total === 1 ? "pedido" : "pedidos"}: ` +
         `${contagem.A} na saída A, ${contagem.B} na B e ${contagem.C} na C. O frete total está em ${formatarReais(somaFrete)}.`;
}

// Cadastro de pedido conversando com o Logi
// Ele pergunta uma coisa de cada vez e preenche a planilha sozinho.
let cadastro = null;

const NUMEROS_FALADOS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300,
  quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, mil: 1000
};

// Pega os números de uma frase ("120 por 100 por 150" -> [120, 100, 150])
function numerosDoTexto(t) {
  let texto = t.replace(/(\d),(\d)/g, "$1.$2");
  for (const [palavra, valor] of Object.entries(NUMEROS_FALADOS)) {
    texto = texto.replace(new RegExp(`\\b${palavra}\\b`, "g"), String(valor));
  }
  // "100 e 20" vira 120 (quando a pessoa fala os números por extenso)
  texto = texto.replace(/(\d+) e (\d+)/g, (tudo, a, b) => Number(b) < Number(a) && Number(a) % 10 === 0 ? String(Number(a) + Number(b)) : tudo);
  texto = texto.replace(/(\d+) e (\d+)/g, (tudo, a, b) => Number(b) < Number(a) && Number(a) % 10 === 0 ? String(Number(a) + Number(b)) : tudo);
  return (texto.match(/\d+(\.\d+)?/g) || []).map(Number);
}

const TIPOS = ["Comum", "Frágil", "Pesada", "Volumosa", "Perecível", "Larga"];

function respostasDoPasso() {
  if (!cadastro) return [];
  if (cadastro.passo === "tipo") return TIPOS;
  if (cadastro.passo === "empilha") return ["Sim", "Não"];
  if (cadastro.passo === "confirmar") return ["Salvar", "Cancelar"];
  return ["Cancelar"];
}

function perguntar(texto) {
  logiDiz(texto, respostasDoPasso());
}

function iniciarCadastro() {
  abrirAba("recebimentos");
  cadastro = { passo: "codigo", dados: {} };
  if (codigoNaoEncontrado) {
    cadastro.codigo = codigoNaoEncontrado;
    codigoNaoEncontrado = null;
    cadastro.passo = "tipo";
    return perguntar(`Vamos cadastrar o pedido ${cadastro.codigo}. Que tipo de carga é? Comum, frágil, pesada, volumosa, perecível ou larga?`);
  }
  perguntar("Vamos cadastrar um pedido. Qual é o número dele? Por exemplo, diga sete para o P07.");
}

function passoCadastro(t) {
  const c = cadastro;
  const numeros = numerosDoTexto(t);

  if (c.passo === "codigo") {
    if (!numeros.length) return perguntar("Não entendi o número. Diga só o número do pedido, por exemplo: sete.");
    const codigo = "P" + String(Math.round(numeros[0])).padStart(2, "0");
    if (pedidos[codigo]) return perguntar(`O ${codigo} já está na planilha. Diga outro número.`);
    c.codigo = codigo;
    c.passo = "tipo";
    return perguntar(`Pedido ${codigo}. Que tipo de carga é? Comum, frágil, pesada, volumosa, perecível ou larga?`);
  }

  if (c.passo === "tipo") {
    const tipo = TIPOS.find(x => t.includes(simplificar(x).slice(0, 5)));
    if (!tipo) return perguntar("Não entendi o tipo. Pode ser comum, frágil, pesada, volumosa, perecível ou larga.");
    c.dados.tipo = tipo;
    c.passo = "quantidade";
    return perguntar(`Carga ${tipo.toLowerCase()}. Quantos volumes são?`);
  }

  if (c.passo === "quantidade") {
    if (!numeros.length || numeros[0] < 1) return perguntar("Quantos volumes? Diga só o número.");
    c.dados.quantidade = Math.round(numeros[0]);
    c.passo = "medidas";
    return perguntar(`${c.dados.quantidade} volumes. Qual a medida de cada um, em centímetros? Fale o comprimento, a largura e a altura. Por exemplo: 120 por 100 por 150.`);
  }

  if (c.passo === "medidas") {
    if (numeros.length < 3) return perguntar("Preciso das três medidas: comprimento, largura e altura. Por exemplo: 120 por 100 por 150.");
    [c.dados.comprimento, c.dados.largura, c.dados.altura] = numeros.slice(0, 3).map(Math.round);
    c.passo = "peso";
    return perguntar("Anotei. Quanto pesa cada volume, em quilos?");
  }

  if (c.passo === "peso") {
    if (!numeros.length || numeros[0] <= 0) return perguntar("Quanto pesa cada volume? Diga o número de quilos.");
    c.dados.pesoUnidade = numeros[0];
    c.passo = "empilha";
    return perguntar("Esses volumes podem ser empilhados? Sim ou não?");
  }

  if (c.passo === "empilha") {
    if (contem(t, ["nao", "nunca"])) c.dados.empilhavel = false;
    else if (contem(t, ["sim", "pode", "claro"])) c.dados.empilhavel = true;
    else return perguntar("Pode empilhar? Responda sim ou não.");
    c.passo = "confirmar";
    const p = { ...c.dados, pedido: c.codigo };
    const caminhao = caminhaoIdeal(p);
    const resumoCaminhao = caminhao === "Nenhum"
      ? "Atenção: ele não cabe em nenhum caminhão, vai precisar ser dividido."
      : `Ele vai precisar de um ${caminhao}.`;
    return perguntar(`Vou cadastrar o ${c.codigo}: ${p.quantidade} volumes de carga ${p.tipo.toLowerCase()}, ` +
      `${p.comprimento} por ${p.largura} por ${p.altura} centímetros, ${formatarNumero(p.pesoUnidade)} quilos cada, ` +
      `${p.empilhavel ? "pode empilhar" : "sem empilhar"}. ${resumoCaminhao} Posso salvar?`);
  }

  if (c.passo === "confirmar") {
    if (contem(t, ["salva", "sim", "pode", "confirm", "ok", "isso"])) {
      cadastrarPedido(c.codigo, c.dados);
      cadastro = null;
      return logiDiz(`Pronto! O ${c.codigo} está na planilha de recebimentos. Quando a caixa passar pela câmera, eu já vou reconhecer.`, [], "feliz");
    }
    if (contem(t, ["nao"])) {
      cadastro = null;
      return logiDiz("Tudo bem, não salvei. Se quiser, diga cadastrar pedido para começar de novo.");
    }
    return perguntar("Posso salvar? Responda salvar ou cancelar.");
  }
}

// Microfone: fica ouvindo o tempo todo (funciona no Chrome e no Edge, com internet)
const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
let reconhecedor = null;
let microfoneLigado = false;
let ouvindoAgora = false;

function ligarMicrofone() {
  if (!Reconhecimento) {
    logiDiz("Este navegador não deixa eu ouvir você. Use o Chrome ou o Edge. Enquanto isso, você pode tocar nos botões.");
    return;
  }
  microfoneLigado = true;
  botaoMicrofone.setAttribute("aria-pressed", "true");
  textoMicrofone.textContent = "Microfone ligado";
  continuarOuvindo();
}

function desligarMicrofone() {
  microfoneLigado = false;
  botaoMicrofone.setAttribute("aria-pressed", "false");
  textoMicrofone.textContent = "Microfone desligado";
  pararDeOuvir();
  expressao("");
  estado("Microfone desligado");
}

function alternarMicrofone() {
  if (!logiAcordado) return acordarLogi();
  microfoneLigado ? desligarMicrofone() : ligarMicrofone();
}

function continuarOuvindo() {
  if (!microfoneLigado || ouvindoAgora || speechSynthesis.speaking) return;
  reconhecedor = new Reconhecimento();
  reconhecedor.lang = "pt-BR";
  reconhecedor.continuous = true;
  reconhecedor.interimResults = false;
  reconhecedor.onstart = () => { ouvindoAgora = true; expressao("ouvindo"); estado("Estou ouvindo"); };
  reconhecedor.onresult = (e) => {
    const ultimo = e.results[e.results.length - 1];
    if (ultimo.isFinal) voceDisse(ultimo[0].transcript);
  };
  reconhecedor.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      desligarMicrofone();
      logiDiz("O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço e permita o microfone.");
    } else if (e.error === "network") {
      desligarMicrofone();
      logiDiz("Para eu ouvir você, o computador precisa estar com internet. Enquanto isso, você pode tocar nos botões.");
    } else if (e.error === "audio-capture") {
      desligarMicrofone();
      logiDiz("Não encontrei nenhum microfone. Confira se ele está ligado no computador.");
    }
  };
  reconhecedor.onend = () => {
    ouvindoAgora = false;
    setTimeout(continuarOuvindo, 300);   // o navegador para sozinho de vez em quando; volta a ouvir
  };
  try { reconhecedor.start(); } catch (e) { /* já estava ouvindo */ }
}

function pararDeOuvir() {
  if (reconhecedor) { reconhecedor.onend = () => { ouvindoAgora = false; }; reconhecedor.abort(); }
  reconhecedor = null;
  ouvindoAgora = false;
}

// Caminhões: altura, largura/comprimento, peso e quantidade
// Cada pedido tem: quantidade de volumes (pallets), medidas de UM volume
// (comprimento, largura, altura em cm), peso de UM volume (kg) e se pode empilhar.
// Os volumes podem girar no chão, mas não podem ser tombados.
function pesoTotal(p) { return p.quantidade * p.pesoUnidade; }

function testarVeiculo(p, v) {
  // 1. Altura: o volume passa em pé no baú?
  const alturaOk = p.altura <= v.altura;

  // 2. Largura e comprimento: um volume cabe no chão do baú (de frente ou girado)?
  const cabeDeFrente = p.comprimento <= v.comprimento && p.largura <= v.largura;
  const cabeDeLado   = p.largura <= v.comprimento && p.comprimento <= v.largura;
  const larguraOk    = cabeDeFrente || cabeDeLado;

  // 3. Peso: o total do pedido está dentro da carga máxima?
  const pesoOk = pesoTotal(p) <= v.pesoMax;

  // 4. Quantidade: quantos volumes cabem no baú (chão x camadas)?
  const deFrente = Math.floor(v.comprimento / p.comprimento) * Math.floor(v.largura / p.largura);
  const deLado   = Math.floor(v.comprimento / p.largura)     * Math.floor(v.largura / p.comprimento);
  const noChao   = Math.max(deFrente, deLado);
  const camadas  = !alturaOk ? 0 : (p.empilhavel === false ? 1 : Math.floor(v.altura / p.altura));
  const cabem    = noChao * camadas;
  const quantidadeOk = alturaOk && larguraOk && p.quantidade <= cabem;

  return { alturaOk, larguraOk, pesoOk, quantidadeOk, cabem,
           cabe: alturaOk && larguraOk && pesoOk && quantidadeOk };
}

// Menor caminhão que atende a tudo
function caminhaoIdeal(p) {
  const v = VEICULOS.find(v => testarVeiculo(p, v).cabe);
  return v ? v.nome : "Nenhum";
}

function motivosRecusa(t) {
  const m = [];
  if (!t.alturaOk) m.push("altura");
  if (!t.larguraOk) m.push("largura");
  if (!t.pesoOk) m.push("peso");
  // quantidade só conta como motivo se o volume em si já cabe
  if (t.alturaOk && t.larguraOk && !t.quantidadeOk) m.push("quantidade");
  return m;
}

// Agrupa os caminhões menores que não serviram, por motivo
function recusadosPorMotivo(p) {
  const grupos = { altura: [], largura: [], peso: [], quantidade: [] };
  for (const v of VEICULOS) {
    if (v.nome === p.veiculo) break;
    motivosRecusa(testarVeiculo(p, v)).forEach(m => grupos[m].push(v.nome));
  }
  return grupos;
}

function juntar(lista) {
  return lista.length > 1 ? lista.slice(0, -1).join(", ") + " e " + lista[lista.length - 1] : lista[0];
}

// Texto da coluna "Motivo"
function explicarVeiculo(p) {
  const escolhido = VEICULOS.find(v => v.nome === p.veiculo);
  if (escolhido && !testarVeiculo(p, escolhido).cabe) return `Atenção: o pedido não cabe no ${p.veiculo}.`;
  const g = recusadosPorMotivo(p);
  const partes = [];
  if (g.altura.length)     partes.push(`${juntar(g.altura)}: baú baixo demais`);
  if (g.largura.length)    partes.push(`${juntar(g.largura)}: baú estreito demais`);
  if (g.peso.length)       partes.push(`${juntar(g.peso)}: acima do peso`);
  if (g.quantidade.length) partes.push(`${juntar(g.quantidade)}: não cabe a quantidade`);
  return partes.length ? partes.join(". ") + "." : "Já cabe no menor caminhão.";
}

// Parte "Escolha do caminhão"
const resumoCaminhao = document.getElementById("resumoCaminhao");

// Desenho de caminhão de lado, com o baú proporcional ao comprimento real
function desenhoCaminhao(v) {
  const maior = VEICULOS[VEICULOS.length - 1].comprimento;
  const bau = Math.round(34 + (v.comprimento / maior) * 96);
  const alto = Math.round(26 + (v.altura - 200) / 3);
  const largura = bau + 30;
  const topo = 50 - alto;
  return `
    <svg class="desenho-caminhao" width="${largura}" height="62" viewBox="0 0 ${largura} 62" aria-hidden="true">
      <rect x="1" y="${topo}" width="${bau}" height="${alto}" rx="3" class="bau"/>
      <path d="M${bau + 3} 30 h15 l9 9 v11 h-24 z" class="cabine"/>
      <circle cx="11" cy="54" r="6" class="roda"/>
      <circle cx="${bau - 10}" cy="54" r="6" class="roda"/>
      <circle cx="${bau + 17}" cy="54" r="6" class="roda"/>
    </svg>`;
}

// Uma palavra embaixo de cada caminhão
function veredito(p, v) {
  const t = testarVeiculo(p, v);
  if (v.nome === p.veiculo) return { classe: "escolhido", texto: "escolhido" };
  if (t.cabe) return { classe: "serve", texto: "também cabe" };
  const m = motivosRecusa(t)[0];
  const textos = { altura: "baixo demais", largura: "estreito demais", peso: "peso demais", quantidade: "não cabe tudo" };
  return { classe: "recusado", texto: textos[m] };
}

function mostrarFila(p) {
  verificacao.innerHTML = VEICULOS.map(v => {
    const r = p ? veredito(p, v) : { classe: "", texto: "até " + formatarPeso(v.pesoMax) };
    return `
      <div class="caminhao ${r.classe}">
        ${desenhoCaminhao(v)}
        <p class="caminhao-nome">${v.nome}</p>
        <p class="caminhao-veredito">${r.texto}</p>
      </div>`;
  }).join("");
}

// Baú visto de cima, com as caixas do pedido dentro
function desenhoBau(p, v) {
  const deFrente = { colunas: Math.floor(v.comprimento / p.comprimento), linhas: Math.floor(v.largura / p.largura), cw: p.comprimento, cl: p.largura };
  const deLado   = { colunas: Math.floor(v.comprimento / p.largura), linhas: Math.floor(v.largura / p.comprimento), cw: p.largura, cl: p.comprimento };
  const arranjo = deFrente.colunas * deFrente.linhas >= deLado.colunas * deLado.linhas ? deFrente : deLado;
  const noChao = arranjo.colunas * arranjo.linhas;

  const escala = 440 / v.comprimento;
  const W = 440, H = Math.max(40, Math.round(v.largura * escala));
  const cw = arranjo.cw * escala, cl = arranjo.cl * escala;
  const primeiraCamada = Math.min(p.quantidade, noChao);
  let caixas = "";
  let n = 0;
  for (let c = 0; c < arranjo.colunas; c++) {
    for (let l = 0; l < arranjo.linhas; l++) {
      const cheia = n < primeiraCamada;
      caixas += `<rect x="${(c * cw + 2).toFixed(1)}" y="${(l * cl + 2).toFixed(1)}" width="${(cw - 4).toFixed(1)}" height="${(cl - 4).toFixed(1)}" rx="2" class="${cheia ? "vaga-cheia" : "vaga"}"/>`;
      n++;
    }
  }
  return `
    <svg class="desenho-bau" viewBox="-6 -6 ${W + 40} ${H + 12}" aria-label="Baú do ${v.nome} visto de cima">
      <rect x="-4" y="-4" width="${W + 8}" height="${H + 8}" rx="4" class="bau-contorno"/>
      <g>${caixas}</g>
      <path d="M${W + 8} ${H / 2 - 10} h14 l10 10 l-10 10 h-14 z" class="bau-cabine"/>
    </svg>`;
}

function mostrarVerificacao(p) {
  mostrarFila(p);
  const v = VEICULOS.find(v => v.nome === p.veiculo);
  if (!v) return;
  const t = testarVeiculo(p, v);
  const noChao = Math.max(
    Math.floor(v.comprimento / p.comprimento) * Math.floor(v.largura / p.largura),
    Math.floor(v.comprimento / p.largura) * Math.floor(v.largura / p.comprimento));
  const camadas = noChao ? t.cabem / noChao : 0;
  const sobra = p.quantidade - Math.min(p.quantidade, noChao);

  resumoCaminhao.innerHTML = `
    <div class="resumo-texto">
      <h3>O pedido ${p.pedido} vai de ${v.nome}</h3>
      <p>${explicacaoTexto(p)}</p>
    </div>
    <figure class="resumo-bau">
      ${desenhoBau(p, v)}
      <figcaption>
        Baú do ${v.nome} visto de cima: cabem ${noChao} ${noChao === 1 ? "volume" : "volumes"} no chão${camadas > 1 ? ` e dá para empilhar ${camadas} camadas` : ""}.
        Este pedido tem ${p.quantidade}${sobra > 0 ? `, então ${sobra} ${sobra === 1 ? "vai" : "vão"} em cima` : ""}.
      </figcaption>
    </figure>`;
}

// Conexão MQTT
function conectar() {
  if (typeof mqtt === "undefined") {
    // A biblioteca de conexão não carregou (sem internet?): o resto do painel continua funcionando
    mudarConexao("desligada", "Sem internet para conectar");
    return;
  }
  cliente = mqtt.connect(ENDERECO_BROKER, {
    clientId: "painel-" + Math.random().toString(16).slice(2, 8),
    reconnectPeriod: 3000
  });

  cliente.on("connect", () => {
    mudarConexao("ligada", "Esperando a esteira");
    cliente.subscribe(TOPICO_STATUS);
    
    estavaConectado = true;
  });

  const aoDesconectar = (texto) => {
    mudarConexao("desligada", texto);
    if (estavaConectado) logiDiz("Perdi a conexão com a esteira. Confira se o ESP32 está ligado e no Wi-Fi.");
    estavaConectado = false;
  };
  cliente.on("reconnect", () => aoDesconectar("Reconectando..."));
  cliente.on("offline",   () => aoDesconectar("Desconectado"));
  cliente.on("error",     () => aoDesconectar("Erro na conexão"));

  cliente.on("message", (topico, mensagem) => {
    let dados;
    try { dados = JSON.parse(mensagem.toString()); } catch { return; }
    if (topico === TOPICO_STATUS) atualizarStatus(dados);
  });
}

function mudarConexao(classe, texto) {
  if (modoDemo) return;
  luzConexao.className = "luz " + classe;
  textoConexao.textContent = texto;
  if (classe !== "ligada") mostrarDesconectado();
}

// Sem conexão com o ESP32: botões apagados e situação "sem conexão"
const avisoControles = document.getElementById("avisoControles");
function mostrarDesconectado() {
  if (modoDemo) return;
  botaoLigar.disabled = true;
  botaoParar.disabled = true;
  avisoControles.hidden = false;
  estadoEsteira.textContent = "sem conexão";
  estadoEsteira.className = "apagado";
  estadoSensor.textContent = "sem conexão";
  estadoSensor.className = "apagado";
  esteiraAnterior = null;
}

function enviarComando(comando) {
  if (modoDemo) {
    atualizarStatus({ esteira: comando === "ligar" ? "rodando" : "parada", carga: false });
    return;
  }
  if (cliente && cliente.connected) {
    cliente.publish(TOPICO_COMANDO, comando);
  } else {
    logiDiz("Ainda não estou conectado à esteira, então não consigo mandar esse comando.");
  }
}

// Atualização da tela
// Formato esperado: {"esteira":"rodando"|"parada","carga":true|false}
let esteiraAnterior = null;
let cargaAnterior = false;

function atualizarStatus(dados) {
  // O ESP32 avisa quando desliga (mensagem {"online": false})
  if (dados.online === false) {
    esteiraOnline = false;
    if (!modoDemo) {
      luzConexao.className = "luz desligada";
      textoConexao.textContent = "Esteira desligada";
      mostrarDesconectado();
      logiDiz("A esteira desconectou. Confira se o ESP32 está ligado e no Wi-Fi.");
    }
    return;
  }
  // Chegou sinal do ESP32: a esteira está conectada de verdade
  if (!modoDemo && dados.online === true) esteiraOnline = true;
  if (!modoDemo && esteiraOnline && luzConexao.className !== "luz ligada conectada") {
    luzConexao.className = "luz ligada conectada";
    textoConexao.textContent = "Esteira conectada";
    logiDiz("A esteira está conectada. Já posso controlar o motor e o braço.");
  }
  if (dados.esteira !== undefined) {
    const rodando = dados.esteira === "rodando";
    estadoEsteira.textContent = rodando ? "rodando" : "parada";
    estadoEsteira.className = rodando ? "texto-verde" : "texto-vermelho";
    botaoLigar.disabled = rodando;
    botaoParar.disabled = !rodando;
    avisoControles.hidden = true;
    // Só fala quando alguém liga/para pelo painel (não a cada carga)
    if (esteiraAnterior !== null && esteiraAnterior !== dados.esteira && !dados.carga && !cargaAnterior) {
      logiDiz(rodando ? "Liguei a esteira." : "Parei a esteira.");
    }
    esteiraAnterior = dados.esteira;
  }
  if (dados.carga !== undefined) {
    estadoSensor.textContent = dados.carga ? "viu uma caixa" : "livre";
    estadoSensor.className = dados.carga ? "texto-destaque" : "";
    if (dados.carga && !cargaAnterior) logiDiz("Chegou uma caixa. Parei a esteira para ler o código.");
    cargaAnterior = dados.carga;
  }
}

let ultimaCarga = null;

// Registra o envio na expedição e marca o pedido como enviado
function registrarCarga(c) {
  const letra = (c.transportadora || "").toUpperCase();
  if (!contagem.hasOwnProperty(letra)) return;
  ultimaCarga = c;

  expedicao.unshift({
    data: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    pedido: c.pedido, tipo: c.tipo, quantidade: c.quantidade, pesoTotal: pesoTotal(c),
    caminhao: c.veiculo, transportadora: letra, frete: c.frete
  });
  if (pedidos[c.pedido]) pedidos[c.pedido].situacao = "enviado";
  salvarPlanilha();

  ultimoPallet.textContent = c.pedido;
  mostrarVerificacao(c);
  atualizarTotais();
  mostrarRecebimentos();
  mostrarExpedicao();

  const cartao = document.getElementById("transp" + letra);
  cartao.classList.add("piscando");
  setTimeout(() => cartao.classList.remove("piscando"), 1200);
}

// Contadores das saídas e frete total, calculados pela expedição
function atualizarTotais() {
  contagem = { A: 0, B: 0, C: 0 };
  somaFrete = 0;
  expedicao.forEach(e => { contagem[e.transportadora]++; somaFrete += Number(e.frete) || 0; });
  for (const letra of ["A", "B", "C"]) {
    const cartao = document.getElementById("transp" + letra);
    cartao.querySelector(".quantidade").textContent = contagem[letra];
    cartao.querySelector(".legenda").textContent = contagem[letra] === 1 ? "pedido" : "pedidos";
  }
  const total = expedicao.length;
  totalCargas.textContent = total ? `${total} ${total === 1 ? "pedido separado" : "pedidos separados"},` : "Nenhuma caixa separada ainda.";
  custoTotal.textContent = total ? `${formatarReais(somaFrete)} em frete.` : "";
}

// O que o Logi fala sobre um pedido
function frasePedido(c) {
  return `Li o pedido ${c.pedido}: ${c.quantidade} volumes de ${c.comprimento} por ${c.largura} por ${c.altura} centímetros, ` +
         `${falarPeso(pesoTotal(c))} no total${c.empilhavel === false ? ", e não pode empilhar" : ""}. ` +
         `O menor caminhão que serve é o ${c.veiculo}, e a transportadora mais barata é a ${c.transportadora}, ` +
         `com frete de ${formatarReais(c.frete)}.`;
}

// Explica por que o caminhão foi escolhido
let ultimoAnalisado = null;
function explicacaoTexto(c) {
  const g = recusadosPorMotivo(c);
  const comO = lista => juntar(lista.map(n => "o " + n));
  const plural = (lista, um, varios) => lista.length > 1 ? varios : um;
  const partes = [];
  if (g.altura.length)     partes.push(`${comO(g.altura)} não ${plural(g.altura, "serve", "servem")} porque o baú é baixo demais`);
  if (g.largura.length)    partes.push(`${comO(g.largura)} não ${plural(g.largura, "serve", "servem")} porque a caixa é larga demais`);
  if (g.peso.length)       partes.push(`${comO(g.peso)} não ${plural(g.peso, "aguenta", "aguentam")} o peso`);
  if (g.quantidade.length) partes.push(`${plural(g.quantidade, "no ", "nos ")}${juntar(g.quantidade)} não cabem os ${c.quantidade} volumes`);
  let texto = partes.length
    ? partes.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(". ") + ". "
    : "Ele já cabe no menor caminhão. ";
  texto += `O ${c.veiculo} passa nas quatro condições: altura, largura, peso e quantidade. ` +
           `Entre as transportadoras, a ${c.transportadora} cobra menos por esse caminhão.`;
  return texto;
}

function explicarUltimo() {
  if (!ultimoAnalisado) return logiDiz("Ainda não li nenhum pedido para explicar.");
  logiDiz(explicacaoTexto(ultimoAnalisado), pendente ? respostasPendente() : []);
}

function respostasPendente() {
  return ["Pode mandar", "Por quê?", "Repete", "Cancelar"];
}

function confirmarPendente() {
  const c = pendente;
  pendente = null;
  concluirPedido(c);
  logiDiz(`Certo! Mandei a caixa para a saída ${c.transportadora}.`, [], "feliz");
}

function cancelarPendente() {
  pendente = null;
  if (!modoDemo && cliente && cliente.connected) cliente.publish(TOPICO_COMANDO, "cancelar");
  textoCamera.textContent = "Desvio cancelado.";
  logiDiz("Tudo bem, não vou desviar essa caixa. A esteira vai voltar a andar sem mexer no braço.");
}

// Registra o pedido e manda o ESP32 mover o braço
function concluirPedido(c) {
  registrarCarga(c);
  textoCamera.textContent = `Pedido ${c.pedido} enviado para a saída ${c.transportadora}.`;
  if (!modoDemo) {
    if (cliente && cliente.connected) cliente.publish(TOPICO_COMANDO, "desviar:" + c.transportadora);
    else textoCamera.textContent += " O ESP32 não está conectado, então o braço não foi acionado.";
  }
}

// Quando um QR Code é lido (pela câmera ou no modo demonstração)
const textoCamera = document.getElementById("textoCamera");

function processarCodigo(textoLido) {
  const codigo = textoLido.trim().toUpperCase();
  const dados = pedidos[codigo];
  if (!dados) {
    textoCamera.textContent = `Li "${codigo}", mas esse pedido não está cadastrado.`;
    logiDiz(`Li o código ${codigo}, mas esse pedido não está na planilha de recebimentos. Quer cadastrar agora?`, ["Cadastrar pedido", "Não"]);
    codigoNaoEncontrado = codigo;
    return;
  }

  const pedido = { ...dados, pedido: codigo };
  pedido.veiculo = caminhaoIdeal(pedido);
  if (pedido.veiculo === "Nenhum") {
    textoCamera.textContent = `O pedido ${codigo} não cabe em nenhum caminhão.`;
    logiDiz(`O pedido ${codigo} não cabe em nenhum caminhão. Ele precisa ser dividido em mais de uma viagem.`);
    return;
  }
  Object.assign(pedido, escolherTransportadora(pedido.veiculo));
  ultimoAnalisado = pedido;
  mostrarVerificacao(pedido);
  ultimoPallet.textContent = codigo;

  if (pedirConfirmacao.checked) {
    pendente = pedido;
    textoCamera.textContent = `Li o pedido ${codigo}. Esperando você confirmar a saída ${pedido.transportadora}.`;
    logiDiz(frasePedido(pedido) + ` Posso mandar para a saída ${pedido.transportadora}?`, respostasPendente());
  } else {
    concluirPedido(pedido);
    logiDiz(frasePedido(pedido) + ` Mandei para a saída ${pedido.transportadora}.`, [], "feliz");
  }
}

// Câmera
const video         = document.getElementById("video");
const camadaQR      = document.getElementById("camadaQR");
const cameraVazia   = document.getElementById("cameraVazia");
const botaoCamera   = document.getElementById("botaoCamera");
const escolhaCamera = document.getElementById("escolhaCamera");
const quadro        = document.createElement("canvas");   // cópia da imagem para o leitor de QR
let fluxoCamera = null;
let ultimoCodigo = "";
let horaUltimoCodigo = 0;
let ultimaLeitura = 0;

async function ligarCamera(idCamera) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    textoCamera.textContent = "Este navegador não deixa usar a câmera. Abra o site pelo endereço com https ou pelo Live Server.";
    return;
  }
  if (fluxoCamera) fluxoCamera.getTracks().forEach(t => t.stop());
  try {
    fluxoCamera = await navigator.mediaDevices.getUserMedia({
      video: idCamera ? { deviceId: { exact: idCamera } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (erro) {
    textoCamera.textContent = erro.name === "NotAllowedError"
      ? "O navegador bloqueou a câmera. Clique no cadeado ao lado do endereço e permita a câmera."
      : "Não encontrei nenhuma câmera. Confira se a webcam está ligada no USB.";
    return;
  }
  video.srcObject = fluxoCamera;
  await video.play();
  cameraVazia.hidden = true;
  textoCamera.textContent = "Procurando QR Code...";
  logiDiz("Câmera ligada. Pode passar as caixas.");
  await listarCameras();
  requestAnimationFrame(lerQuadro);
}

// Preenche a lista para escolher a webcam USB (o notebook pode ter duas câmeras)
async function listarCameras() {
  const aparelhos = await navigator.mediaDevices.enumerateDevices();
  const cameras = aparelhos.filter(a => a.kind === "videoinput");
  const atual = fluxoCamera.getVideoTracks()[0].getSettings().deviceId;
  escolhaCamera.innerHTML = cameras.map((c, i) =>
    `<option value="${c.deviceId}" ${c.deviceId === atual ? "selected" : ""}>${c.label || "Câmera " + (i + 1)}</option>`
  ).join("");
  escolhaCamera.hidden = cameras.length < 2;
}

// Lê a imagem da câmera umas 4 vezes por segundo procurando QR Code
function lerQuadro(agora) {
  if (!fluxoCamera || !fluxoCamera.active) return;
  requestAnimationFrame(lerQuadro);
  if (agora - ultimaLeitura < 250 || video.readyState < 2) return;
  ultimaLeitura = agora;

  if (typeof jsQR === "undefined") {
    textoCamera.textContent = "O leitor de QR Code não carregou. Confira a internet e recarregue a página.";
    return;
  }

  const escala = Math.min(1, 640 / video.videoWidth);
  quadro.width = Math.round(video.videoWidth * escala);
  quadro.height = Math.round(video.videoHeight * escala);
  const ctx = quadro.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, quadro.width, quadro.height);
  const imagem = ctx.getImageData(0, 0, quadro.width, quadro.height);
  const resultado = jsQR(imagem.data, quadro.width, quadro.height, { inversionAttempts: "dontInvert" });

  desenharMoldura(resultado);
  if (!resultado || !resultado.data) return;

  // A mesma caixa parada na frente da câmera só conta uma vez.
  // Ela só é lida de novo se sumir da imagem por mais de 3 segundos.
  const codigo = resultado.data.trim().toUpperCase();
  const mesmaCaixa = codigo === ultimoCodigo && Date.now() - horaUltimoCodigo < 3000;
  horaUltimoCodigo = Date.now();
  if (mesmaCaixa) return;
  ultimoCodigo = codigo;
  if (pendente) return;   // ainda esperando a resposta sobre a caixa anterior
  processarCodigo(codigo);
}

// Desenha um quadrado azul em volta do QR Code encontrado
function desenharMoldura(resultado) {
  camadaQR.width = video.clientWidth;
  camadaQR.height = video.clientHeight;
  const ctx = camadaQR.getContext("2d");
  ctx.clearRect(0, 0, camadaQR.width, camadaQR.height);
  if (!resultado) return;

  const s = camadaQR.width / quadro.width;
  const l = resultado.location;
  const pontos = [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner];
  ctx.strokeStyle = "#4f8cff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  pontos.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s));
  ctx.closePath();
  ctx.stroke();

  const texto = resultado.data.trim().toUpperCase();
  ctx.font = "700 16px Inter, Arial, sans-serif";
  const largura = ctx.measureText(texto).width + 16;
  const x = l.topLeftCorner.x * s;
  const y = Math.max(28, l.topLeftCorner.y * s - 8);
  ctx.fillStyle = "#4f8cff";
  ctx.fillRect(x, y - 24, largura, 26);
  ctx.fillStyle = "#fff";
  ctx.fillText(texto, x + 8, y - 6);
}

// Planilha de pedidos (recebimentos e expedição)
// Fica salva no próprio navegador (localStorage). Mais para frente, vai para o MySQL.
const CHAVE_PEDIDOS = "logimind_recebimentos";
const CHAVE_EXPEDICAO = "logimind_expedicao";
let pedidos = {};
let expedicao = [];
let codigoNaoEncontrado = null;
let editando = null;

function carregarPlanilha() {
  try {
    const salvos = JSON.parse(localStorage.getItem(CHAVE_PEDIDOS));
    const enviados = JSON.parse(localStorage.getItem(CHAVE_EXPEDICAO));
    pedidos = salvos || {};
    expedicao = enviados || [];
    if (!salvos) {
      for (const [codigo, dados] of Object.entries(PEDIDOS_INICIAIS)) pedidos[codigo] = { ...dados, situacao: "aguardando" };
    }
  } catch (e) {
    pedidos = {};
    for (const [codigo, dados] of Object.entries(PEDIDOS_INICIAIS)) pedidos[codigo] = { ...dados, situacao: "aguardando" };
    expedicao = [];
  }
}

function salvarPlanilha() {
  try {
    localStorage.setItem(CHAVE_PEDIDOS, JSON.stringify(pedidos));
    localStorage.setItem(CHAVE_EXPEDICAO, JSON.stringify(expedicao));
  } catch (e) { /* navegador sem permissão para salvar: continua funcionando sem guardar */ }
}

// Coloca um pedido na planilha (usado pelo formulário e pelo Logi)
function cadastrarPedido(codigo, dados) {
  const existia = !!pedidos[codigo];
  pedidos[codigo] = { ...dados, situacao: pedidos[codigo] ? pedidos[codigo].situacao : "aguardando" };
  salvarPlanilha();
  mostrarRecebimentos(codigo);
  return existia;
}

const corpoRecebimentos = document.getElementById("corpoRecebimentos");
const formPedido = document.getElementById("formPedido");
const avisoForm = document.getElementById("avisoForm");
const botaoSalvarPedido = document.getElementById("botaoSalvarPedido");
const botaoCancelarEdicao = document.getElementById("botaoCancelarEdicao");

function mostrarRecebimentos(destacar) {
  const codigos = Object.keys(pedidos).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  document.getElementById("contaRecebimentos").textContent = codigos.length;
  if (!codigos.length) {
    corpoRecebimentos.innerHTML = `<tr class="linha-vazia"><td colspan="9">Nenhum pedido cadastrado. Use o formulário ou diga "Logi, cadastrar pedido".</td></tr>`;
    return;
  }
  corpoRecebimentos.innerHTML = codigos.map(codigo => {
    const p = { ...pedidos[codigo], pedido: codigo };
    const caminhao = caminhaoIdeal(p);
    const enviado = p.situacao === "enviado";
    return `
      <tr class="${codigo === destacar ? "linha-nova" : ""}">
        <td><strong>${codigo}</strong></td>
        <td>${p.tipo}</td>
        <td>${p.quantidade}</td>
        <td>${p.comprimento} × ${p.largura} × ${p.altura}</td>
        <td>${formatarPeso(pesoTotal(p))}</td>
        <td>${p.empilhavel === false ? "não" : "sim"}</td>
        <td>${caminhao === "Nenhum" ? "não cabe em nenhum" : caminhao}</td>
        <td><span class="situacao-pedido ${enviado ? "enviado" : "aguardando"}">${enviado ? "enviado" : "aguardando"}</span></td>
        <td><div class="acoes-linha">
          <button type="button" data-editar="${codigo}">Editar</button>
          <button type="button" class="apagar" data-apagar="${codigo}">Apagar</button>
        </div></td>
      </tr>`;
  }).join("");
  if (destacar) setTimeout(() => {
    const linha = corpoRecebimentos.querySelector(".linha-nova");
    if (linha) linha.classList.remove("linha-nova");
  }, 1500);
}

function mostrarExpedicao() {
  document.getElementById("contaExpedicao").textContent = expedicao.length;
  if (!expedicao.length) {
    corpoHistorico.innerHTML = `<tr class="linha-vazia"><td colspan="6">Nenhum pedido enviado ainda. Assim que uma caixa sair pela esteira, ela aparece aqui.</td></tr>`;
    return;
  }
  corpoHistorico.innerHTML = expedicao.map(e => `
    <tr>
      <td>${e.data}</td>
      <td><strong>${e.pedido}</strong></td>
      <td>${e.quantidade} × ${e.tipo.toLowerCase()}, ${formatarPeso(e.pesoTotal)}</td>
      <td>${e.caminhao}</td>
      <td><span class="etiqueta etiqueta-${e.transportadora}">${e.transportadora}</span></td>
      <td>${formatarReais(e.frete)}</td>
    </tr>`).join("");
}

// Formulário
function avisar(texto, tipo = "") {
  avisoForm.textContent = texto;
  avisoForm.className = "aviso-form " + tipo;
}

function lerFormulario() {
  const f = new FormData(formPedido);
  let codigo = String(f.get("codigo") || "").trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d+$/.test(codigo)) codigo = "P" + codigo.padStart(2, "0");
  return {
    codigo,
    dados: {
      tipo: f.get("tipo"),
      quantidade: parseInt(f.get("quantidade"), 10),
      comprimento: parseInt(f.get("comprimento"), 10),
      largura: parseInt(f.get("largura"), 10),
      altura: parseInt(f.get("altura"), 10),
      pesoUnidade: parseFloat(f.get("pesoUnidade")),
      empilhavel: f.get("empilhavel") === "on"
    }
  };
}

formPedido.addEventListener("submit", (e) => {
  e.preventDefault();
  const { codigo, dados } = lerFormulario();
  if (!codigo) return avisar("Preencha o código do pedido.", "erro");
  if (!editando && pedidos[codigo]) return avisar(`Já existe um pedido ${codigo}. Use "Editar" na tabela para mudar.`, "erro");
  if (editando && editando !== codigo) delete pedidos[editando];
  cadastrarPedido(codigo, dados);
  const caminhao = caminhaoIdeal({ ...dados, pedido: codigo });
  avisar(editando ? `Pedido ${codigo} atualizado.` : `Pedido ${codigo} cadastrado. Ele vai de ${caminhao}.`, "ok");
  sairDaEdicao();
});

corpoRecebimentos.addEventListener("click", (e) => {
  const editar = e.target.dataset.editar;
  const apagar = e.target.dataset.apagar;
  if (editar) {
    const p = pedidos[editar];
    editando = editar;
    formPedido.codigo.value = editar;
    formPedido.tipo.value = p.tipo;
    formPedido.quantidade.value = p.quantidade;
    formPedido.comprimento.value = p.comprimento;
    formPedido.largura.value = p.largura;
    formPedido.altura.value = p.altura;
    formPedido.pesoUnidade.value = p.pesoUnidade;
    formPedido.empilhavel.checked = p.empilhavel !== false;
    botaoSalvarPedido.textContent = "Salvar alterações";
    botaoCancelarEdicao.hidden = false;
    avisar(`Editando o pedido ${editar}.`);
    formPedido.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (apagar && confirm(`Apagar o pedido ${apagar} da planilha?`)) {
    delete pedidos[apagar];
    salvarPlanilha();
    mostrarRecebimentos();
    avisar(`Pedido ${apagar} apagado.`);
  }
});

function sairDaEdicao() {
  editando = null;
  formPedido.reset();
  botaoSalvarPedido.textContent = "Cadastrar pedido";
  botaoCancelarEdicao.hidden = true;
}
botaoCancelarEdicao.addEventListener("click", () => { sairDaEdicao(); avisar(""); });

// Abas
document.querySelectorAll(".aba").forEach(aba => aba.addEventListener("click", () => abrirAba(aba.dataset.aba)));
function abrirAba(nome) {
  document.querySelectorAll(".aba").forEach(a => {
    const ativa = a.dataset.aba === nome;
    a.classList.toggle("ativa", ativa);
    a.setAttribute("aria-selected", ativa);
  });
  document.getElementById("abaRecebimentos").hidden = nome !== "recebimentos";
  document.getElementById("abaExpedicao").hidden = nome !== "expedicao";
}

// Baixar para o Excel (arquivo .csv, que o Excel abre direto)
function baixarPlanilha(qual) {
  let linhas;
  if (qual === "recebimentos") {
    linhas = [["Código", "Tipo", "Volumes", "Comprimento (cm)", "Largura (cm)", "Altura (cm)", "Peso de cada (kg)", "Peso total (kg)", "Empilha", "Caminhão", "Situação"]];
    for (const [codigo, p] of Object.entries(pedidos)) {
      const pedido = { ...p, pedido: codigo };
      linhas.push([codigo, p.tipo, p.quantidade, p.comprimento, p.largura, p.altura, p.pesoUnidade, pesoTotal(pedido),
                   p.empilhavel === false ? "não" : "sim", caminhaoIdeal(pedido), p.situacao]);
    }
  } else {
    linhas = [["Data e hora", "Pedido", "Tipo", "Volumes", "Peso total (kg)", "Caminhão", "Transportadora", "Frete (R$)"]];
    expedicao.forEach(e => linhas.push([e.data, e.pedido, e.tipo, e.quantidade, e.pesoTotal, e.caminhao, e.transportadora, e.frete]));
  }
  const texto = linhas.map(l => l.map(v => {
    let s = typeof v === "number" ? String(v).replace(".", ",") : String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\r\n");
  const arquivo = new Blob(["\ufeff" + texto], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(arquivo);
  link.download = `logimind-${qual}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
document.querySelectorAll("[data-baixar]").forEach(b => b.addEventListener("click", () => baixarPlanilha(b.dataset.baixar)));

document.getElementById("botaoLimparExpedicao").addEventListener("click", () => {
  if (!confirm("Apagar todo o histórico de expedição?")) return;
  expedicao = [];
  Object.values(pedidos).forEach(p => p.situacao = "aguardando");
  salvarPlanilha();
  atualizarTotais();
  mostrarRecebimentos();
  mostrarExpedicao();
});

// Formatação
function formatarNumero(n) { return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 }); }
function formatarPeso(p) { return p >= 1000 ? formatarNumero(p / 1000) + " t" : formatarNumero(p) + " kg"; }
function falarPeso(p) {
  if (p >= 1000) return formatarNumero(p / 1000) + (p === 1000 ? " tonelada" : " toneladas");
  return formatarNumero(p) + " quilos";
}
function formatarMedidas(c) { return `${c.comprimento} × ${c.largura} × ${c.altura} cm`; }
function formatarMedidasBau(v) { return `${formatarNumero(v.comprimento / 100)} × ${formatarNumero(v.largura / 100)} × ${formatarNumero(v.altura / 100)} m`; }
function formatarReais(v) { return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function falarReais(v) {
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);
  return centavos ? `${reais} reais e ${centavos} centavos` : `${reais} reais`;
}

// Modo demonstração
// Simula a esteira para testar o site sem o protótipo e sem câmera.
// Ele "lê" os códigos da base em sequência, igual a câmera faria.
let indiceExemplo = 0;

function alternarDemo() {
  modoDemo = !modoDemo;
  if (modoDemo) {
    luzConexao.className = "luz demo";
    textoConexao.textContent = "Demonstração";
    botaoDemo.textContent = "Parar demonstração";
    logiDiz("Comecei o modo demonstração. Vou fingir que as caixas estão passando.");
    atualizarStatus({ esteira: "rodando", carga: false });
    // intervalo longo para dar tempo da voz terminar de falar
    temporizadorDemo = setInterval(simularCarga, 9000);
    simularCarga();
  } else {
    clearInterval(temporizadorDemo);
    botaoDemo.textContent = "Modo demonstração";
    logiDiz("Parei o modo demonstração.");
    if (esteiraOnline) {
      luzConexao.className = "luz ligada conectada";
      textoConexao.textContent = "Esteira conectada";
    } else {
      const servidor = cliente && cliente.connected;
      luzConexao.className = "luz " + (servidor ? "ligada" : "desligada");
      textoConexao.textContent = servidor ? "Esperando a esteira" : "Desconectado";
      mostrarDesconectado();
    }
  }
}

function simularCarga() {
  if (estadoEsteira.textContent !== "rodando" || pendente) return;
  atualizarStatus({ carga: true });
  setTimeout(() => {
    const codigos = Object.keys(pedidos);
    if (!codigos.length) return logiDiz("A planilha de recebimentos está vazia. Cadastre um pedido para eu ter o que separar.");
    processarCodigo(codigos[indiceExemplo++ % codigos.length]);
    atualizarStatus({ carga: false });
  }, 2500);
}

// Início
botaoLigar.addEventListener("click", () => enviarComando("ligar"));
botaoParar.addEventListener("click", () => enviarComando("parar"));
botaoDemo.addEventListener("click", alternarDemo);
botaoComecar.addEventListener("click", acordarLogi);
botaoVoz.addEventListener("click", alternarSom);
botaoMicrofone.addEventListener("click", alternarMicrofone);
botaoCamera.addEventListener("click", () => ligarCamera());
escolhaCamera.addEventListener("change", () => ligarCamera(escolhaCamera.value));

// Tema claro / escuro (botão do sol e da lua no cabeçalho)
// Fica salvo no navegador, então o painel lembra a última escolha.

if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = escolherVoz;

// Carrega a planilha salva e mostra tudo
carregarPlanilha();
mostrarRecebimentos();
mostrarExpedicao();
atualizarTotais();

// Antes do primeiro pedido mostra só os caminhões
mostrarFila(null);

expressao("dormindo");
conectar();
window.painelIniciado = true;

})();