// Perguntas frequentes (página /faq). Cada idioma tem os mesmos grupos e perguntas, na mesma ordem.
// {limit} e {months} são trocados pelas regras do plano Free (PublicPages.jsx). Valores dos planos ficam na
// página Planos (vêm da API), por isso não aparecem aqui.

export const FAQ = {
  'pt-BR': [
    {
      group: 'Primeiros passos',
      items: [
        ['O que é o KoneKtron?', 'É um sistema on-line para documentar projetos de engenharia de software e de análise de dados em um só lugar: análise de sistemas (requisitos, histórias de usuário e diagramas), CRISP-DM, BPM, Pontos de Função, Ontologias, CommonKADS, Diagnóstico de dados, Scrum e Kanban. No fim, você exporta o relatório em PDF, Word ou CSV.'],
        ['Como crio minha conta?', 'Clique em "Criar conta grátis" na página inicial, informe e-mail e senha (mínimo de 8 caracteres), aceite os Termos de Uso e confirme o e-mail pelo link que enviamos. Você também pode entrar com o Google, sem criar senha.'],
        ['Não recebi o e-mail de confirmação. E agora?', 'Confira a caixa de spam e de promoções. Se o link expirou, abra-o mesmo assim e use "Enviar novo link", ou entre no sistema: enquanto o e-mail não estiver confirmado, aparece a opção de reenviar.'],
        ['Existe um passo a passo de uso?', 'Sim. Baixe o tutorial em PDF pelo botão "Baixar tutorial (PDF)" na página inicial ou no fim desta página. Ele mostra, com imagens, do cadastro ao relatório final.'],
      ],
    },
    {
      group: 'Projetos e seções',
      items: [
        ['Qual tipo de projeto devo escolher?', 'Escolha "Software" para sistemas (libera Análise de Sistemas e Pontos de Função) ou "Análise de dados" para ciência de dados (libera o CRISP-DM). Ontologias, BPM, CommonKADS, Scrum, Kanban e Diagnóstico de dados funcionam nos dois tipos. O tipo não pode ser alterado depois.'],
        ['Preciso começar a documentação do zero?', 'Não. Na Análise de Sistemas, o botão "Usar modelo" traz uma ERS pronta (sistema web, app mobile, app desktop com ou sem internet) com textos, requisitos, casos de uso e diagramas. Nada que você já escreveu é apagado: o modelo só preenche o que está vazio.'],
        ['Como salvo o que escrevi?', 'Use o botão Salvar de cada formulário ou o atalho Ctrl+S. Se você tentar sair de uma página com alterações não salvas, o sistema avisa antes.'],
        ['Como gero o relatório do projeto?', 'Abra o projeto e vá até a aba "Relatório". Lá você baixa a documentação em PDF, em Word (DOCX) ou as tabelas em CSV, ou imprime direto do navegador.'],
        ['Como compartilho um projeto com a minha equipe?', 'O dono do projeto abre "Compartilhar", informa o e-mail da conta da outra pessoa e escolhe o acesso: o projeto inteiro ou só o Kanban. A pessoa precisa ter conta no KoneKtron. Cada participante usa as seções do próprio plano que também estão no plano do dono, e só o dono altera, exclui ou compartilha o projeto.'],
      ],
    },
    {
      group: 'Planos e pagamento',
      items: [
        ['O que o plano Free inclui?', 'Análise de Sistemas, Scrum, Kanban, a integração com IA e o compartilhamento de projetos. Você pode criar até {limit} projetos (excluir um projeto não libera a vaga), e projetos sem uso por {months} meses são excluídos; abrir o projeto renova o prazo.'],
        ['Qual a diferença entre Standard e Master?', 'O Standard acrescenta BPM e Pontos de Função, com projetos ilimitados. O Master libera todas as seções, inclusive CRISP-DM, Ontologias, CommonKADS e Diagnóstico de dados. Os valores atualizados estão na página Planos.'],
        ['Como pago a assinatura?', 'A cobrança é mensal pelo Asaas, com Pix, boleto ou cartão de crédito. Pix e cartão costumam ser confirmados na hora; boleto, em até 3 dias úteis. O plano é liberado assim que o pagamento é confirmado.'],
        ['Posso cancelar? Recebo o dinheiro de volta?', 'Sim, em Perfil › Assinatura. Cancelando em até 7 dias do primeiro pagamento, você recebe o valor integral de volta (direito de arrependimento). Depois disso, a cobrança para e você usa o plano até o fim do mês já pago. Seus projetos continuam salvos.'],
      ],
    },
    {
      group: 'Inteligência artificial',
      items: [
        ['Como funciona a IA? Ela tem custo?', 'Os botões "IA" ao lado dos campos geram, melhoram, resumem ou traduzem textos. Você pode conectar a sua própria conta de IA (Claude, GPT, Gemini, OpenRouter ou Ollama) em Perfil › IA, e o custo fica na sua conta. Sem conectar nada, o botão copia o pedido e abre o ChatGPT, Claude, Gemini ou Copilot na web, de graça.'],
        ['Minha chave de IA fica guardada no KoneKtron?', 'Não. A chave fica só no seu navegador e vai direto ao provedor de IA, nunca ao servidor do KoneKtron. Em computadores compartilhados, não marque a opção "Lembrar neste navegador". Revise sempre o texto gerado antes de salvar: a IA pode errar.'],
      ],
    },
    {
      group: 'Conta e segurança',
      items: [
        ['Esqueci minha senha.', 'Na tela de entrada, clique em "Esqueceu a senha", informe o e-mail e siga o link que enviaremos para escolher uma nova senha.'],
        ['Entro com o Google. Posso usar senha também?', 'Sim. Em Perfil › Segurança, use "Definir senha"; depois você entra das duas formas.'],
        ['Como mudo o idioma ou o tema?', 'Abra o menu (ícone no topo) e escolha o idioma (português, inglês ou espanhol) e o tema claro ou escuro na parte de baixo. O idioma também pode ser definido no seu Perfil.'],
        ['Como excluo minha conta?', 'Em Perfil › Segurança, use "Excluir minha conta" e confirme com a senha (ou com o e-mail, se a conta entra pelo Google). Se você assina um plano, cancele a assinatura antes.'],
        ['Minha dúvida não está aqui.', 'Fale com a gente pela página Contatos: a mensagem chega direto à equipe e respondemos pelo e-mail informado.'],
      ],
    },
  ],
  en: [
    {
      group: 'Getting started',
      items: [
        ['What is KoneKtron?', 'It is an online system to document software engineering and data analysis projects in one place: systems analysis (requirements, user stories and diagrams), CRISP-DM, BPM, Function Points, Ontologies, CommonKADS, Data diagnosis, Scrum and Kanban. At the end, you export the report as PDF, Word or CSV.'],
        ['How do I create my account?', 'Click "Create a free account" on the home page, enter your e-mail and a password (at least 8 characters), accept the Terms of Use and confirm your e-mail through the link we send. You can also sign in with Google, without a password.'],
        ['I did not get the confirmation e-mail. What now?', 'Check your spam and promotions folders. If the link expired, open it anyway and use "Send a new link", or sign in: while the e-mail is not confirmed, an option to resend it is shown.'],
        ['Is there a step-by-step guide?', 'Yes. Download the PDF tutorial with the "Download tutorial (PDF)" button on the home page or at the end of this page. It shows, with pictures, everything from sign-up to the final report. (The tutorial is in Portuguese.)'],
      ],
    },
    {
      group: 'Projects and sections',
      items: [
        ['Which project type should I choose?', 'Choose "Software" for systems (enables Systems Analysis and Function Points) or "Data analysis" for data science (enables CRISP-DM). Ontologies, BPM, CommonKADS, Scrum, Kanban and Data diagnosis work with both types. The type cannot be changed later.'],
        ['Do I have to start the documentation from scratch?', 'No. In Systems Analysis, the "Use template" button brings a ready-made SRS (web system, mobile app, desktop app with or without internet) with texts, requirements, use cases and diagrams. Nothing you already wrote is deleted: the template only fills what is empty.'],
        ['How do I save my work?', 'Use the Save button of each form or the Ctrl+S shortcut. If you try to leave a page with unsaved changes, the system warns you first.'],
        ['How do I generate the project report?', 'Open the project and go to the "Report" tab. There you download the documentation as PDF, Word (DOCX) or the tables as CSV, or print it from the browser.'],
        ['How do I share a project with my team?', 'The project owner opens "Share", enters the e-mail of the other person\'s account and picks the access: the whole project or only the Kanban. The person needs a KoneKtron account. Each participant uses the sections of their own plan that are also in the owner\'s plan, and only the owner edits, deletes or shares the project.'],
      ],
    },
    {
      group: 'Plans and payment',
      items: [
        ['What does the Free plan include?', 'Systems Analysis, Scrum, Kanban, the AI integration and project sharing. You can create up to {limit} projects (deleting a project does not free the slot), and projects unused for {months} months are deleted; opening the project renews the deadline.'],
        ['What is the difference between Standard and Master?', 'Standard adds BPM and Function Points, with unlimited projects. Master unlocks every section, including CRISP-DM, Ontologies, CommonKADS and Data diagnosis. Current prices are on the Plans page.'],
        ['How do I pay for a subscription?', 'Billing is monthly through Asaas, with Pix, bank slip (boleto) or credit card. Pix and card are usually confirmed right away; boleto within 3 business days. The plan is unlocked as soon as the payment is confirmed.'],
        ['Can I cancel? Do I get my money back?', 'Yes, in Profile › Subscription. If you cancel within 7 days of the first payment, you get the full amount back (right of withdrawal). After that, billing stops and you keep the plan until the end of the month already paid. Your projects stay saved.'],
      ],
    },
    {
      group: 'Artificial intelligence',
      items: [
        ['How does the AI work? Does it cost anything?', 'The "AI" buttons next to the fields generate, improve, summarize or translate texts. You can connect your own AI account (Claude, GPT, Gemini, OpenRouter or Ollama) in Profile › AI, and the cost goes to your account. Without connecting anything, the button copies the request and opens ChatGPT, Claude, Gemini or Copilot on the web, for free.'],
        ['Is my AI key stored by KoneKtron?', 'No. The key stays only in your browser and goes straight to the AI provider, never to the KoneKtron server. On shared computers, do not check "Remember in this browser". Always review the generated text before saving: AI can make mistakes.'],
      ],
    },
    {
      group: 'Account and security',
      items: [
        ['I forgot my password.', 'On the sign-in screen, click "Forgot the password", enter your e-mail and follow the link we send to choose a new password.'],
        ['I sign in with Google. Can I also use a password?', 'Yes. In Profile › Security, use "Set password"; after that you can sign in both ways.'],
        ['How do I change the language or the theme?', 'Open the menu (icon at the top) and pick the language (Portuguese, English or Spanish) and the light or dark theme at the bottom. The language can also be set in your Profile.'],
        ['How do I delete my account?', 'In Profile › Security, use "Delete my account" and confirm with your password (or with your e-mail, if the account signs in with Google). If you have a subscription, cancel it first.'],
        ['My question is not here.', 'Talk to us through the Contacts page: the message goes straight to the team and we reply to the e-mail you provide.'],
      ],
    },
  ],
  es: [
    {
      group: 'Primeros pasos',
      items: [
        ['¿Qué es KoneKtron?', 'Es un sistema en línea para documentar proyectos de ingeniería de software y de análisis de datos en un solo lugar: análisis de sistemas (requisitos, historias de usuario y diagramas), CRISP-DM, BPM, Puntos de Función, Ontologías, CommonKADS, Diagnóstico de datos, Scrum y Kanban. Al final, exportas el informe en PDF, Word o CSV.'],
        ['¿Cómo creo mi cuenta?', 'Haz clic en "Crear cuenta gratis" en la página de inicio, ingresa tu correo y una contraseña (mínimo 8 caracteres), acepta los Términos de Uso y confirma el correo con el enlace que enviamos. También puedes entrar con Google, sin contraseña.'],
        ['No recibí el correo de confirmación. ¿Y ahora?', 'Revisa la carpeta de spam y de promociones. Si el enlace expiró, ábrelo igual y usa "Enviar un nuevo enlace", o inicia sesión: mientras el correo no esté confirmado, aparece la opción de reenviarlo.'],
        ['¿Hay una guía paso a paso?', 'Sí. Descarga el tutorial en PDF con el botón "Descargar tutorial (PDF)" en la página de inicio o al final de esta página. Muestra, con imágenes, desde el registro hasta el informe final. (El tutorial está en portugués.)'],
      ],
    },
    {
      group: 'Proyectos y secciones',
      items: [
        ['¿Qué tipo de proyecto debo elegir?', 'Elige "Software" para sistemas (habilita Análisis de Sistemas y Puntos de Función) o "Análisis de datos" para ciencia de datos (habilita CRISP-DM). Ontologías, BPM, CommonKADS, Scrum, Kanban y Diagnóstico de datos funcionan con ambos tipos. El tipo no se puede cambiar después.'],
        ['¿Tengo que empezar la documentación desde cero?', 'No. En Análisis de Sistemas, el botón "Usar plantilla" trae una ERS lista (sistema web, app móvil, app de escritorio con o sin internet) con textos, requisitos, casos de uso y diagramas. Nada de lo que ya escribiste se borra: la plantilla solo completa lo que está vacío.'],
        ['¿Cómo guardo lo que escribí?', 'Usa el botón Guardar de cada formulario o el atajo Ctrl+S. Si intentas salir de una página con cambios sin guardar, el sistema te avisa antes.'],
        ['¿Cómo genero el informe del proyecto?', 'Abre el proyecto y ve a la pestaña "Informe". Allí descargas la documentación en PDF, en Word (DOCX) o las tablas en CSV, o la imprimes desde el navegador.'],
        ['¿Cómo comparto un proyecto con mi equipo?', 'El dueño del proyecto abre "Compartir", ingresa el correo de la cuenta de la otra persona y elige el acceso: el proyecto completo o solo el Kanban. La persona necesita una cuenta en KoneKtron. Cada participante usa las secciones de su propio plan que también están en el plan del dueño, y solo el dueño modifica, elimina o comparte el proyecto.'],
      ],
    },
    {
      group: 'Planes y pago',
      items: [
        ['¿Qué incluye el plan Free?', 'Análisis de Sistemas, Scrum, Kanban, la integración con IA y el uso compartido de proyectos. Puedes crear hasta {limit} proyectos (eliminar un proyecto no libera el cupo), y los proyectos sin uso durante {months} meses se eliminan; abrir el proyecto renueva el plazo.'],
        ['¿Cuál es la diferencia entre Standard y Master?', 'Standard agrega BPM y Puntos de Función, con proyectos ilimitados. Master habilita todas las secciones, incluidas CRISP-DM, Ontologías, CommonKADS y Diagnóstico de datos. Los precios actualizados están en la página Planes.'],
        ['¿Cómo pago la suscripción?', 'El cobro es mensual a través de Asaas, con Pix, boleto o tarjeta de crédito. Pix y tarjeta suelen confirmarse al instante; el boleto, en hasta 3 días hábiles. El plan se habilita en cuanto se confirma el pago.'],
        ['¿Puedo cancelar? ¿Me devuelven el dinero?', 'Sí, en Perfil › Suscripción. Si cancelas dentro de los 7 días del primer pago, recibes el importe completo (derecho de arrepentimiento). Después, el cobro se detiene y usas el plan hasta el final del mes ya pagado. Tus proyectos siguen guardados.'],
      ],
    },
    {
      group: 'Inteligencia artificial',
      items: [
        ['¿Cómo funciona la IA? ¿Tiene costo?', 'Los botones "IA" junto a los campos generan, mejoran, resumen o traducen textos. Puedes conectar tu propia cuenta de IA (Claude, GPT, Gemini, OpenRouter u Ollama) en Perfil › IA, y el costo va a tu cuenta. Sin conectar nada, el botón copia la solicitud y abre ChatGPT, Claude, Gemini o Copilot en la web, gratis.'],
        ['¿KoneKtron guarda mi clave de IA?', 'No. La clave queda solo en tu navegador y va directo al proveedor de IA, nunca al servidor de KoneKtron. En computadoras compartidas, no marques "Recordar en este navegador". Revisa siempre el texto generado antes de guardar: la IA puede equivocarse.'],
      ],
    },
    {
      group: 'Cuenta y seguridad',
      items: [
        ['Olvidé mi contraseña.', 'En la pantalla de inicio de sesión, haz clic en "Olvidé la contraseña", ingresa tu correo y sigue el enlace que enviaremos para elegir una nueva contraseña.'],
        ['Entro con Google. ¿Puedo usar contraseña también?', 'Sí. En Perfil › Seguridad, usa "Definir contraseña"; después puedes entrar de las dos formas.'],
        ['¿Cómo cambio el idioma o el tema?', 'Abre el menú (icono en la parte superior) y elige el idioma (portugués, inglés o español) y el tema claro u oscuro en la parte inferior. El idioma también se puede definir en tu Perfil.'],
        ['¿Cómo elimino mi cuenta?', 'En Perfil › Seguridad, usa "Eliminar mi cuenta" y confirma con tu contraseña (o con el correo, si la cuenta entra con Google). Si tienes una suscripción, cancélala antes.'],
        ['Mi pregunta no está aquí.', 'Escríbenos desde la página Contacto: el mensaje llega directo al equipo y respondemos al correo que indiques.'],
      ],
    },
  ],
};
