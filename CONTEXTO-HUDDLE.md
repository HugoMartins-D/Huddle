# HUDDLE · Almirantes — Contexto do projeto

> Documento de contexto para retomar o projeto em qualquer ferramenta (Claude, Figma Make, Codex, devs).
> Última atualização: 16/out/2026 · Responsável: Hugo Martins

---

## 1. O que é

**HUDDLE** é uma plataforma de **reuniões ao vivo e gravações** para times. Cada time se cadastra, aplica a sua identidade e usa as reuniões do seu jeito.

O objetivo é um **MVP só para reunião e alinhamento do time**: a comissão técnica marca e conduz reuniões por tema e por público. Depois publica um resumo com decisões e tarefas, e cada atleta confirma que leu ("Estou ciente").

- **Plataforma:** desktop em primeiro lugar (1440×960), com versão mobile do atleta (390×844).
- **Marca dupla:** **HUDDLE** é o produto, com identidade própria. Dentro do app aparece a identidade do **time cadastrado** (nome, escudo e cor escolhida no cadastro).
- **Almirantes** (flag football) é só o time usado como referência para desenhar as telas. Nada nas telas internas é exclusivo dele.

## 1.1 Como ler as telas internas

As telas internas são **modelos de lógica**, não telas de um time específico. O que vale nelas é:

- **o fluxo** (de onde se chega e para onde se vai);
- **os estados** (vazio, pendente, confirmado, ao vivo, encerrado, publicado, concluído);
- **as permissões** (o que a comissão faz e o que o atleta só consulta).

**Fixo na plataforma (igual para todo time)**
- As regras da seção 2.
- Os dois perfis: comissão técnica e atleta.
- O ciclo da reunião:
  1. A comissão marca a reunião e escolhe o público.
  2. Os convidados recebem o convite no app e confirmam ou recusam a presença.
  3. A sala ao vivo acontece, com gravação.
  4. A comissão encerra e publica o resumo.
  5. Cada atleta marca "Estou ciente".
  6. Cada atleta conclui as suas tarefas.

**Varia de time para time (vem do cadastro e do uso)**
- Identidade: nome, escudo e cor.
- Elenco e comissão.
- Reuniões: tema, público, pauta e materiais.
  - **Tema = título livre**, como título de vídeo do YouTube: a comissão só escreve. Não há lista nem categorias pré-definidas.
- Playbook, gravações e tarefas.

**Estados que as telas representam**
| Objeto | Estados |
|---|---|
| Reunião | agendada → ao vivo → encerrada → resumo publicado |
| Presença do atleta | pendente · vou · não vou |
| Ciência do resumo | pendente · ciente |
| Tarefa | pendente · concluída |
| Convite do atleta | enviado · ativo · expirado |

## 2. Regras fixas do produto (não negociáveis)

| Regra | Detalhe |
|---|---|
| **Sem IA** | Nada de resumo automático, transcrição, legendas geradas ou sugestões por IA. Resumo e anotações são escritos pela comissão. |
| **Sem automações de WhatsApp** | Convites e lembretes acontecem **por e-mail e notificação no app**. Não há campo de WhatsApp no cadastro. |
| **Duração da reunião** | Opções **30, 45 ou 60 min** (decisão mantida no corte de MVP). |
| **Cadastro fechado** | O atleta **não se cadastra sozinho**: quem cadastra é a comissão técnica (presidente, coaches, coordenadores), e o atleta recebe um convite por e-mail. |
| **Gravação com consentimento** | Ao ativar o convite, o atleta aceita o termo de gravação (LGPD). A sala mostra o aviso "Esta reunião está sendo gravada". |
| **Sem dados fictícios** | Nenhuma tela traz pessoas, reuniões, números ou datas inventados. Todo conteúdo vem do que for cadastrado; sem dados, a tela mostra o estado vazio. |

## 3. Perfis e permissões

**Comissão técnica** (presidente, head coach, coordenadores, direção)
- Presidente: registra o time, escolhe a identidade/cor e convida a comissão.
- Coaches e coordenadores:
  - criam e conduzem reuniões;
  - editam a lousa tática (cada coordenador na sua unidade);
  - publicam o resumo e acompanham a ciência;
  - cadastram atletas e gerenciam o elenco.

**Atleta**
- Vê só as reuniões e os materiais para os quais foi convidado.
- Confirma ou recusa presença, entra na sala, lê o resumo, marca "Estou ciente" e conclui as tarefas atribuídas.
- Consulta o playbook da sua unidade, apenas para leitura.

## 4. Identidade visual

### Tema do time (telas internas do app)
O tema muda conforme o time cadastrado. Os valores abaixo são os do time de referência (Almirantes): cada time troca o escudo, o nome e a cor de destaque.

| Token | Cor |
|---|---|
| Fundo | `#08100D` |
| Superfícies | `#0B1411` · `#0F1915` · `#16241D` |
| Bordas | `#1C2B23` · `#25372E` |
| Destaque | `#43A27A` (logo `#3B8566`) |
| Texto | `#F2F4F5` · secundário `#9AA6A0` |
| Alerta / aviso | `#E5484D` / `#F5A524` |

- **Escudo de referência:** 5 estrelas verdes em círculo, com "ALMIRANTES / FLAG FOOTBALL" em Inter Black Italic. Nas telas, o escudo e o nome são os do time cadastrado.
- **Tipografia:** Inter. Ícones Lucide com traço 1.8; cantos de 12 a 16px; cards com borda de 1px.
- **Desktop:** sidebar fixa de 232px + header. **Mobile:** header + tab bar (Início, Reuniões, Gravações, Perfil).

### HUDDLE (telas de acesso: login, ativar convite, recuperar senha)
- Azul-marinho `#0A101C`, superfície `#0F1725`, dourado `#F5B83D`.
- Inter Black Italic, com o símbolo HUDDLE.

## 5. Arquivos

| Arquivo | Link |
|---|---|
| Design (principal) | https://www.figma.com/design/ZYKsnoXyVbhQ0RAbnocwNG/ |
| Figma Make (app, vazio) | https://www.figma.com/make/9X3hLXgIyxbbqp8awAGuKV |
| Prompt para o Make | `prompt-figma-make-huddle.md` |

Time no Figma: **Code** (`team::1670149875542750202`). Os protótipos HTML de cada etapa estão na pasta de saídas: `almirantes-huddle.html`, `almirantes-telas-acesso.html`, `almirantes-lousa.html`, `almirantes-nova-reuniao.html` e `almirantes-mvp-telas.html`.

### Páginas do arquivo de design
| Página | ID | Conteúdo |
|---|---|---|
| 00 · Guia do projeto | 56:1084 | Visão geral e orientações |
| 01 · Marca HUDDLE | 11:2 | Identidade da plataforma |
| 02 · Comissão técnica | 48:2 | Telas desktop da comissão |
| 03 · Atleta — Mobile | 48:3 | Telas mobile do atleta |
| 04 · Atleta — Desktop | 54:2 | Telas desktop do atleta |
| 05 · Acesso — Mobile e Desktop | 54:3 | Telas de acesso, mobile e desktop |
| 06 · Componentes — Temas | 54:4 | Sidebar/header desktop, componentes, Plataforma × Time |
| 07 · Navegação — Atleta | 61:2 | Fluxo clicável mobile e desktop |
| 08 · Navegação — Comissão | 61:3 | 2 fluxos clicáveis desktop |
| **10 · Figma Make — Telas finais** | 81:2 | **Telas limpas, em 5 seções, para enviar ao Make** |
| 90 · Referência — Compartilhadas | 48:4 | Sala ao vivo (condução), Gravações, Player |
| 99 · Base original | 0:1 | Vazia (o conteúdo foi redistribuído) |

## 6. Inventário de telas

### Acesso (marca HUDDLE, desktop e mobile)
- Login do atleta
- Ativar convite (senha + LGPD)
- Recuperar acesso
- Confira seu e-mail
- Redefinir senha
- Convite expirado
- Solicitação enviada

### Comissão técnica (desktop)
1. **Início da comissão:** próxima reunião, indicadores, próximas reuniões, gravações.
2. **Nova reunião:** tema (campo de texto livre, sem pré-seleção), público, pauta com tempos, materiais, quando, duração de 30/45/60 min, gravação e notificação no app.
3. **Sala ao vivo (condução):** vídeo com lousa, participantes, timer da pauta, controles, abas Chat / Pessoas / Notas.
4. **Encerrar e publicar:** pauta, decisões, próximos passos com responsável e prazo, presença, visibilidade da gravação.
5. **Resumo (acompanhamento):** painel "Ciência do time" com a contagem de cientes e o botão para lembrar os pendentes.
6. **Lousa tática:** no estilo do Play Designer (playdesigner.myfootballplays.com), com jogadores arrastáveis, rotas, formações e salvar no playbook.
7. **Gravações.**
8. **Player da gravação:** capítulos e anotações da comissão.
9. **Registrar time:** identidade, escolha da cor da plataforma, convite à comissão.
10. **Cadastro e convites:** nome, e-mail, número, posição, unidade Ataque/Defesa/Ambos, função Atleta/Capitão.
11. **Elenco (gestão):** status, filtros, convites.

### Atleta (desktop e mobile, mesmas telas)
1. Início
2. Notificações
3. Suas reuniões
4. Suas reuniões (vazia)
5. Detalhe da reunião
6. Presença confirmada
7. Ausência informada
8. Antes de entrar
9. Sala ao vivo
10. Chat da reunião
11. Resumo da reunião
12. Resumo com ciência confirmada
13. Gravações
14. Assistir gravação
15. Playbook da unidade
16. Detalhe da jogada
17. Meus próximos passos
18. Detalhe da tarefa
19. Tarefa concluída
20. Meu perfil
21. Editar meus dados
22. Dados atualizados

## 7. Fluxos principais (prototipados no Figma)

- **Atleta:** Início → Reuniões → Detalhe → Vou participar → Presença confirmada → Antes de entrar → Sala ao vivo → Sair → Resumo → **Estou ciente** → Ciência confirmada → Seu próximo passo → Marcar como concluída → Tarefa concluída → Início.
- **Comissão, fluxo 1:** Início → Iniciar reunião → Nova reunião → Iniciar agora → Sala ao vivo → Encerrar → Encerrar e publicar → Publicar resumo → Resumo (acompanhamento).
- **Comissão, fluxo 2:** Registrar time → Continuar → Cadastro e convites → Cadastrar e enviar convite → Elenco.

Os pontos de partida do protótipo estão nas páginas 07 e 08. Para testar, selecione a primeira tela do fluxo e clique em Apresentar (▶).

## 8. Dados

Não há dados de exemplo. Pessoas, reuniões, decisões, tarefas, jogos e números vêm do cadastro feito pela comissão (etapa ainda a definir). Até lá, cada tela deve ter:

- **Estado vazio:** a mensagem e a ação para começar (ex.: "Nenhuma reunião marcada").
- **Campos sem conteúdo inventado:** rótulos e placeholders genéricos (ex.: "Nome do atleta", "Tema da reunião").

## 9. Histórico de decisões

1. O layout começou com dashboard, sala ao vivo, lousa, gravações, player e elenco.
2. Entraram o logo e as cores do Almirantes; ícones e layout foram refinados.
3. Entraram login do atleta, registro do time (com escolha de cor) e cadastro de atletas pela comissão.
4. Login e Registro passaram a usar a identidade **HUDDLE**.
5. A lousa foi refeita no padrão **Play Designer**.
6. Foi criada a tela **Nova reunião** por tema e público (ataque, defesa, posição).
7. **Toda a IA foi removida:**
   - "Resumo com IA" virou "Próximo jogo".
   - "Resumo da IA" virou "Anotações da comissão".
   - Transcrição virou Anotações, e legendas viraram Capítulos.
8. **O WhatsApp foi removido:** convites agora são por e-mail e "Avisar por WhatsApp" virou "Notificar no app".
9. **Corte de MVP:**
   - Telas novas: Encerramento, Resumo com ciência e mobile do atleta.
   - Sidebars, Início, Cadastro, Registro (em 2 passos) e Gravações foram simplificados.
   - A duração das reuniões foi mantida como estava.
10. Foram criadas as versões desktop dos fluxos de navegação do atleta e da comissão.
11. Na tela de acompanhamento da comissão, o chip "Você está ciente" virou o contador de cientes do time.
12. Foi criada a página com as telas finais organizadas para o Figma Make.
13. **Os dados de exemplo foram removidos:** o projeto não usa informação fictícia; tudo virá do cadastro.
14. **O HUDDLE passou a ser multitime:** as telas internas são modelos de lógica (fluxo, estados e permissões). Cada time que se cadastra usa do seu jeito, e o Almirantes é só a referência.
15. **Tema da reunião virou título livre:** a comissão escreve o tema como um título de vídeo. Saíram as opções pré-definidas (Tática de jogo, Análise do adversário etc.).

## 10. Pendências e próximos passos

- [x] **Tirar os dados fictícios da página 10** (telas para o Make): textos trocados por placeholders ("Nome do atleta", "Título da reunião", "dd/mm", "00:00", "0 de 0").
- [x] **Tirar os dados fictícios das páginas originais** (02, 03, 04, 05, 06, 07, 08 e 90) e dos componentes de sidebar/header da página 06.
- [ ] **Revisar elementos gráficos** que ainda sugerem dados: barras de progresso preenchidas e jogadores posicionados na lousa.
- [x] **Frontend funcional com dados locais:** registro do time, elenco e convites, reuniões, sala, resumo, ciência, tarefas e notificações.
- [ ] **Banco de dados e autenticação reais:** trocar `src/lib/store.ts`, incluindo o envio de e-mail de convite e de recuperação de senha.
- [x] **Vídeo ao vivo (LiveKit), gravações, lousa tática e playbook** no frontend.
- [ ] **Publicar no ZimaOS:** LiveKit em Docker, HTTPS com domínio, token validando a sessão e gravações no armazenamento do servidor.
- [ ] **Definir o cadastro e os dados reais** (time, comissão, atletas, reuniões).
- [ ] **Definir o que cada time configura** e o que é fixo: unidades (Ataque/Defesa/Ambos), posições, funções da comissão e a lousa (hoje com campo de flag football).
- [ ] **Conferir a contagem de telas** das páginas 03, 04 e 10 (o inventário lista 22 telas do atleta).
- [ ] **Equalizar o acabamento das telas desktop do atleta:** estão mais simples (sidebar sem ícones) que as da comissão.
- [ ] **Enviar as seções ao Figma Make,** uma por vez, começando por Desktop · Atleta, com o prompt `prompt-figma-make-huddle.md`.
- [ ] **Versão mobile da comissão** (não existe ainda; hoje a comissão é só desktop).
- [ ] **Validar com a comissão do time** os temas de reunião, as unidades e as permissões por função.

## 11. Frontend (código)

- **Stack:** React 19 + Vite + Tailwind v4 + `lucide-react`. Rotas por hash (`#/inicio`, `#/reunioes/:id/sala`…).
- **Dados:** ainda sem banco. Tudo passa por `src/lib/store.ts` (`api` + `useStore`), que grava no localStorage do navegador. Quando o banco entrar, **só esse arquivo muda**.
- **Sessão por aba:** cada aba pode estar logada com uma pessoa diferente (comissão numa, atleta na outra), e as abas se sincronizam.
- **Convites:** sem envio de e-mail por enquanto. Ao cadastrar uma pessoa, o app mostra o link de convite para copiar.
- **Tema:** a cor do time vira `--accent`, e fundos e bordas derivam dela. As telas de acesso usam a marca HUDDLE (classe `.hud`).
- **Vídeo (próprio, no servidor do time):** usa o LiveKit (open source).
  - A sala tem câmera, microfone, compartilhamento de tela e grade de participantes, além de pauta com cronômetro, chat, pessoas e notas.
  - O token de acesso é gerado em `server/livekitToken.ts`, que hoje roda como middleware do Vite em `/api/livekit/token`.
  - O endereço do servidor de vídeo vem de `VITE_LIVEKIT_URL`; o padrão é `ws://<host>:7880`.
- **Gravações:** a comissão grava pelo navegador. A captura pega a aba com o áudio da sala, mais o microfone de quem grava.
  - Cada troca de item da pauta vira um capítulo.
  - O player tem anotações da comissão com tempo marcado e a opção de quem pode assistir (convidados ou time todo).
  - Nesta fase, o arquivo fica no IndexedDB do navegador que gravou (`src/lib/blobs.ts`).
- **Lousa tática e playbook:**
  - A lousa tem campo de futebol americano/flag, futebol, quadra ou em branco; jogadores do time e adversários; rotas contínuas, tracejadas ou de bloqueio; texto, cores, desfazer e refazer.
  - Cada jogada pode ser publicada para grupos específicos.
  - O atleta só consulta.
- **Protótipo antigo** (exportado do Figma): guardado em `prototipo-figma/`, fora do build.
- **Rodar local:** use `iniciar-local.ps1`. Ele mapeia a unidade Y:, abre o LiveKit em modo de desenvolvimento (`%LOCALAPPDATA%\livekit\livekit-server.exe`, chave `devkey`/`secret`) e sobe o app em http://127.0.0.1:5174/.
- **No servidor (ZimaOS):**
  - O LiveKit roda em Docker (`livekit/livekit-server`) com chave e segredo próprios.
  - Portas: 7880 (sinalização), 7881/TCP e uma faixa UDP para mídia.
  - **Câmera e microfone só funcionam em HTTPS** (ou em `localhost`), então o acesso pela rede ou pela internet precisa de domínio com certificado e `wss://`.
- **Pasta na rede:** como o projeto está em `\\SERVIDOR`, o Vite não roda direto por caminho UNC. Mapeie uma unidade (`net use Y: \\SERVIDOR\ZimaOS-HD`) e rode `node node_modules/vite/bin/vite.js` a partir de `Y:`. Em pasta de rede o hot reload não funciona: recarregue a página (F5).

## 12. Notas técnicas (para quem continuar no Figma via Claude)

- **Origem das telas:** várias foram geradas em HTML e importadas com `html_to_figma`. Depois os ícones foram trocados por SVGs do Lucide (`lucide-static@0.460.0`), e as estrelas do logo foram trocadas por SVG limpo.
- **Instâncias nas telas desktop do atleta:** usam os componentes `HUDDLE / Atleta / Desktop sidebar` e `Desktop header`, que estão na página 06.
- **Cópias para o Make:** as telas da página 10 são cópias, sem interações de protótipo. Editar uma original **não** atualiza a cópia.
