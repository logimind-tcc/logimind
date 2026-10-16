/* ==========================================================
   LOGIMIND - JS DA PÁGINA DE PRODUTO
   Monta o mapa numerado do protótipo, o cupom com o custo
   e a lista de peças.

   >>> EDITE APENAS A LISTA ABAIXO PARA MUDAR PREÇOS OU ITENS.
   - valor: preço de UMA unidade, em reais (use ponto: 12.5).
   - valor: null  = preço ainda não confirmado (aparece "a confirmar"
     e fica fora do total até vocês colocarem o número).
   - peca: liga a peça ao desenho (não mude).
   - x, y: onde o número aparece no desenho (nas medidas do desenho).
   As fotos ficam na pasta pecas/, ao lado do produto.html.
   ========================================================== */

const componentes = [
  { peca: "esp32", nome: "ESP32", imagem: "esp32.png", icone: "placa",
    funcao: "O cérebro: liga e para a esteira, lê o sensor e move o braço.",
    valor: 36.85, quantidade: 1, x: 132, y: 248 },
  { peca: "motor", nome: "Motor DC 12V", imagem: "motor.png", icone: "motor",
    funcao: "Gira os rolos que fazem a lona da esteira andar.",
    valor: 55.0, quantidade: 1, x: 26, y: 222 },
  { peca: "l298n", nome: "Ponte H L298N", imagem: "modulo.png", icone: "placa",
    funcao: "Recebe as ordens do ESP32 e controla a velocidade do motor.",
    valor: 20.0, quantidade: 1, x: 189, y: 240 },
  { peca: "fonte", nome: "Fonte 12V", imagem: "", icone: "fonte",
    funcao: "Dá energia para o motor e, pelo step-down, para os servos.",
    valor: 35.0, quantidade: 1, x: 64, y: 242 },
  { peca: "hcsr04", nome: "Sensor ultrassônico HC-SR04", imagem: "", icone: "ultrassom",
    funcao: "Percebe quando a caixa chega, para a esteira parar no ponto certo.",
    valor: 15.0, quantidade: 1, x: 246, y: 174 },
  { peca: "webcam", nome: "Webcam USB", imagem: "camera.png", icone: "camera",
    funcao: "Lê o QR Code de cada caixa para o painel saber qual é o pedido.",
    valor: 23.9, quantidade: 1, x: 325, y: 58 },
  { peca: "braco", nome: "Braço robótico + 4 servos SG90", imagem: "", icone: "braco",
    funcao: "Pega a caixa e leva até a saída A, B ou C. Os 4 servos são a base, o ombro, o cotovelo e a garra.",
    valor: 108.0, quantidade: 1, x: 450, y: 292 },
  { peca: "stepdown", nome: "Step-down LM2596", imagem: "", icone: "placa",
    funcao: "Transforma os 12 V da fonte em 5 V, só para os servos.",
    valor: 13.92, quantidade: 1, x: 244, y: 250 },
  { peca: "protoboard", nome: "Protoboard", imagem: "", icone: "protoboard",
    funcao: "Onde os fios se encontram, sem precisar soldar.",
    valor: 13.99, quantidade: 1, x: 305, y: 254 },
  { peca: "jumpers", nome: "Kit de jumpers (120 unidades)", imagem: "", icone: "fios",
    funcao: "Os fios que ligam tudo: macho-macho, macho-fêmea e fêmea-fêmea.",
    valor: 39.9, quantidade: 1, x: 352, y: 232 }
];

/* ---------- ÍCONES (aparecem quando a peça ainda não tem foto) ---------- */
const icones = {
  placa: '<rect x="4" y="7" width="24" height="18" rx="2"/><path d="M9 7V3M15 7V3M21 7V3M9 29v-4M15 29v-4M21 29v-4M10 13h12M10 17h8"/>',
  motor: '<rect x="6" y="10" width="14" height="12" rx="2"/><path d="M20 13h4v6h-4M6 16H2"/><circle cx="13" cy="16" r="3"/>',
  camera: '<rect x="3" y="8" width="26" height="18" rx="3"/><circle cx="16" cy="17" r="5"/><path d="M11 8l2-3h6l2 3"/>',
  fonte: '<rect x="4" y="9" width="24" height="14" rx="3"/><path d="M13 13l-3 5h5l-3 5M22 13v6"/>',
  ultrassom: '<rect x="3" y="10" width="26" height="13" rx="2"/><circle cx="10" cy="16.5" r="4"/><circle cx="22" cy="16.5" r="4"/><path d="M14 23v4M18 23v4"/>',
  fios: '<path d="M4 24c4-14 9-14 12-8s8 6 12-8"/><path d="M4 28c5-10 10-10 13-5s7 4 11-6"/><circle cx="4" cy="24" r="2"/><circle cx="28" cy="8" r="2"/>',
  servo: '<rect x="5" y="12" width="20" height="13" rx="2"/><path d="M2 15h3M25 15h3"/><circle cx="11" cy="12" r="4"/><path d="M8 7h9"/>',
  braco: '<path d="M8 27h12M14 27v-6l6-9-9-4"/><circle cx="14" cy="21" r="2"/><circle cx="20" cy="12" r="2"/><path d="M11 8l-4-2M11 8l-3 3"/>',
  protoboard: '<rect x="3" y="7" width="26" height="18" rx="2"/><path d="M7 11h18M7 21h18" stroke-dasharray="1.5 2.5"/><path d="M7 16h18"/>'
};

function montarIcone(chave) {
  return `<svg width="40" height="40" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${icones[chave] || icones.placa}</svg>`;
}

/* Mostra a foto da peça; se o arquivo não existir, troca pelo ícone. */
function montarMiniatura(peca) {
  if (peca.imagem) {
    return `<div class="componente-miniatura">
      <img src="pecas/${peca.imagem}" alt="Foto: ${peca.nome}" loading="lazy"
           onerror="this.parentElement.innerHTML = montarIcone('${peca.icone}')"></div>`;
  }
  return `<div class="componente-miniatura" aria-hidden="true">${montarIcone(peca.icone)}</div>`;
}

function formatarReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const numeroDa = (peca) => componentes.indexOf(peca) + 1;
const temPreco = (peca) => typeof peca.valor === "number";

/* ---------- ELEMENTOS ---------- */
const grade = document.getElementById("grade-componentes");
const marcadores = document.getElementById("marcadores");
const listaCupom = document.getElementById("cupom-itens");
const campoValorTotal = document.getElementById("valor-total");
const campoQuantidade = document.getElementById("quantidade-itens");
const campoObs = document.getElementById("cupom-obs");
const seletorOrdem = document.getElementById("seletor-ordem");

/* ---------- LISTA DE PEÇAS ---------- */
function desenharComponentes(lista) {
  grade.innerHTML = "";
  lista.forEach((peca) => {
    const artigo = document.createElement("article");
    artigo.className = "componente";
    artigo.dataset.peca = peca.peca;
    artigo.tabIndex = 0;
    const preco = temPreco(peca)
      ? `${formatarReal(peca.valor)}${peca.quantidade > 1 ? `<span class="componente-quantidade">× ${peca.quantidade}</span>` : ""}`
      : `<span class="a-confirmar">preço a confirmar</span>${peca.quantidade > 1 ? `<span class="componente-quantidade">× ${peca.quantidade}</span>` : ""}`;
    artigo.innerHTML = `
      <span class="componente-numero">${numeroDa(peca)}</span>
      ${montarMiniatura(peca)}
      <div class="componente-dados">
        <h3 class="componente-nome">${peca.nome}</h3>
        <p class="componente-funcao">${peca.funcao}</p>
        <p class="componente-valor">${preco}</p>
      </div>`;
    artigo.addEventListener("mouseenter", () => destacar(peca.peca, false));
    artigo.addEventListener("focus", () => destacar(peca.peca, false));
    artigo.addEventListener("mouseleave", () => destacar(null));
    grade.appendChild(artigo);
  });
}

/* ---------- MARCADORES NO DESENHO ---------- */
function desenharMarcadores() {
  componentes.forEach((peca) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "marcador";
    botao.dataset.peca = peca.peca;
    // converte a posição do desenho (viewBox 0 40 640 310) em porcentagem
    botao.style.left = (peca.x / 640) * 100 + "%";
    botao.style.top = ((peca.y - 40) / 310) * 100 + "%";
    botao.textContent = numeroDa(peca);
    botao.setAttribute("aria-label", `${numeroDa(peca)}: ${peca.nome}`);
    botao.addEventListener("mouseenter", () => destacar(peca.peca, false));
    botao.addEventListener("mouseleave", () => destacar(null));
    botao.addEventListener("click", () => destacar(peca.peca, true));
    marcadores.appendChild(botao);
  });
}

/* ---------- CUPOM ---------- */
function desenharCupom() {
  listaCupom.innerHTML = "";
  componentes.forEach((peca) => {
    const li = document.createElement("li");
    li.dataset.peca = peca.peca;
    const qtd = peca.quantidade > 1 ? `${peca.quantidade}× ` : "";
    const valor = temPreco(peca) ? formatarReal(peca.valor * peca.quantidade) : "a confirmar";
    li.innerHTML = `<span class="cupom-nome">${String(numeroDa(peca)).padStart(2, "0")} ${qtd}${peca.nome}</span><span class="cupom-valor${temPreco(peca) ? "" : " pendente"}">${valor}</span>`;
    li.addEventListener("mouseenter", () => destacar(peca.peca, false));
    li.addEventListener("mouseleave", () => destacar(null));
    listaCupom.appendChild(li);
  });

  const comPreco = componentes.filter(temPreco);
  const total = comPreco.reduce((soma, p) => soma + p.valor * p.quantidade, 0);
  const faltam = componentes.length - comPreco.length;
  campoValorTotal.textContent = formatarReal(total);
  campoQuantidade.textContent = componentes.reduce((soma, p) => soma + p.quantidade, 0);
  campoObs.textContent = faltam
    ? `* ${faltam} ${faltam === 1 ? "peça ainda sem preço" : "peças ainda sem preço"}: o total vai subir quando elas entrarem.`
    : "";
}

/* ---------- DESTAQUE: desenho, cupom e lista andam juntos ---------- */
let fixo = null;
function destacar(peca, rolar) {
  if (rolar) fixo = fixo === peca ? null : peca;
  const alvo = peca || fixo;
  document.querySelectorAll("[data-peca]").forEach((el) => {
    el.classList.toggle("destaque", el.dataset.peca === alvo);
  });
  document.querySelector(".mapa")?.classList.toggle("focando", Boolean(alvo));
  if (rolar && fixo) {
    const cartao = grade.querySelector(`[data-peca="${fixo}"]`);
    if (cartao && window.innerWidth < 900) cartao.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function ordenarLista(criterio) {
  const copia = [...componentes];
  const preco = (p) => (temPreco(p) ? p.valor * p.quantidade : -1);
  if (criterio === "maior") return copia.sort((a, b) => preco(b) - preco(a));
  if (criterio === "menor") return copia.sort((a, b) => (temPreco(a) ? preco(a) : 1e9) - (temPreco(b) ? preco(b) : 1e9));
  if (criterio === "nome") return copia.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return copia;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!grade) return;
  desenharComponentes(componentes);
  desenharMarcadores();
  desenharCupom();
  if (seletorOrdem) {
    seletorOrdem.addEventListener("change", (evento) => desenharComponentes(ordenarLista(evento.target.value)));
  }
});
