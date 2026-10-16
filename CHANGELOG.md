# Changelog

## 2.4.0 — 2026-10-16

### Adicionado
- **Assinatura dos planos pelo PagBank** (requer a API 4.3.0): os cartões de plano mostram a mensalidade e o
  botão **Assinar**. O visitante cria a conta e segue direto para o checkout (`/signup?next=/checkout/:plan`).
- Página `/checkout/:plan`: resumo do plano, preço e como funciona a cobrança; **Ir para o pagamento**
  redireciona para a página segura do PagBank (cartão de crédito, cobrança mensal automática).
- Página `/billing/return`: na volta do PagBank, confere o pagamento, renova a sessão e libera o plano na hora;
  sem confirmação, oferece continuar o pagamento.
- Página pública `/plans` (também no menu) e aba **Assinatura** no perfil: situação, próxima cobrança,
  histórico, mudar de plano e cancelar.
- Textos em português, inglês e espanhol e testes das telas.
- Checkout com aceite obrigatório dos Termos e da cobrança mensal; avisos de arrependimento (estorno integral
  em até 7 dias) e de cancelamento com acesso até o fim do período pago.

### Alterado
- **Termos de Uso**: cobrança em reais pelo PagBank (antes dizia "em dólar"), renovação mensal automática,
  falha de cobrança, cancelamento e arrependimento (CDC art. 49), processamento do cartão pelo PagBank (LGPD),
  aviso prévio de 30 dias para reajustes e métodos citados como marcas de terceiros.
- E-mail de contato: konektron@orkneytech-lab.com (rodapé, Contatos e Termos).

## 2.3.0 — 2026-10-16

### Alterado
- **Menu sanduíche redesenhado**: painel claro e legível (o laranja com texto branco não tinha contraste
  suficiente), com cabeçalho no estilo da marca mostrando quem está logado (avatar, e-mail, plano e papel, com
  link para o perfil) ou, para visitantes, os botões Entrar e Cadastrar.
- Itens alinhados à esquerda, com ícone e indicação clara da página atual, em grupos: Navegar (Início, Meus
  projetos, Engenharia), Sua conta (Perfil, Administração, Sair) e Ajuda e informações (Sobre, Contatos,
  Termos, Documentação da API, que abre em nova aba).
- Preferências no rodapé do menu: tema claro/escuro (antes só na Home) e idioma.
- Acessibilidade: o menu é um diálogo, o Tab fica dentro dele, Esc fecha e devolve o foco ao botão, e a página
  atrás não rola enquanto ele está aberto.
- Cabeçalho: botão "Menu" com rótulo (só o ícone no celular) e o usuário com avatar, levando ao perfil.

### Removido
- Aviso "Rascunho — sujeito a revisão jurídica" da página de Termos de Uso.

## 2.2.0 — 2026-10-16

Requer a API 4.2.0.

### Adicionado
- Sprint: botão **Publicar no Kanban** no quadro de tasks (publica as tasks ainda fora do Kanban; itens do
  Sprint Backlog sem tasks ganham uma), atalho **Abrir o Kanban** e o ícone do Kanban nas tasks publicadas.
- Seção **Incremento entregue** na sprint: itens e tasks concluídos (no Scrum ou movendo o cartão no Kanban),
  com data de conclusão e pontos entregues; os Artefatos listam os itens entregues de cada sprint.
- Kanban: cartões de tasks do Scrum mostram a sprint e o item (link para a sprint) e um aviso no formulário;
  colunas ganham o campo "Situação das tasks do Scrum", exibido abaixo do nome. As colunas padrão já vêm
  marcadas (A fazer, Em andamento, Concluído).

## 2.1.0 — 2026-10-15

Requer a API 4.1.0.

### Adicionado
- **Formulário de contato** na página Contatos (nome, e-mail, assunto e mensagem, com aviso antes de sair com a
  mensagem não enviada) e a aba **Mensagens** na administração: filtro por situação, leitura (abrir marca como
  lida), responder por e-mail, mudar a situação e excluir.
- Aba **Pontos de Função** (projetos de software, plano Master): contagens com o total de PF e a página da contagem
  no formato das planilhas — tipo de contagem, determinação do escopo (ALI/AIE), tabela de complexidade (TD/TR) e
  tabela de contribuição IFPUG — com o cadastro das funções (complexidade e PF calculados), estimativa de esforço e
  custo e as tabelas de referência do IFPUG.
- Aba **Scrum** (qualquer tipo de projeto, planos Standard e Master): visão geral com a sprint atual, burndown e
  velocidade; projeto e papéis (Product Owner, Scrum Master, Developers); Product Backlog ordenável; sprints com
  Sprint Backlog, quadro de tasks e eventos; eventos (planning, daily, review, retrospectiva, refinamento); e
  artefatos com os seus compromissos (Meta do Produto, Meta da Sprint, Definição de Pronto) e os incrementos.
- Gráficos de burndown e velocidade em SVG, com legenda, tooltip, foco pelo teclado e os dados em tabela.

## 2.0.0 — 2026-10-14

Requer a API 4.0.0.

### Removido
- Aba **Visão de Sistema** (casos de uso, diagrama UML, BDD): a Análise de Sistemas continua como está e já
  cobre requisitos, histórias de usuário e diagramas.

### Adicionado
- Aba **Ontologias** (plano Master, qualquer tipo de projeto): catálogo com resumo (totais, métricas, uso de
  vocabulários e princípios) e página da ontologia com todos os dados — formato, IRI, versão, situação, contagens
  de classes, relacionamentos, propriedades e objetos, vocabulários (Schema.org, RDFS, RDFa, SKOS, Dublin Core...),
  princípios (FAIR, CARE...), URL de publicação, questões de competência — e o envio do arquivo (OWL, RDF, Turtle,
  JSON-LD, OBO...), com a leitura do arquivo ao lado das métricas cadastradas e o botão para usar as do arquivo.
- Aba **BPM** (planos Standard e Master): arquitetura de processos em árvore, processos com SIPOC, indicadores,
  problemas e melhorias, e diagramas AS IS / TO BE com upload de BPMN 2.0 (contagem de tarefas, eventos, gateways,
  pools e raias, nomes das tarefas), imagem com pré-visualização ou PDF.
- Aba **CommonKADS** (plano Master): visão geral com progresso, lacunas entre os modelos e a situação das 17
  planilhas; planilhas OM-1, OM-2, OM-5, OTA-1, KM-1 e DM-1 a DM-4 no formato dos modelos (Nº, item, orientação,
  preenchimento); cadastros OM-3/TM-1 (tarefas), OM-4/TM-2 (conhecimento, com natureza, forma, disponibilidade e
  gargalos), AM-1/MAS (agentes) e CM-1/CM-2 (transações, com itens de informação e mensagens); documento completo
  para imprimir/PDF. Textos das planilhas em PT, EN e ES.
- Abas fora do plano aparecem com cadeado e explicam em que plano a seção está.
- Envio de arquivos (arrastar e soltar ou escolher), download e remoção.

- Usabilidade em todas as telas:
  - botão **Voltar** à direita da barra de navegação, sempre para o nível acima (Tarefa → Tarefas → CommonKADS → Projeto →
    Projetos → Início), funcionando também quando a página é aberta por link direto;
  - aviso antes de sair de um formulário com **alterações não salvas** (links, Voltar, fechar ou recarregar a aba) e
    o indicador "Alterações não salvas" ao lado do botão Salvar;
  - **Ctrl+S / ⌘S** salva o formulário em foco;
  - título da aba do navegador com a página atual (ex.: "Tarefas · CommonKADS · KoneKtron");
  - botão flutuante "voltar ao topo" nas páginas longas;
  - o foco vai para o conteúdo a cada navegação (teclado e leitores de tela).

### Alterado
- Página **Seções de engenharia** colorida: cada seção com a sua cor, cabeçalho no estilo do hero da Home
  (gradiente, grade técnica, ícone em destaque), selos de situação, plano e tipo de projeto, botão na cor da seção,
  resumo "no seu plano / em breve" e seções futuras com cartão tracejado.
- **Meus projetos** com cartões no mesmo estilo, na cor do tipo de projeto (Software em azul, Análise de dados em
  verde), título em até duas linhas, data de atualização e resumo no topo.
- Cartões de métricas de todas as visões gerais (Análise de Sistemas, CRISP-DM, Ontologias, BPM, CommonKADS e
  Administração) tingidos na cor de cada um, com ícone em destaque; tabelas de contagem da Análise de Sistemas e da
  Administração em painéis com cabeçalho colorido; fases do CRISP-DM coloridas pela situação.
- Temas claro e escuro das telas internas com a linguagem visual da página inicial: fundo azul-gelo (ou
  azul-noite), cabeçalhos com o gradiente e a grade técnica do hero e borda laranja, cabeçalho do app com faixa
  laranja, cartões de métricas com barras de cores alternadas, abas em faixa azul-gelo, pílulas de sub-navegação,
  tabelas com cabeçalho azulado, modais com cabeçalho da marca e telas de entrada com cabeçalho laranja.

## 1.4.0 — 2026-10-13

### Adicionado
- Botão **"Importar da Análise de Sistemas"** na Visão de Sistema: escolha o projeto de origem (este ou
  outro projeto de software), marque o que trazer, veja a prévia (novos × já existentes, casos de uso e
  stakeholders gerados) e importe. Projetos vazios sugerem a importação na visão geral.

## 1.3.0 — 2026-10-13

### Adicionado
- Aba **Visão de Sistema** nos projetos de software (planos Standard e Master), com Visão geral,
  Especificação, Casos de uso, BDD e Documento:
  - casos de uso no formato de Guedes, com editor de cenários (ações do ator e do sistema);
  - diagrama de casos de uso UML desenhado a partir dos dados (atores, fronteira do sistema,
    `«include»`, `«extend»` e generalização), exportável em PlantUML, ao lado dos diagramas de
    caso de uso já cadastrados;
  - cenários BDD e arquivos `.feature` para baixar, em PT, EN ou ES;
  - documento de especificação para imprimir/PDF, com matriz de rastreabilidade requisito × caso de uso.
- Requisitos de domínio (RD) na Análise de Sistemas.
- Campo de múltipla escolha nos formulários (vínculo de requisitos).

## 1.2.0 — 2026-10-12

### Adicionado
- Versão em espanhol (interface, Termos de Uso e tarefas do CRISP-DM).
- Botão de idioma no cabeçalho (PT · EN · ES), em todas as páginas; o menu lateral e o perfil
  também oferecem os três idiomas.

### Alterado
- Português (Brasil) é o idioma padrão, inclusive em navegadores configurados em outro idioma.
  A escolha do usuário fica salva no navegador.

## 1.1.0 — 2026-10-12

### Adicionado
- Aba **Kanban** em todos os projetos: colunas e cartões com arrastar e soltar, setas para
  mover pelo teclado, limite WIP, prioridade, prazo e responsável; colunas padrão em um clique.
- Tema escuro: botão na Home alterna claro/escuro para o app inteiro; a escolha fica salva e,
  sem escolha, segue o sistema. Relatórios impressos saem sempre claros.

### Alterado
- Home redesenhada em faixas coloridas: hero com números, "Como funciona", cartões de seções
  e planos comparativos (Kanban em todos), chamada final.
- Engenharia e Home usam o mesmo catálogo de seções, planos e ícones.

## 1.0.0 — 2026-10-12

Primeira versão do app web, alinhada à API 3.4 e à Especificação de Requisitos 3.3.

### Adicionado
- Design System KonekTron 1.0.0 sobre Bootstrap 5.3 (cores, tipografia, ícones Bootstrap Icons).
- Telas do protótipo adaptadas à API: Entrar, Cadastrar, Recuperar senha, Termos, Sobre,
  Contatos, menu lateral, avisos e carregamento.
- Novas telas: Nova senha, Confirmar e-mail, Projetos, Engenharia, Perfil (dados, redes sociais,
  endereços, segurança), Análise de Sistemas, CRISP-DM, relatórios para PDF e Administração.
- Inglês e português (RNF5), com o idioma do perfil aplicado à interface.
- Sessão com renovação automática e serializada entre abas.
- Testes com Vitest; ESLint 9.
