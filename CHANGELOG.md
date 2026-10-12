# Changelog

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
