/* ==========================================================
   AURION - JS DA PAGINA DE PRODUTO
   Monta a lista de componentes e calcula o valor total.

   >>> EDITE APENAS A LISTA ABAIXO PARA MUDAR PRECOS OU ITENS.
   O valor total e a quantidade de itens sao calculados sozinhos.
   ========================================================== */

const componentes = [
  {
    nome: "ESP32",
    funcao: "Microcontrolador que comanda todo o sistema",
    valor: 36.85,
    quantidade: 1,
    icone: "placa"
  },
  {
    nome: "Motor DC 12V",
    funcao: "Movimenta a correia da esteira",
    valor: 55.0,
    quantidade: 1,
    icone: "motor"
  },
  {
    nome: "Ponte H L298N",
    funcao: "Controla o sentido e a velocidade do motor",
    valor: 20.0,
    quantidade: 1,
    icone: "placa"
  },
  {
    nome: "Servo motor MG996R",
    funcao: "Desvia a carga para a saida correta",
    valor: 96.0,
    quantidade: 1,
    icone: "motor"
  },
  {
    nome: "Camera para QR Code",
    funcao: "Faz a leitura do codigo de cada mercadoria",
    valor: 23.9,
    quantidade: 1,
    icone: "camera"
  },
  {
    nome: "Fonte 12V",
    funcao: "Alimenta o motor e a estrutura da esteira",
    valor: 35.0,
    quantidade: 1,
    icone: "fonte"
  },
  {
    nome: "Sensor TCRT5000",
    funcao: "Detecta a passagem da carga na esteira",
    valor: 35.16,
    quantidade: 1,
    icone: "sensor"
  }
];

/* ---------- ICONES DAS PECAS ---------- */
/* Para usar fotos reais: salve os arquivos nesta mesma pasta e troque
   montarMiniatura() por: `<img src="${arquivo}" alt="${nome}">` */
const icones = {
  placa:
    '<rect x="4" y="7" width="24" height="18" rx="2"/><path d="M9 7V3M15 7V3M21 7V3M9 29v-4M15 29v-4M21 29v-4M10 13h12M10 17h8"/>',
  motor:
    '<rect x="6" y="10" width="14" height="12" rx="2"/><path d="M20 13h4v6h-4M6 16H2"/><circle cx="13" cy="16" r="3"/>',
  camera:
    '<rect x="3" y="8" width="26" height="18" rx="3"/><circle cx="16" cy="17" r="5"/><path d="M11 8l2-3h6l2 3"/>',
  fonte:
    '<rect x="4" y="9" width="24" height="14" rx="3"/><path d="M13 13l-3 5h5l-3 5M22 13v6"/>',
  sensor:
    '<circle cx="16" cy="16" r="4"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4M8 8l3 3M21 21l3 3M24 8l-3 3M11 21l-3 3"/>'
};

function montarMiniatura(chave) {
  const desenho = icones[chave] || icones.placa;
  return `
    <div class="componente-miniatura" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 32 32" fill="none"
           stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        ${desenho}
      </svg>
    </div>`;
}

/* ---------- FORMATACAO EM REAIS ---------- */
function formatarReal(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

/* ---------- MONTAGEM DA GRADE ---------- */
const grade = document.getElementById("grade-componentes");
const campoValorTotal = document.getElementById("valor-total");
const campoQuantidade = document.getElementById("quantidade-itens");
const seletorOrdem = document.getElementById("seletor-ordem");

function desenharComponentes(lista) {
  grade.innerHTML = "";

  lista.forEach((peca) => {
    const artigo = document.createElement("article");
    artigo.className = "componente";
    artigo.innerHTML = `
      ${montarMiniatura(peca.icone)}
      <div class="componente-dados">
        <h3 class="componente-nome">${peca.nome}</h3>
        <p class="componente-funcao">${peca.funcao}</p>
        <p class="componente-valor">
          ${formatarReal(peca.valor)}
          ${peca.quantidade > 1 ? `<span class="componente-quantidade">x${peca.quantidade}</span>` : ""}
        </p>
      </div>`;
    grade.appendChild(artigo);
  });
}

function calcularTotal(lista) {
  return lista.reduce((soma, peca) => soma + peca.valor * peca.quantidade, 0);
}

function contarItens(lista) {
  return lista.reduce((soma, peca) => soma + peca.quantidade, 0);
}

function ordenarLista(criterio) {
  const copia = [...componentes];

  if (criterio === "maior") {
    return copia.sort((a, b) => b.valor - a.valor);
  }
  if (criterio === "menor") {
    return copia.sort((a, b) => a.valor - b.valor);
  }
  if (criterio === "nome") {
    return copia.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  return copia;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!grade) {
    return;
  }

  desenharComponentes(componentes);
  campoValorTotal.textContent = formatarReal(calcularTotal(componentes));
  campoQuantidade.textContent = contarItens(componentes);

  if (seletorOrdem) {
    seletorOrdem.addEventListener("change", (evento) => {
      desenharComponentes(ordenarLista(evento.target.value));
    });
  }
});
