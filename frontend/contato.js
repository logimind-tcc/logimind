// Formulário de contato da página Sobre Nós

const botoesAssunto = document.querySelectorAll(".assunto");
const formulario = document.getElementById("formulario");
const retorno = document.getElementById("retorno");

let assuntoEscolhido = "";

// Marca o assunto clicado e desmarca os outros
botoesAssunto.forEach(function (botao) {
  botao.addEventListener("click", function () {
    if (botao.classList.contains("marcado")) {
      botao.classList.remove("marcado");
      assuntoEscolhido = "";
      return;
    }

    botoesAssunto.forEach(function (outro) {
      outro.classList.remove("marcado");
    });

    botao.classList.add("marcado");
    assuntoEscolhido = botao.textContent.trim();
  });
});

// Faz o campo de mensagem crescer conforme a pessoa digita
const campoMensagem = document.getElementById("mensagem");

campoMensagem.addEventListener("input", function () {
  campoMensagem.style.height = "auto";
  campoMensagem.style.height = campoMensagem.scrollHeight + "px";
});

function avisar(texto, tipo) {
  retorno.textContent = texto;
  retorno.className = "retorno " + tipo;
}

formulario.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const origem = document.getElementById("origem").value.trim();
  const mensagem = document.getElementById("mensagem").value.trim();

  if (assuntoEscolhido === "") {
    avisar("Escolha um assunto antes de enviar.", "erro");
    return;
  }

  if (nome.length < 3) {
    avisar("Digite seu nome completo.", "erro");
    return;
  }

  if (email.indexOf("@") === -1 || email.indexOf(".") === -1) {
    avisar("Digite um e-mail válido.", "erro");
    return;
  }

  if (origem.length < 3) {
    avisar("Conte onde você conheceu o projeto.", "erro");
    return;
  }

  if (mensagem.length < 10) {
    avisar("Escreva uma mensagem um pouco maior.", "erro");
    return;
  }

  // Quando o servidor estiver rodando, o envio entra aqui no lugar do aviso
  avisar("Sua mensagem foi enviada! Respondemos em até dois dias úteis.", "certo");

  formulario.reset();
  campoMensagem.style.height = "auto";
  botoesAssunto.forEach(function (botao) {
    botao.classList.remove("marcado");
  });
  assuntoEscolhido = "";
});