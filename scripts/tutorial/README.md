# Tutorial do usuário (PDF)

Gera `public/docs/tutorial-konektron.pdf`, baixado pela página inicial e pelo FAQ.

- `tutorial.html` — texto e layout do tutorial; `{{img:nome}}` aponta para uma captura `nome.png`.
- `capture.mjs` — abre o app e salva as capturas.
- `build.mjs` — converte as capturas para JPEG, monta o HTML e imprime o PDF com o Chrome.

## Como regenerar

1. Suba a API com um banco **local de testes** (nunca o de produção) e o app (`VITE_API_PROXY=... npx vite`).
2. Crie uma conta de demonstração com plano Master e um projeto de software com alguns requisitos, diagramas e
   cartões no Kanban (as imagens atuais usam o projeto "Agendamento Online").
3. Instale o Puppeteer sem alterar o `package.json`: `npm i --no-save puppeteer-core`.
4. Capture e gere:

```sh
TUTORIAL_EMAIL=... TUTORIAL_PASSWORD=... TUTORIAL_PROJECT=<id do projeto> node scripts/tutorial/capture.mjs ./capturas
node scripts/tutorial/build.mjs ./capturas
```

`CHROME_PATH` aponta para outro Chrome/Edge, se necessário. Não versione a pasta de capturas.
