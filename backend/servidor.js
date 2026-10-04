/* ==========================================================
   LOGIMIND - SERVIDOR
   Express + MySQL2 + CORS
   Rodar com: npm run dev  (usa o nodemon)
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

const app = express();
const PORTA = 8080;

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

app.listen(PORTA, () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
});
