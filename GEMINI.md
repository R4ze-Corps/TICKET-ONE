# Project Instructions

- **Documentation**: Always consult the following documentation sites for any tasks:
  - [Discord Developer Documentation](https://docs.discord.com/developers/intro)
  - [Constatic Documentation](https://constatic-docs.vercel.app)

# Sistema de Tickets - Documentação do Projeto

## 🚀 Funcionalidades Implementadas
O sistema foi desenvolvido utilizando as tecnologias mais recentes do Discord (**Components V2** e **Modais V2**) via framework **Constatic**.

### 1. Sistema de Abertura (Painel Principal)
- **Comando**: `/ticket painel` - Envia o painel de abertura de tickets.
- **Visual**: Utiliza `createContainer` (Azoxo) com cabeçalho limpo e avatar do usuário.
- **Formulário**: Ao clicar em "Abrir Ticket", abre um **Modal V2** contendo um Select Menu de Categorias e um campo de Descrição.

### 2. Roteamento Inteligente
- **Comando**: `/ticket configurar` - Define canal de logs e categorias específicas para cada assunto.
- **Lógica**: Tickets de *Suporte*, *Denúncia*, *Financeiro* e *Bugs* são criados automaticamente em suas respectivas categorias configuradas no Discord.

### 3. Gerenciamento de Tickets
- **Claim (Assumir)**: Staff pode assumir o ticket. O painel se atualiza com o avatar do staff e o dono recebe uma **DM de Notificação**.
- **Largar Atendimento**: Staff pode devolver o ticket ao estado de "Aguardando", restaurando o botão de assumir.
- **Painel Admin**: Menu efêmero (privado) com ferramentas:
  - **Membros**: Adicionar/Remover usuários via Select Menu dentro de modal.
  - **Renomear**: Mudar o nome do canal mantendo o ID.
  - **Notificar**: Envia uma DM manual chamando o usuário de volta ao ticket.
  - **Transcript**: Gera log manual em tempo real.

### 4. Ciclo de Vida e Transcript Online
- **Finalização**: Processo interativo onde o staff preenche as **Considerações Finais** e escolhe se quer salvar o transcript.
- **Transcript Web**: Sistema integrado com **Next.js hospedado na Vercel** (`ticket-topaz.vercel.app`).
- **Logs Automáticos**: Ao deletar o canal, o bot salva todas as mensagens no banco e envia o link do log para o canal de Staff.

## 🛠️ Detalhes Técnicos
- **Banco de Dados**: MongoDB Atlas (Coleções: `guilds`, `tickets`, `transcripts`).
- **Framework**: `@constatic/base` + `@magicyan/discord`.
- **Hospedagem Web**: Vercel (conectado via GitHub).
- **Variáveis de Ambiente**:
  - `MONGO_URI`: Conexão com o banco.
  - `WEB_URL`: Link base do site na Vercel para geração de transcripts.

## 📂 Estrutura de Arquivos Principais
- `src/discord/commands/staff/ticket.ts`: Configuração e Painel.
- `src/discord/responders/ticket/submit.ts`: Abertura e Modais.
- `src/discord/responders/ticket/manage.ts`: Botões de gestão e Transcript.
- `src/discord/responders/ticket/admin.ts`: Lógica de Renomear e Finalização.
- `web/`: Aplicação Next.js para visualização dos logs.
