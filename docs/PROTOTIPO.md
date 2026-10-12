# Protótipo — alterações para a API 3.4 e a especificação 3.3

O app segue o protótipo original (Figma) e o Design System KonekTron 1.0.0. As telas abaixo
mudaram para refletir a API e a especificação de requisitos 3.3. Os prints do app atual estão
em [`docs/prototipo/`](prototipo/) e substituem o protótipo como referência visual.

## Mantido do protótipo

- Cabeçalho azul com "KoneKtron" e menu (hambúrguer), migalhas de pão, rodapé azul com site,
  e-mail, logos KoneKtron/OrkneyTech e créditos.
- Cartão com faixa laranja e logo nas telas de acesso; campos com ícone azul à esquerda.
- Menu lateral laranja à direita, com ícones e o logo "Engineering & Design" no rodapé.
- Avisos no topo da página (erro rosa, sucesso azul-claro), carregamento com arco laranja.
- Cartões azuis com ícone (Sobre, Contatos) e acordeão azul nos Termos.

## Alterado

| Tela | Protótipo | App | Motivo |
| --- | --- | --- | --- |
| Signup | Campo "User", aceite por botão de opção | Campo **E-mail**, **Confirmar senha** e caixa de seleção com link para os Termos | A API identifica a conta pelo e-mail; UC001 R2 exige confirmação; o aceite é obrigatório (RN1.3) |
| Signin | Campo "User", Google ativo | Campo **E-mail**; botão Google **desabilitado com "em breve"** | Login social ainda é planejado (RF2, RN2.4) |
| Recover | — | Mantida; resposta igual para qualquer e-mail | RN4.1: não revelar quais e-mails existem |
| Novas | — | **Nova senha** (`/reset-password`) e **Confirmar e-mail** (`/verify-email`) | Destinos dos links que a API envia por e-mail |
| Menu | Itens fixos; "Projeto"/"Services"/"Products" | Início, Sobre, Projetos, Engenharia, Termos, Docs, Contatos + Perfil, Administração (admin) e Sair, ou Entrar/Cadastrar | Itens conforme o login e o papel; "Docs" abre a documentação da API; troca de idioma EN/PT (RNF5) |
| Sobre / Contatos | Fotos de banco de imagens, "Title 1 / Paragraph" | Texto real da especificação e identidade da marca | Sem licença das fotos; conteúdo provisório substituído |
| Termos | Itens 6–9 "Item I–IV" | Conta e segurança, Planos e cobrança, Propriedade intelectual, Contato | Conteúdo real; **rascunho sujeito a revisão jurídica** |
| Novas (área logada) | — | Projetos, Engenharia, Perfil (dados, redes, endereços, segurança), Análise de Sistemas, CRISP-DM, Relatórios e Administração | RF3, RF5, RF6, RF8–RF12 não tinham telas no protótipo |

## Decisões de design system

- **Links em texto** usam a cor análoga B (`#0B74E3`, contraste 4,7:1). O azul da marca
  (`#019BCD`) fica para fundos: com texto branco ele tem contraste 3:1, abaixo do mínimo de
  4,5:1 para texto normal (WCAG AA). Os botões primários mantêm o azul do protótipo; se o
  teste de usabilidade (RNF4) apontar dificuldade de leitura, troque o fundo por `#0B74E3`.
- Tipografia: Roboto nos títulos (DS "Sans serif"), Inter no corpo (DS "Other families"),
  tamanhos e entrelinhas dos tokens Display, Headings e Paragraph.
- O logo da OrkneyTech e o "KoneKtron Engineering & Design" foram **recortados dos prints do
  protótipo** (`public/brand/*.png`). Substitua pelos arquivos originais (SVG) quando possível.
