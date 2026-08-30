/* ==========================================================
   AURION - JS GLOBAL
   Roda nas tres paginas: tema claro/escuro + menu mobile.
   ========================================================== */

/* ---------- 1. TEMA CLARO / ESCURO ---------- */

const CHAVE_TEMA = "aurion-tema";

// Le o tema salvo no navegador. Se nunca foi salvo, usa a preferencia do sistema.
function lerTemaSalvo() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    if (salvo === "claro" || salvo === "escuro") {
      return salvo;
    }
  } catch (erro) {
    // Alguns navegadores bloqueiam o localStorage. Nesse caso seguimos sem salvar.
    console.warn("Nao foi possivel ler o tema salvo:", erro);
  }

  const prefereEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefereEscuro ? "escuro" : "claro";
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);

  const botaoTema = document.getElementById("botao-tema");
  if (botaoTema) {
    const proximo = tema === "escuro" ? "claro" : "escuro";
    botaoTema.setAttribute("aria-label", `Mudar para o tema ${proximo}`);
  }

  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch (erro) {
    console.warn("Nao foi possivel salvar o tema:", erro);
  }
}

// Aplica o tema logo no inicio para evitar piscar a tela branca.
aplicarTema(lerTemaSalvo());

document.addEventListener("DOMContentLoaded", () => {
  const botaoTema = document.getElementById("botao-tema");

  if (botaoTema) {
    botaoTema.addEventListener("click", () => {
      const temaAtual = document.documentElement.getAttribute("data-tema");
      aplicarTema(temaAtual === "escuro" ? "claro" : "escuro");
    });
  }

  /* ---------- 2. MENU MOBILE ---------- */
  const botaoMenu = document.getElementById("botao-menu");
  const navegacao = document.getElementById("navegacao");

  if (botaoMenu && navegacao) {
    botaoMenu.addEventListener("click", () => {
      const aberto = navegacao.classList.toggle("aberta");
      botaoMenu.setAttribute("aria-expanded", String(aberto));
      botaoMenu.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    });

    // Fecha o menu ao clicar em qualquer link
    navegacao.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navegacao.classList.remove("aberta");
        botaoMenu.setAttribute("aria-expanded", "false");
      });
    });
  }
});
