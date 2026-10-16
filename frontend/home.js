/* ==========================================================
   LOGIMIND - JS DA PAGINA HOME
   Valida o formulario de cadastro e envia para o servidor.
   ========================================================== */

// Troque pelo endereco do servidor publicado quando subir o back-end.
// No computador (localhost:8080) usa o servidor local; na Vercel, usa o servidor online (Render)
const ENDERECO_SERVIDOR = location.port === "8080" ? "" : "https://logimind-servidor.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const campoNome = document.getElementById("campo-nome");
  const campoEmail = document.getElementById("campo-email");
  const botaoCadastrar = document.getElementById("botao-cadastrar");
  const aviso = document.getElementById("aviso-cadastro");

  if (!botaoCadastrar) {
    }

    let temporizador;

  function mostrarAviso(mensagem, tipo) {
    clearTimeout(temporizador);
    aviso.textContent = mensagem;
    aviso.className = `aviso-cadastro ${tipo}`;

    if (tipo === "sucesso") {
      temporizador = setTimeout(() => {
        aviso.textContent = "";
        aviso.className = "aviso-cadastro";
      }, 5000);
    }
  }

  function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  botaoCadastrar.addEventListener("click", async () => {
    const nome = campoNome.value.trim();
    const email = campoEmail.value.trim();

    if (nome.length < 3) {
      mostrarAviso("Digite seu nome completo, com pelo menos 3 letras.", "erro");
      campoNome.focus();
      return;
    }

    if (!emailValido(email)) {
      mostrarAviso("Digite um e-mail válido, como voce@empresa.com.", "erro");
      campoEmail.focus();
      return;
    }

    mostrarAviso("Enviando cadastro...", "");
    botaoCadastrar.disabled = true;

    try {
      const resposta = await fetch(`${ENDERECO_SERVIDOR}/criar-cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email })
      });

      if (!resposta.ok) {
        throw new Error("Servidor respondeu com erro");
      }

      mostrarAviso("Cadastro feito! Enviamos um e-mail de boas-vindas para você.", "sucesso");
      campoNome.value = "";
      campoEmail.value = "";
    } catch (erro) {
      console.error(erro);
      mostrarAviso(
        "Não foi possível enviar agora. O servidor pode estar acordando: espere uns 30 segundos e tente de novo.",
        "erro"
      );
    } finally {
      botaoCadastrar.disabled = false;
    }
  });
});

/* ==========================================================
   COMO FUNCIONA: a caixinha anda pelos 4 passos
   POR QUE: troca entre "Separação manual" e "Com a LogiMind" (no celular)
   ========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const passos = [...document.querySelectorAll(".fluxo-passo")];
  const trilho = document.querySelector(".fluxo-trilho");
  let atual = 0;
  let parado = false;

  function ativar(i) {
    atual = i;
    passos.forEach((p, k) => p.classList.toggle("ativo", k === i));
    if (trilho) trilho.style.setProperty("--posicao", i / (passos.length - 1));
  }

  if (passos.length) {
    ativar(0);
    passos.forEach((p, i) => {
      p.addEventListener("mouseenter", () => { parado = true; ativar(i); });
      p.addEventListener("click", () => { parado = true; ativar(i); });
      p.addEventListener("mouseleave", () => { parado = false; });
    });
    const semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!semAnimacao) {
      setInterval(() => { if (!parado) ativar((atual + 1) % passos.length); }, 2600);
    }
  }

  // "Por que a LogiMind": o mesmo trajeto em dois modos
  const trajeto = document.getElementById("comparar");
  if (trajeto) {
    const etapas = [...trajeto.querySelectorAll(".etapa")];
    const botoes = [...trajeto.querySelectorAll(".trajeto-chave button")];
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let passo = 0;
    let relogio = null;
    let mexeu = false;

    // acende as estações uma a uma, como a caixa passando pelo sistema
    const acender = () => {
      etapas.forEach((e, i) => {
        e.classList.toggle("feita", i < passo);
        e.classList.toggle("ativa", i === passo);
      });
      passo = passo >= etapas.length ? 0 : passo + 1;
    };

    const mudarModo = (modo) => {
      trajeto.dataset.modo = modo;
      botoes.forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === modo));
      // reinicia a animação de entrada dos textos
      trajeto.querySelectorAll(".etapa-troca > *").forEach((el) => {
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
      });
      clearInterval(relogio);
      etapas.forEach((e) => e.classList.remove("feita", "ativa"));
      if (modo !== "logimind") return;
      if (semMovimento) {
        etapas.forEach((e) => e.classList.add("feita"));
        return;
      }
      passo = 0;
      acender();
      relogio = setInterval(acender, 1100);
    };

    botoes.forEach((b) => b.addEventListener("click", () => {
      mexeu = true;
      mudarModo(b.dataset.modo);
    }));

    // a primeira vez que a seção aparece, mostra o manual e vira sozinha para a LogiMind
    if ("IntersectionObserver" in window) {
      const olho = new IntersectionObserver((itens) => {
        if (!itens[0].isIntersecting) return;
        olho.disconnect();
        setTimeout(() => { if (!mexeu) mudarModo("logimind"); }, 2400);
      }, { threshold: 0.5 });
      olho.observe(trajeto);
    }
  }
});
