# Changelog

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
