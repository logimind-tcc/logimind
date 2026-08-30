# AURION - Esteira Inteligente

Site do projeto de automacao logistica: uma esteira que le QR Code, identifica a
mercadoria com um ESP32 e separa a carga automaticamente.

## Estrutura

```
logimind/
├── home.html       Pagina 1 - apresentacao do projeto
├── home.css
├── home.js         formulario de cadastro
├── instrucao.html  Pagina 2 - guia de utilizacao passo a passo
├── instrucao.css
├── instrucao.js    animacao dos passos
├── produto.html    Pagina 3 - componentes e valor total
├── produto.css
├── produto.js      lista de componentes e calculo do total
├── global.css      variaveis, temas, cabecalho, rodape (reaproveitado na Etapa 2)
├── global.js       tema claro/escuro + menu mobile
├── servidor.js     Express + MySQL2 + CORS
├── rotas.http      testes das rotas
├── package.json
└── vercel.json     faz a "/" abrir a home.html
```


## Como rodar

1. Instale as dependencias (uma vez so):

```bash
npm install
```

2. Abra o site: clique com o botao direito em `home.html` > **Open with Live Server**
   (extensao Live Server do VS Code).

3. Ligue o servidor, se for testar o cadastro:

```bash
npm run dev
```

O servidor sobe em `http://localhost:8080`. Use o `rotas.http` com a
extensao **REST Client** do VS Code para testar as rotas.

### Tabela do banco

O servidor espera uma tabela como esta:

```sql
CREATE TABLE Cadastros_Aurion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL
);
```

## Tema claro e escuro

O botao no canto superior direito troca entre os dois temas. A escolha fica
salva no navegador. Todas as cores vivem em variaveis CSS no `global.css`,
entao trocar a paleta e mexer em um lugar so.

## Onde editar as coisas

| O que voce quer mudar | Onde |
| --- | --- |
| Precos e pecas do projeto | lista `componentes` no topo de `produto.js` |
| Cores do site | `:root` e `[data-tema="escuro"]` em `global.css` |
| Video demonstrativo | bloco `.area-video` em `instrucao.html` |
| Endereco do servidor | `ENDERECO_SERVIDOR` em `home.js` |

## Publicar na Vercel

```bash
git remote add origin https://github.com/SEU-USUARIO/logimind.git
git branch -M main
git push -u origin main
```

Depois entre em vercel.com > **Add New Project** > importe o repositorio
`logimind` > **Deploy**. Nao precisa configurar build: e um site estatico.

## Checklist da entrega

- [x] Pagina 1 - apresentacao com diferencial, publico-alvo e objetivo
- [x] Pagina 2 - guia passo a passo com espaco reservado para o video
- [x] Pagina 3 - componentes com valor de cada um e valor total
- [x] HTML com tags semanticas (header, nav, main, section, article, footer)
- [x] CSS organizado com nomes de classes claros, em portugues
- [x] Responsivo para celular nas tres paginas
- [x] Tema claro e tema escuro
- [ ] Codigo publicado no GitHub
- [ ] Site publicado e funcionando na Vercel
- [ ] Commits distribuidos ao longo das duas semanas
