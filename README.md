# Financas Casal

Controle financeiro pessoal de **Ingrid** e **Felipp** com calendario de compromissos e contas,
alertas na tela e exportacao/assinatura para o **Calendario do iPhone** (`.ics` / `webcal://`).

- Node.js + Express 5 + TypeScript (modo `strict`, zero erros de tipagem)
- Banco local **SQLite** (via `sql.js`, WebAssembly: nao precisa compilar nada, roda igual no Windows, macOS, Linux e Render)
- Frontend em TypeScript puro (sem framework), responsivo, icones em **PNG**, sem emoji
- Graficos com Chart.js servido localmente (sem CDN)

---

## 1. Rodar no VS Code

Requisito: **Node.js 20 ou superior** (recomendado 22 LTS) — https://nodejs.org

```bash
npm install
npm run dev
```

Abra **http://localhost:3000**.

| Usuario  | Senha    | Perfil |
|----------|----------|--------|
| `ingrid` | `ingrid` | Ingrid |
| `felipe` | `felipe` | Felipp |

Troque as senhas em **Integracoes e backup > Seguranca da conta**.

Cada perfil pode escolher ou remover sua propria foto em **Integracoes e backup > Foto de perfil**.
A foto e guardada neste navegador para continuar disponivel apos fechar e reabrir o app, e enviada
ao servidor quando possivel. Em hospedagem sem disco persistente, essa copia do navegador vale
somente para o mesmo dispositivo e navegador; para compartilhar entre dispositivos, configure
armazenamento persistente no servidor.

No primeiro start o banco `data/financas.sqlite` e criado com a estrutura de categorias
de Janeiro a Dezembro de 2026 (valores zerados, prontos para preencher).

Tambem da para rodar pelo VS Code: aba **Run and Debug > Rodar Financas Casal** (F5).

### Scripts

| Comando             | O que faz                                         |
|---------------------|---------------------------------------------------|
| `npm run dev`       | Compila tudo e sobe o servidor                    |
| `npm run build`     | Compila servidor (`dist/`) e cliente (`public/js`)|
| `npm start`         | Sobe o servidor ja compilado (usado no Render)    |
| `npm run typecheck` | Verifica tipagem de servidor e cliente            |
| `npm run seed`      | Cria usuarios/estrutura caso o banco esteja vazio |

---

## 2. Publicar no Render

1. Suba a pasta para um repositorio no GitHub (o `.gitignore` ja exclui `node_modules`, `dist` e o banco).
2. No Render: **New > Blueprint** e escolha o repositorio. O `render.yaml` ja configura tudo:
   - Build: `npm install --include=dev && npm run build`
   - Start: `npm start`
   - `SESSION_SECRET` gerado automaticamente
   - **Disco persistente** em `/var/data` com `DB_PATH=/var/data/financas.sqlite`

> **Atencao (ponto critico):** no Render, arquivos gravados fora de um *Persistent Disk* sao
> apagados a cada deploy ou reinicio. Disco persistente so existe em plano pago (`starter`).
> No plano gratuito o app funciona, mas **os dados somem a cada deploy** e o servico "dorme"
> apos inatividade. Se usar o gratuito, faca backup JSON com frequencia.

Alternativa manual (Web Service): mesmos comandos de build/start e as variaveis do `.env.example`.

---

## 3. Arquitetura (MVC)

```
src/
  server/                     Backend (Model + Controller)
    config/env.ts             Variaveis de ambiente
    database/                 Conexao SQLite, schema, seed
    models/                   UserModel, EntryModel, EventModel  (acesso a dados)
    services/                 Regras de negocio: Auth, Validation, Summary,
                              Calendar, Ics (iCalendar), Backup (JSON/CSV)
    controllers/              Auth, Entry, Event, Report (entrada/saida HTTP)
    middlewares/              auth, security (headers + limite de login), errorHandler
    routes/index.ts           Rotas REST /api e feed /calendar
    app.ts / server.ts        Montagem do Express e bootstrap
  client/                     Frontend (View + controllers de tela)
    models/types.ts           Tipos e metadados (secoes, categorias)
    services/                 api, repository (API + cache localStorage), store, insights
    controllers/              App (rotas/login), Dashboard, Finance, Calendar, Settings, Notification
    views/                    Login, Layout, Dashboard, Finance, Calendar, Settings, forms, charts
    core/                     dom, format, modal, toast
public/                       HTML, CSS, icones PNG, manifest (View estatica)
```

Fluxo: **View** dispara acao -> **controller do cliente** chama a **API** -> **Controller** do servidor
valida (Validation) -> **Service** aplica a regra -> **Model** grava no SQLite -> resposta volta e a View re-renderiza.

### Persistencia

- **Fonte oficial:** SQLite no servidor (`data/financas.sqlite`). Cada escrita e gravada em disco
  de forma atomica (arquivo temporario + rename).
- **localStorage:** guarda preferencias (mes, perfil) e uma copia dos ultimos dados exibidos.
  Se a conexao cair, a tela continua legivel (modo somente leitura, com aviso).

### Regra do saldo

```
Saldo livre = Renda - Fixos - Reserva - Investimentos - Variaveis - Faturas de cartao
```

Reserva e investimentos entram como saida porque o objetivo do painel e mostrar o que esta
**livre para gastar**. Cuidado com contagem dupla: se uma compra foi no cartao, lance-a em
"Cartoes" **ou** em "Gastos variaveis", nao nos dois.

---

## 4. Calendario e iPhone

- Clique em um dia para ver/adicionar compromissos (duplo clique cria direto).
- Gastos fixos e faturas com **dia de vencimento** aparecem sozinhos no calendario.
- Alertas: banners na tela para itens de **hoje e amanha** (verificacao a cada 5 min) e
  notificacoes do navegador, se autorizadas.

### Sincronizacao Google Calendar

Para sincronizar compromissos cadastrados no app com as contas Google do casal:

1. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_INGRID_ACCOUNT_EMAIL` e `GOOGLE_FELIPP_ACCOUNT_EMAIL` no `.env`.
2. No cliente OAuth Web do Google Cloud, cadastre como URI de redirecionamento
   `http://localhost:3000/api/calendar/google/callback` para desenvolvimento local.
3. Habilite a Google Calendar API e adicione as duas contas como usuarias de teste, se o app OAuth
   estiver em modo de teste.
4. Entre no app e acesse **Integracoes e backup > Google Calendar**. Conecte cada conta pelo botao
   correspondente e autorize o Google conectado naquela conta.

As agendas Google conectadas tambem sao consultadas ao abrir o calendario do app: eventos externos
aparecem como **Google Calendar - somente leitura** no perfil correspondente. Edite esses eventos
no Google Calendar; eventos criados no app continuam sincronizados conforme o responsavel e os
eventos compartilhados aparecem nas duas agendas.
Se o Google informar falta de escopo/permissao, use **Reconectar agenda** em Integracoes e aceite
as permissoes atualizadas de leitura e edicao de eventos.

Cada conta Google guarda sua autorizacao separadamente. O token de atualizacao e armazenado
criptografado no banco local; a chave de criptografia fica no
arquivo local `data/financas.sqlite.google-token-key` (nao compartilhe nem remova esse arquivo;
em producao, mantenha-o no disco persistente junto ao banco). Compromissos criados, editados
ou excluidos no app sao refletidos na agenda do responsavel; compromissos compartilhados sao
refletidos nas duas agendas conectadas. Ao conectar, os compromissos existentes daquele perfil
sao sincronizados. Lancamentos financeiros/vencimentos nao sao enviados.
Para publicacao, configure
em `GOOGLE_REDIRECT_URI` o callback HTTPS do dominio publicado e cadastre exatamente a mesma URI
no Google Cloud. A conexao iCloud e independente e ainda requer configuracao propria.

**Metodo 1 — arquivo .ics:** no iPhone (Safari), toque no icone de celular de um evento ou em
"Exportar mes". Abre a tela "Adicionar ao Calendario", com o alarme configurado.
E uma copia: alteracoes posteriores nao sao refletidas.

**Metodo 2 — assinatura (sincronizacao):** em *Integracoes e backup* ha um link pessoal
`webcal://.../calendar/<token>.ics`. O iPhone consulta esse link periodicamente.
So funciona com o app publicado (endereco publico HTTPS). Limites do iOS: calendarios assinados
sao somente leitura e o iOS costuma ignorar alarmes de assinaturas — para alarme garantido, use o Metodo 1.
Se o link vazar, use "Gerar novo link".

---

## 5. Backup

Em *Integracoes e backup*: backup completo **JSON**, **CSV** de lancamentos e de eventos
(separador `;`, abre direto no Excel em portugues) e **restauracao** a partir do JSON
(substitui todos os dados atuais, com confirmacao).

## 6. Seguranca

Senhas com `scrypt`, sessao em cookie `httpOnly` assinado (HMAC-SHA256), limite de 10 tentativas
de login a cada 15 min por IP, cabecalhos de seguranca e Content-Security-Policy restritiva.
Ambos os usuarios enxergam os dados do casal (visao individual ou conjunta), por design.
