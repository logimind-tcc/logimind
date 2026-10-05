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
import nodemailer from "nodemailer";

const banco = mysql2.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

const carteiro = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
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
        <img src="cid:logo" alt="LogiMind" height="44" style="vertical-align:middle;">
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

    carteiro.sendMail({
      from: `"Equipe LogiMind" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Bem-vindo(a) à LogiMind, ${nome}!`,
      html: montarEmail(nome),
      attachments: [
        { filename: "logo.png", path: "frontend/pecas/logo.png", cid: "logo" }
      ]
    })
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

app.listen(PORTA, () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
  console.log(`Painel da esteira: http://localhost:${PORTA}/painel.html`);

  // Testa a conexao com o banco assim que o servidor liga
  banco.query("SELECT COUNT(*) AS total FROM pedidos", (erro, linhas) => {
    if (erro) console.log("ERRO no banco:", erro.message);
    else console.log(`Banco OK: ${linhas[0].total} pedido(s) na tabela pedidos.`);
  });
});