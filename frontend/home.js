/* ==========================================================
   AURION - JS DA PAGINA HOME
   Valida o formulario de cadastro e envia para o servidor.
   ========================================================== */

// Troque pelo endereco do servidor publicado quando subir o back-end.
const ENDERECO_SERVIDOR = "http://localhost:8080";

document.addEventListener("DOMContentLoaded", () => {
  const campoNome = document.getElementById("campo-nome");
  const campoEmail = document.getElementById("campo-email");
  const botaoCadastrar = document.getElementById("botao-cadastrar");
  const aviso = document.getElementById("aviso-cadastro");

  if (!botaoCadastrar) {
    return;
  }

  function mostrarAviso(mensagem, tipo) {
    aviso.textContent = mensagem;
    aviso.className = `aviso-cadastro ${tipo}`;
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
      mostrarAviso("Digite um e-mail valido, como voce@empresa.com.", "erro");
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

      mostrarAviso("Cadastro feito! Enviamos a demonstracao para o seu e-mail.", "sucesso");
      campoNome.value = "";
      campoEmail.value = "";
    } catch (erro) {
      console.error(erro);
      mostrarAviso(
        "Nao foi possivel enviar agora. Ligue o servidor (npm run dev) e tente de novo.",
        "erro"
      );
    } finally {
      botaoCadastrar.disabled = false;
    }
  });
});
