/* ==========================================================
   LOGIMIND - SERVIDOR
   Express + MySQL2 + CORS
   Rodar com: npm run dev  (usa o nodemon)
   Depois abra: http://localhost:8080/painel.html
   ========================================================== */

import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql2 from "mysql2";

const banco = mysql2.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

const LINK_PROJETO = "https://logimind-two.vercel.app/frontend/home.html";

function montarEmail(nome) {
  const nomeSeguro = String(nome)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `
  <div style="background:#E9EEF6;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#0B1530;padding:22px;text-align:center;">
        <img src="https://logimind-two.vercel.app/frontend/pecas/logo.png" alt="LogiMind" height="44" style="vertical-align:middle;">
        <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:3px;vertical-align:middle;margin-left:10px;">LOGIMIND</span>
      </td></tr>
      <tr><td style="height:4px;background:#1554E0;"></td></tr>
      <tr><td style="background:#F1F6FE;padding:32px 28px;text-align:center;">
        <p style="margin:0 0 12px;color:#1554E0;font-size:12px;font-weight:bold;letter-spacing:2px;">AUTOMAÇÃO LOGÍSTICA</p>
        <p style="margin:0;color:#0B1B3A;font-size:26px;font-weight:bold;">Olá, ${nomeSeguro}!</p>
        <p style="margin:4px 0 16px;color:#1554E0;font-size:26px;font-weight:bold;">Bem-vindo(a) à LogiMind</p>
        <span style="display:inline-block;background:#ffffff;color:#0C447C;font-size:12px;font-weight:bold;padding:6px 14px;border-radius:999px;border:1px solid #B5D4F4;">&#10003; Cadastro confirmado</span>
        <p style="margin:18px 0 0;color:#5A6680;font-size:15px;line-height:1.6;">Que bom ter você por aqui! A LogiMind é uma esteira inteligente que automatiza a separação de cargas na expedição, com menos erros e mais eficiência.</p>
      </td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0 0 12px;color:#0B1B3A;font-size:15px;font-weight:bold;text-align:center;">Como a esteira funciona</p>
        <p style="margin:0;padding:12px 0;color:#3A4660;font-size:14px;"><b style="color:#1554E0;">1.</b>&nbsp;&nbsp;O sensor detecta o pallet e para a esteira</p>
        <p style="margin:0;padding:12px 0;border-top:1px solid #E6EBF3;color:#3A4660;font-size:14px;"><b style="color:#1554E0;">2.</b>&nbsp;&nbsp;A câmera lê o QR Code da carga</p>
        <p style="margin:0;padding:12px 0;border-top:1px solid #E6EBF3;color:#3A4660;font-size:14px;"><b style="color:#1554E0;">3.</b>&nbsp;&nbsp;O sistema escolhe a transportadora e o veículo ideais</p>
        <p style="margin:0;padding:12px 0;border-top:1px solid #E6EBF3;color:#3A4660;font-size:14px;"><b style="color:#1554E0;">4.</b>&nbsp;&nbsp;A carga é desviada para a saída certa</p>
      </td></tr>
      <tr><td style="padding:24px 28px 30px;text-align:center;">
        <a href="${LINK_PROJETO}" style="display:inline-block;background:#1554E0;color:#ffffff;font-size:15px;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;">Ir para o projeto &rarr;</a>
        <p style="margin:16px 0 0;color:#8390A8;font-size:13px;">Até logo,<br><b style="color:#0B1B3A;">Equipe LogiMind</b></p>
      </td></tr>
      <tr><td style="height:4px;background:#1554E0;"></td></tr>
      <tr><td style="background:#0B1530;padding:20px;text-align:center;">
        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:2px;">LOGIMIND</p>
        <p style="margin:6px 0 0;color:#85B7EB;font-size:12px;">Smart Cargo Routing · TCC · Colégio UNASP-SP</p>
        <p style="margin:8px 0 0;color:#5A6E96;font-size:11px;">Você recebeu este e-mail porque se cadastrou no site da LogiMind.</p>
      </td></tr>
    </table>
  </div>`;
}

/* ---------- ENVIO DE E-MAIL (Brevo) ----------
   O Render gratis bloqueia o envio de e-mail pelo Gmail (SMTP).
   Por isso o e-mail sai pela API do Brevo, que funciona pela internet normal (HTTPS).
   Precisa de duas variaveis no .env e no Render: BREVO_API_KEY e EMAIL_REMETENTE. */
async function enviarEmail(para, assunto, html, responderPara) {
  const resposta = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      sender: { name: "Equipe LogiMind", email: process.env.EMAIL_REMETENTE },
      to: [{ email: para }],
      subject: assunto,
      htmlContent: html,
      // Quando a equipe clicar em "Responder", a resposta vai para quem escreveu
      ...(responderPara ? { replyTo: { email: responderPara } } : {})
    })
  });
  if (!resposta.ok) {
    throw new Error("Brevo respondeu " + resposta.status + ": " + (await resposta.text()));
  }
}

const app = express();
const PORTA = process.env.PORT || 8080; // no Render, a porta vem dele; no computador, 8080

app.use(cors()); // libera o acesso do site (front-end) ao servidor
app.use(express.json());
app.use(express.static("frontend")); // serve as paginas da pasta frontend

/* ---------- ROTA DE TESTE ---------- */
app.get("/", (requisicao, resposta) => {
  resposta.json({
    mensagem: "Servidor da LogiMind no ar"
  });
});

/* ---------- LISTAR CADASTROS ---------- */
app.get("/cadastros", (requisicao, resposta) => {
  const comandoBuscar = "SELECT * FROM Cadastros_LogiMind";

  banco.query(comandoBuscar, (erro, resultado) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({
        mensagem: "Nao foi possivel buscar os cadastros"
      });
    }

    resposta.json(resultado);
  });
});

/* ---------- CRIAR CADASTRO ---------- */
app.post("/criar-cadastro", (requisicao, resposta) => {
  const { nome, email } = requisicao.body;

  if (!nome || !email) {
    return resposta.status(400).json({
      mensagem: "Informe nome e e-mail para se cadastrar"
    });
  }

  const comandoInserir = "INSERT INTO Cadastros_LogiMind(nome, email) VALUES (?, ?)";

  banco.query(comandoInserir, [nome, email], (erro) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({
        mensagem: "Nao foi possivel salvar o cadastro"
      });
    }

    enviarEmail(email, `Bem-vindo(a) à LogiMind, ${nome}!`, montarEmail(nome))
      .then(() => console.log("E-mail de boas-vindas enviado para", email))
      .catch((erroEmail) => console.log("Erro ao enviar e-mail:", erroEmail.message));

    resposta.status(201).json({
      mensagem: "Cadastro criado com sucesso"
    });
  });
});

/* ---------- APAGAR CADASTRO ---------- */
app.delete("/apagar-cadastro/:id", (requisicao, resposta) => {
  const { id } = requisicao.params;
  const comandoApagar = "DELETE FROM Cadastros_LogiMind WHERE id=?";

  banco.query(comandoApagar, [id], (erro) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({
        mensagem: "Nao foi possivel apagar o cadastro"
      });
    }

    resposta.json({
      mensagem: "Cadastro apagado com sucesso"
    });
  });
});

/* ==========================================================
   PAINEL DA ESTEIRA - planilha de pedidos e expedicao
   ========================================================== */

// Confere os dados de um pedido antes de salvar no banco
function lerPedido(corpo) {
  const pedido = {
    codigo: String(corpo.codigo || "").trim().toUpperCase(),
    tipo: String(corpo.tipo || "Comum"),
    quantidade: Number(corpo.quantidade),
    comprimento: Number(corpo.comprimento),
    largura: Number(corpo.largura),
    altura: Number(corpo.altura),
    pesoUnidade: Number(corpo.pesoUnidade),
    empilhavel: corpo.empilhavel !== false
  };
  const numerosOk = [pedido.quantidade, pedido.comprimento, pedido.largura, pedido.altura, pedido.pesoUnidade]
    .every((n) => Number.isFinite(n) && n > 0);
  if (!pedido.codigo || pedido.codigo.length > 8 || !numerosOk) return null;
  return pedido;
}

/* ---------- LISTAR PEDIDOS ---------- */
app.get("/api/pedidos", (requisicao, resposta) => {
  const comando = `SELECT codigo, tipo, quantidade, comprimento, largura, altura,
                          peso_unidade, empilhavel, situacao
                   FROM pedidos ORDER BY codigo`;
  banco.query(comando, (erro, linhas) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({ mensagem: "Nao foi possivel buscar os pedidos" });
    }
    resposta.json(linhas);
  });
});

/* ---------- CRIAR PEDIDO ---------- */
app.post("/api/pedidos", (requisicao, resposta) => {
  const p = lerPedido(requisicao.body);
  if (!p) return resposta.status(400).json({ mensagem: "Dados do pedido incompletos" });

  const comando = `INSERT INTO pedidos
    (codigo, tipo, quantidade, comprimento, largura, altura, peso_unidade, empilhavel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const valores = [p.codigo, p.tipo, p.quantidade, p.comprimento, p.largura, p.altura, p.pesoUnidade, p.empilhavel];

  banco.query(comando, valores, (erro) => {
    if (erro) {
      console.log(erro);
      if (erro.code === "ER_DUP_ENTRY") {
        return resposta.status(409).json({ mensagem: `Ja existe um pedido ${p.codigo}` });
      }
      return resposta.status(500).json({ mensagem: "Nao foi possivel salvar o pedido" });
    }
    resposta.status(201).json({ mensagem: "Pedido cadastrado" });
  });
});

/* ---------- EDITAR PEDIDO ---------- */
app.put("/api/pedidos/:codigo", (requisicao, resposta) => {
  const p = lerPedido(requisicao.body);
  if (!p) return resposta.status(400).json({ mensagem: "Dados do pedido incompletos" });

  const comando = `UPDATE pedidos SET codigo = ?, tipo = ?, quantidade = ?, comprimento = ?,
    largura = ?, altura = ?, peso_unidade = ?, empilhavel = ? WHERE codigo = ?`;
  const valores = [p.codigo, p.tipo, p.quantidade, p.comprimento, p.largura, p.altura,
                   p.pesoUnidade, p.empilhavel, requisicao.params.codigo];

  banco.query(comando, valores, (erro) => {
    if (erro) {
      console.log(erro);
      if (erro.code === "ER_DUP_ENTRY") {
        return resposta.status(409).json({ mensagem: `Ja existe um pedido ${p.codigo}` });
      }
      return resposta.status(500).json({ mensagem: "Nao foi possivel atualizar o pedido" });
    }
    resposta.json({ mensagem: "Pedido atualizado" });
  });
});

/* ---------- APAGAR PEDIDO ---------- */
app.delete("/api/pedidos/:codigo", (requisicao, resposta) => {
  banco.query("DELETE FROM pedidos WHERE codigo = ?", [requisicao.params.codigo], (erro) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({ mensagem: "Nao foi possivel apagar o pedido" });
    }
    resposta.json({ mensagem: "Pedido apagado" });
  });
});

/* ---------- LISTAR EXPEDICAO ---------- */
app.get("/api/expedicao", (requisicao, resposta) => {
  const comando = `SELECT e.data_hora, e.pedido, e.caminhao, e.transportadora, e.frete,
                          p.tipo, p.quantidade, p.peso_unidade
                   FROM expedicao e
                   JOIN pedidos p ON p.codigo = e.pedido
                   ORDER BY e.id DESC`;
  banco.query(comando, (erro, linhas) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({ mensagem: "Nao foi possivel buscar a expedicao" });
    }
    resposta.json(linhas);
  });
});

/* ---------- REGISTRAR SAIDA (o braco separou a caixa) ---------- */
app.post("/api/expedicao", (requisicao, resposta) => {
  const { pedido, caminhao, transportadora, frete } = requisicao.body;
  if (!pedido || !caminhao || !["A", "B", "C"].includes(transportadora)) {
    return resposta.status(400).json({ mensagem: "Dados da expedicao incompletos" });
  }

  const comando = `INSERT INTO expedicao (data_hora, pedido, caminhao, transportadora, frete)
                   VALUES (?, ?, ?, ?, ?)`;
  banco.query(comando, [new Date(), pedido, caminhao, transportadora, Number(frete) || 0], (erro) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({ mensagem: "Nao foi possivel registrar a saida" });
    }
    banco.query("UPDATE pedidos SET situacao = 'enviado' WHERE codigo = ?", [pedido], (erro2) => {
      if (erro2) console.log(erro2);
      resposta.status(201).json({ mensagem: "Saida registrada" });
    });
  });
});

/* ---------- LIMPAR EXPEDICAO (comecar a demonstracao do zero) ---------- */
app.delete("/api/expedicao", (requisicao, resposta) => {
  banco.query("DELETE FROM expedicao WHERE id > 0", (erro) => {
    if (erro) {
      console.log(erro);
      return resposta.status(500).json({ mensagem: "Nao foi possivel limpar a expedicao" });
    }
    banco.query("UPDATE pedidos SET situacao = 'aguardando' WHERE codigo <> ''", (erro2) => {
      if (erro2) console.log(erro2);
      resposta.json({ mensagem: "Expedicao limpa" });
    });
  });
});

/* ==========================================================
   FORMULARIO "COMO PODEMOS AJUDAR?" (pagina Sobre Nos)
   Manda a mensagem do visitante para o e-mail da equipe.
   ========================================================== */
function limpar(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function montarEmailContato(c) {
  const linha = (rotulo, valor) =>
    `<tr><td style="padding:8px 0;color:#5A6680;font-size:13px;width:150px;vertical-align:top;">${rotulo}</td>` +
    `<td style="padding:8px 0;color:#0B1B3A;font-size:14px;font-weight:bold;">${valor}</td></tr>`;
  return `
  <div style="background:#E9EEF6;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#0B1530;padding:18px 24px;color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:2px;">LOGIMIND · NOVA MENSAGEM DO SITE</td></tr>
      <tr><td style="height:4px;background:#1554E0;"></td></tr>
      <tr><td style="padding:24px;">
        <p style="margin:0 0 4px;color:#1554E0;font-size:12px;font-weight:bold;letter-spacing:2px;">${limpar(c.assunto).toUpperCase()}</p>
        <p style="margin:0 0 18px;color:#0B1B3A;font-size:22px;font-weight:bold;">${limpar(c.nome)} escreveu pelo site</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${linha("E-mail", limpar(c.email))}
          ${linha("Telefone", limpar(c.telefone) || "não informado")}
          ${linha("Conheceu por", limpar(c.origem))}
          ${linha("Quer novidades", c.novidades ? "sim" : "não")}
        </table>
        <div style="margin-top:18px;padding:16px;background:#F1F6FE;border-radius:10px;color:#3A4660;font-size:14px;line-height:1.6;">${limpar(c.mensagem)}</div>
        <p style="margin:18px 0 0;color:#8390A8;font-size:12px;">Para responder, é só clicar em "Responder": a resposta vai direto para ${limpar(c.email)}.</p>
      </td></tr>
    </table>
  </div>`;
}

app.post("/contato", async (requisicao, resposta) => {
  const c = requisicao.body || {};
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c.email || ""));
  if (!c.assunto || !c.nome || !emailOk || !c.mensagem) {
    return resposta.status(400).json({ mensagem: "Preencha assunto, nome, e-mail e mensagem" });
  }

  try {
    await enviarEmail(
      process.env.EMAIL_EQUIPE || process.env.EMAIL_REMETENTE,
      `[Site LogiMind] ${c.assunto} - ${c.nome}`,
      montarEmailContato(c),
      c.email
    );
    console.log("Mensagem do site recebida de", c.email);
    resposta.json({ mensagem: "Mensagem enviada" });
  } catch (erro) {
    console.log("Erro ao enviar mensagem do site:", erro.message);
    resposta.status(500).json({ mensagem: "Nao foi possivel enviar a mensagem agora" });
  }
});

// ================== LOGI COM INTELIGENCIA ARTIFICIAL (Gemini) ==================
// O painel manda a pergunta para ca; o servidor pergunta ao Gemini e devolve a fala.
// A chave fica so no servidor (.env e Render), nunca no site.

const LOGI_INSTRUCOES = `Você é o Logi, o assistente de voz do projeto LOGIMIND, um TCC do Colégio UNASP-SP.
O projeto: uma esteira com ESP32, sensor ultrassônico HC-SR04 e motor com driver L298N. Quando o sensor vê a caixa (pallet), a esteira para.
Uma webcam no painel lê o QR Code da caixa (P01, P02, P03...). O painel busca o pedido no banco de dados MySQL (Aiven),
calcula o caminhão ideal (VUC, 3/4, Toco, Truck, Carreta, Bitrem, Rodotrem) pelo peso e volume, e escolhe a transportadora
mais barata (A, B ou C). Depois um braço robótico de MDF com 4 servos SG90 leva a caixa até a saída A, B ou C.
O site fica na Vercel, o servidor no Render e os e-mails saem pelo Brevo. O painel tem um gêmeo digital 3D que copia a esteira e o braço em tempo real.
Regras: responda em português do Brasil, como fala (vai ser lida em voz alta): no máximo 3 frases curtas, sem markdown, sem listas, sem emoji.
Seja simpático e claro, para uma apresentação de feira. Se não souber algo do projeto, diga que não sabe em vez de inventar.
Se a pessoa pedir uma ação do painel, preencha "acao": "ligar" (ligar a esteira), "parar" (parar a esteira),
"pode_mandar" (avisar que pode colocar a caixa), "cancelar" (cancelar a carga), "cadastrar" (cadastrar pedido),
"ligar_camera" (ligar a webcam). Senão, use "nenhuma".
Responda SOMENTE com JSON assim: {"fala": "...", "acao": "nenhuma"}`;

const ACOES_LOGI = ["nenhuma", "ligar", "parar", "pode_mandar", "cancelar", "cadastrar", "ligar_camera"];
let perguntasNoMinuto = 0;
setInterval(() => (perguntasNoMinuto = 0), 60000); // no maximo 20 perguntas por minuto

async function perguntarAoGemini(modelo, corpo, pensarPouco, tempo) {
  const config = { temperature: 0.6, maxOutputTokens: 1024, responseMimeType: "application/json" };
  if (pensarPouco) config.thinkingConfig = { thinkingLevel: "low" }; // pensa pouco = responde mais rapido
  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({ ...corpo, generationConfig: config }),
      signal: AbortSignal.timeout(tempo),
    }
  );
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(`Gemini ${resposta.status}: ${dados.error?.message || "erro"}`);
  const texto = dados.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!texto) throw new Error("Gemini respondeu vazio");
  return texto;
}

function lerRespostaLogi(texto) {
  let fala = texto, acao = "nenhuma";
  try {
    const json = JSON.parse(texto.replace(/^```(json)?|```$/g, "").trim());
    fala = String(json.fala || "");
    if (ACOES_LOGI.includes(json.acao)) acao = json.acao;
  } catch {
    // veio texto solto: usa como fala mesmo
  }
  fala = fala.replace(/[*#_`]/g, "").replace(/\s+/g, " ").trim().slice(0, 400);
  return { fala, acao };
}

app.post("/api/logi", async (requisicao, resposta) => {
  const { pergunta, historico, contexto } = requisicao.body || {};
  if (!process.env.GEMINI_API_KEY) {
    return resposta.status(503).json({ mensagem: "Falta a GEMINI_API_KEY no servidor" });
  }
  if (!pergunta || String(pergunta).length > 500) {
    return resposta.status(400).json({ mensagem: "Pergunta vazia ou grande demais" });
  }
  if (++perguntasNoMinuto > 20) {
    return resposta.status(429).json({ mensagem: "Muitas perguntas, espere um minuto" });
  }

  // Conversa: as ultimas falas + a pergunta nova
  const conversa = (Array.isArray(historico) ? historico : []).slice(-6).map((h) => ({
    role: h.quem === "logi" ? "model" : "user",
    parts: [{ text: String(h.texto || "").slice(0, 400) }],
  }));
  const situacao = contexto ? `\n(Situação do painel agora: ${String(contexto).slice(0, 400)})` : "";
  conversa.push({ role: "user", parts: [{ text: String(pergunta) + situacao }] });
  const corpo = { systemInstruction: { parts: [{ text: LOGI_INSTRUCOES }] }, contents: conversa };

  // Tenta um modelo; se ele nao existir, estiver lotado ou demorar, passa para o proximo.
  // (O Google troca os nomes dos modelos de tempos em tempos: se mudar, coloque o novo em GEMINI_MODELO.)
  const modelos = [...new Set([process.env.GEMINI_MODELO, "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"].filter(Boolean))];
  const limite = Date.now() + 22000; // o painel espera no maximo uns 25 segundos
  for (const modelo of modelos) {
    for (const pensarPouco of [true, false]) {
      const sobra = limite - Date.now();
      if (sobra < 2000) break;
      try {
        const texto = await perguntarAoGemini(modelo, corpo, pensarPouco, Math.min(15000, sobra));
        const resultado = lerRespostaLogi(texto);
        if (resultado.fala) return resposta.json(resultado);
      } catch (erro) {
        console.log(`Logi IA (${modelo}):`, erro.message);
        // so tenta de novo no mesmo modelo se o problema foi a configuracao de "pensar"
        if (!(pensarPouco && /Gemini 400/.test(erro.message) && /think/i.test(erro.message))) break;
      }
    }
  }
  resposta.status(502).json({ mensagem: "A IA nao respondeu agora" });
});

app.listen(PORTA, () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
  console.log(`Painel da esteira: http://localhost:${PORTA}/painel.html`);
  console.log(process.env.GEMINI_API_KEY ? "Logi com IA: ligado" : "Logi com IA: falta a GEMINI_API_KEY no .env");

  // Testa a conexao com o banco assim que o servidor liga
  banco.query("SELECT COUNT(*) AS total FROM pedidos", (erro, linhas) => {
    if (erro) console.log("ERRO no banco:", erro.message);
    else console.log(`Banco OK: ${linhas[0].total} pedido(s) na tabela pedidos.`);
  });
});
