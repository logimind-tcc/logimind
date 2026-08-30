/* ==========================================================
   AURION - JS DA PAGINA DE INSTRUCOES
   Revela os passos conforme a rolagem e trata o espaco do video.
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- 1. REVELAR OS PASSOS AO ROLAR A PAGINA ---------- */
  const passos = document.querySelectorAll(".passo");

  if ("IntersectionObserver" in window) {
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada, indice) => {
          if (entrada.isIntersecting) {
            // Pequeno atraso em cascata para os passos aparecerem em sequencia
            setTimeout(() => entrada.target.classList.add("visivel"), indice * 110);
            observador.unobserve(entrada.target);
          }
        });
      },
      { threshold: 0.25 }
    );

    passos.forEach((passo) => observador.observe(passo));
  } else {
    // Navegadores antigos: mostra tudo de uma vez
    passos.forEach((passo) => passo.classList.add("visivel"));
  }

  /* ---------- 2. ESPACO RESERVADO DO VIDEO ---------- */
  const areaVideo = document.getElementById("area-video");

  if (areaVideo) {
    const observacao = areaVideo.querySelector(".video-observacao");

    function avisarVideo() {
      observacao.textContent = "A gravacao entra aqui assim que o prototipo for filmado.";
    }

    areaVideo.addEventListener("click", avisarVideo);
    areaVideo.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        avisarVideo();
      }
    });
  }
});
