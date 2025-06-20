# 🚀 Discord Bot Completo

Um bot Discord multifuncional e profissional com sistemas avançados de gerenciamento de servidor, VIP, tickets, verificação e muito mais.

## 📋 Índice

- [✨ Funcionalidades](#-funcionalidades)
- [🚀 Instalação](#-instalação)
- [⚙️ Configuração](#️-configuração)
- [📚 Comandos](#-comandos)
- [🗂️ Estrutura de Arquivos](#️-estrutura-de-arquivos)
- [💾 Banco de Dados](#-banco-de-dados)
- [🔧 Personalização](#-personalização)
- [📱 Screenshots](#-screenshots)
- [❓ FAQ](#-faq)
- [🤝 Contribuição](#-contribuição)
- [📞 Suporte](#-suporte)

## ✨ Funcionalidades

### 🎯 Sistemas Principais

#### 👥 **Sistema de Membros**
- **Entrada automática**: Logs detalhados com idade da conta
- **Saída automática**: Limpeza completa de todos os dados
- **Auto-verificação**: Para contas com mais de 7 dias
- **Auto-roles**: Configuráveis por entrada, nível ou tempo
- **Alertas de segurança**: Para contas muito novas (possível spam)

#### 🎤 **Sistema de Ranking por Voz**
- **Tracking automático**: Tempo total e sessões contabilizadas
- **Recuperação após restart**: Não perde dados em reinicializações
- **XP por tempo**: 1 XP por minuto em call
- **Ranking completo**: Top usuários por tempo de voz
- **Estatísticas detalhadas**: Histórico de sessões

#### 👑 **Sistema VIP Completo**
- **4 tipos de VIP**: Bronze, Prata, Ouro, Diamante
- **Calls VIP personalizadas**: Com nomes customizados
- **Tags VIP**: Tags personalizadas para cada usuário
- **Expiração automática**: VIPs temporários
- **Benefícios escaláveis**: Mais benefícios por tipo

#### 🎫 **Sistema de Tickets**
- **Tickets por categoria**: Suporte, vendas, relatórios
- **Calls privadas**: Para cada ticket
- **Sistema de prioridades**: Baixa, normal, alta, urgente
- **Histórico completo**: Todas as mensagens salvas
- **Auto-fechamento**: Quando membro sai do servidor

#### ✅ **Sistema de Verificação**
- **Verificação manual**: Por moderadores
- **Verificação automática**: Para contas antigas
- **Códigos únicos**: Sistema de códigos temporários
- **Configurações flexíveis**: Idade mínima da conta configurável

### 🛡️ Sistemas de Moderação

#### ⚠️ **Sistema de Warnings**
- **Advertências graduais**: Baixa, média, alta severidade
- **Expiração automática**: Warnings temporários
- **Histórico completo**: Todas as advertências registradas
- **Punições automáticas**: Baseadas em quantidade de warns

#### 🚫 **Filtro de Palavras**
- **Ações configuráveis**: Deletar, avisar, mutar, expulsar
- **Severidade por palavra**: Diferentes níveis de gravidade
- **Lista personalizável**: Adicionar/remover palavras
- **Logs detalhados**: Registro de todas as ocorrências

#### 🔨 **Sistema de Punições**
- **Mute temporário**: Com duração configurável
- **Kick automático**: Para infrações graves
- **Ban temporário**: Com possibilidade de appeal
- **Logs de moderação**: Histórico completo de ações

### 📊 Sistemas de Dados

#### 📈 **Sistema de Níveis e XP**
- **XP por mensagem**: 10-25 XP aleatório por mensagem
- **XP por voz**: 1 XP por minuto em call
- **Cooldown anti-spam**: 1 minuto entre ganhos de XP
- **Níveis automáticos**: Cálculo baseado em XP total
- **Recompensas por nível**: Auto-roles e benefícios

#### 💾 **Backup e Recuperação**
- **Backup automático**: Dados salvos quando membro sai
- **Recuperação de dados**: Possibilidade de restaurar
- **Limpeza automática**: Backups antigos removidos
- **Dados expirados**: Limpeza periódica automática

#### 📊 **Estatísticas Avançadas**
- **Métricas do servidor**: Membros, mensagens, tempo de voz
- **Relatórios detalhados**: Atividade e engagement
- **Gráficos de crescimento**: Histórico de estatísticas
- **Export de dados**: Relatórios em JSON

### 🎮 Sistemas Auxiliares

#### 🎯 **Comandos Personalizados**
- **Sistema !comando**: Comandos customizados pelo servidor
- **Respostas dinâmicas**: Com variáveis e mencões
- **Contador de usos**: Estatísticas de popularidade
- **Permissões por comando**: Controle de acesso

#### 🔄 **Sistema de Interações**
- **Botões interativos**: Para tickets, VIP, verificação
- **Modals avançados**: Formulários personalizados
- **Select menus**: Seleções múltiplas
- **Cooldowns inteligentes**: Prevenção de spam

## 🚀 Instalação

### Pré-requisitos

- **Node.js** v16.9.0 ou superior
- **NPM** ou **Yarn**
- **Bot Discord** criado no [Discord Developer Portal](https://discord.com/developers/applications)

### Passo a Passo

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/discord-bot-completo.git
cd discord-bot-completo
```

2. **Instale as dependências**
```bash
npm install
# ou
yarn install
```

3. **Configure o ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com seus dados
```

4. **Configure o bot**
```env
DISCORD_TOKEN=seu_token_do_bot_aqui
```

5. **Inicie o bot**
```bash
npm start
# ou
node index.js
```

## ⚙️ Configuração

### 📁 Estrutura Inicial

O bot criará automaticamente:
- **Banco de dados SQLite** (`database.db`)
- **Estrutura de comandos** (`commands/`)
- **Todas as tabelas** necessárias

### 🛠️ Configuração do Servidor

Use o comando `/setup` para configurar:

```
/setup log_channel #logs           # Canal de logs
/setup ticket_category tickets     # Categoria de tickets
/setup vip_category vip            # Categoria VIP
/setup welcome_channel #bem-vindos # Canal de boas-vindas
/setup auto_role @Membro           # Cargo automático
/setup mute_role @Mutado           # Cargo de mute
```

### 🔐 Permissões Necessárias

O bot precisa das seguintes permissões:

**Básicas:**
- Ler mensagens
- Enviar mensagens
- Inserir links
- Anexar arquivos
- Ler histórico de mensagens

**Avançadas:**
- Gerenciar canais
- Gerenciar cargos
- Gerenciar mensagens
- Expulsar membros
- Silenciar membros
- Conectar em canais de voz
- Ver canais de voz

## 📚 Comandos

### 👑 Comandos de Administração

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/setup` | Configurar o bot | `/setup <opção> <valor>` |
| `/members stats` | Estatísticas de membros | `/members stats` |
| `/members cleanup` | Limpeza manual de dados | `/members cleanup @usuário` |
| `/members recent` | Membros recentes | `/members recent [limite]` |
| `/debug voice` | Debug sistema de voz | `/debug voice [usuário]` |
| `/debug tickets` | Debug sistema de tickets | `/debug tickets` |
| `/backup create` | Criar backup manual | `/backup create` |

### 🛡️ Comandos de Moderação

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/warn` | Advertir usuário | `/warn @usuário [motivo]` |
| `/warnings` | Ver advertências | `/warnings @usuário` |
| `/mute` | Silenciar usuário | `/mute @usuário [tempo] [motivo]` |
| `/unmute` | Remover silêncio | `/unmute @usuário` |
| `/kick` | Expulsar usuário | `/kick @usuário [motivo]` |
| `/ban` | Banir usuário | `/ban @usuário [tempo] [motivo]` |
| `/filter add` | Adicionar palavra | `/filter add <palavra> [ação]` |
| `/filter remove` | Remover palavra | `/filter remove <palavra>` |

### 👑 Comandos VIP

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/vip add` | Adicionar VIP | `/vip add @usuário <tipo> [tempo]` |
| `/vip remove` | Remover VIP | `/vip remove @usuário` |
| `/vip list` | Listar VIPs | `/vip list [tipo]` |
| `/vip call` | Criar call VIP | `/vip call [nome]` |
| `/vip tag` | Definir tag VIP | `/vip tag <tag>` |
| `/vip info` | Info do VIP | `/vip info [@usuário]` |

### 🎫 Comandos de Ticket

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/ticket` | Criar ticket | `/ticket [tipo]` |
| `/ticket close` | Fechar ticket | `/ticket close [motivo]` |
| `/ticket add` | Adicionar usuário | `/ticket add @usuário` |
| `/ticket remove` | Remover usuário | `/ticket remove @usuário` |
| `/ticket call` | Criar call do ticket | `/ticket call` |
| `/ticket priority` | Alterar prioridade | `/ticket priority <nível>` |

### 📊 Comandos de Ranking

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/rank voice` | Ranking de voz | `/rank voice [página]` |
| `/rank messages` | Ranking de mensagens | `/rank messages [página]` |
| `/rank levels` | Ranking de níveis | `/rank levels [página]` |
| `/profile` | Seu perfil | `/profile [@usuário]` |
| `/stats` | Estatísticas gerais | `/stats` |

### ✅ Comandos de Verificação

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/verify` | Verificar usuário | `/verify @usuário` |
| `/unverify` | Remover verificação | `/unverify @usuário` |
| `/verification setup` | Configurar verificação | `/verification setup` |
| `/verification stats` | Stats de verificação | `/verification stats` |

### 🎮 Comandos Utilitários

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/help` | Ajuda geral | `/help [comando]` |
| `/ping` | Latência do bot | `/ping` |
| `/uptime` | Tempo online | `/uptime` |
| `/serverinfo` | Info do servidor | `/serverinfo` |
| `/userinfo` | Info do usuário | `/userinfo [@usuário]` |

## 🗂️ Estrutura de Arquivos

```
discord-bot-completo/
├── 📄 index.js                 # Arquivo principal do bot
├── 📄 deploy-commands.js       # Script para registrar comandos
├── 📄 package.json            # Dependências e scripts
├── 📄 .env                    # Variáveis de ambiente
├── 📄 .env.example           # Exemplo de configuração
├── 📄 database.db            # Banco de dados SQLite (gerado automaticamente)
├── 📄 README.md              # Esta documentação
├── 📁 commands/              # Pasta de comandos
│   ├── 📁 admin/             # Comandos administrativos
│   │   ├── setup.js          # Configuração do servidor
│   │   ├── members.js        # Gerenciamento de membros
│   │   ├── debug.js          # Ferramentas de debug
│   │   └── backup.js         # Sistema de backup
│   ├── 📁 moderation/        # Comandos de moderação
│   │   ├── warn.js           # Sistema de advertências
│   │   ├── mute.js           # Sistema de mute
│   │   ├── kick.js           # Sistema de kick
│   │   ├── ban.js            # Sistema de ban
│   │   └── filter.js         # Filtro de palavras
│   ├── 📁 vip/               # Comandos VIP
│   │   ├── vip.js            # Gerenciamento VIP
│   │   ├── call.js           # Calls VIP
│   │   └── tag.js            # Tags VIP
│   ├── 📁 tickets/           # Sistema de tickets
│   │   ├── ticket.js         # Comandos de ticket
│   │   ├── close.js          # Fechar tickets
│   │   └── call.js           # Calls de ticket
│   ├── 📁 ranking/           # Sistemas de ranking
│   │   ├── voice.js          # Ranking de voz
│   │   ├── messages.js       # Ranking de mensagens
│   │   ├── levels.js         # Sistema de níveis
│   │   └── profile.js        # Perfil do usuário
│   ├── 📁 verification/      # Sistema de verificação
│   │   ├── verify.js         # Comandos de verificação
│   │   └── setup.js          # Configurar verificação
│   └── 📁 utility/           # Comandos utilitários
│       ├── help.js           # Sistema de ajuda
│       ├── ping.js           # Latência
│       ├── serverinfo.js     # Info do servidor
│       └── userinfo.js       # Info do usuário
├── 📁 events/                # Eventos do Discord (opcional)
├── 📁 utils/                 # Funções auxiliares (opcional)
└── 📁 config/                # Arquivos de configuração (opcional)
```

## 💾 Banco de Dados

### 📊 Tabelas Principais

O bot utiliza **20 tabelas SQLite** para armazenar todos os dados:

#### 🗂️ Configurações
- **guild_settings**: Configurações do servidor
- **verification_settings**: Configurações de verificação
- **auto_roles**: Cargos automáticos

#### 👥 Usuários
- **voice_time**: Tempo de voz e ranking
- **message_count**: Contador de mensagens
- **user_levels**: Sistema de XP e níveis
- **verifications**: Usuários verificados

#### 👑 Sistema VIP
- **vips**: Usuários VIP e expiração
- **vip_tags**: Tags personalizadas
- **vip_calls**: Calls VIP criadas

#### 🎫 Sistema de Tickets
- **tickets**: Tickets criados
- **ticket_calls**: Calls dos tickets
- **ticket_messages**: Histórico de mensagens

#### 🛡️ Moderação
- **warnings**: Sistema de advertências
- **auto_punishments**: Punições automáticas
- **word_filters**: Filtro de palavras
- **mod_logs**: Logs de moderação

#### 📊 Dados e Backup
- **guild_stats**: Estatísticas do servidor
- **data_backups**: Backups automáticos
- **custom_commands**: Comandos personalizados

### 🔄 Backup Automático

- **Backup na saída**: Quando membro sai do servidor
- **Limpeza automática**: Backups antigos removidos (30 dias)
- **Recuperação de dados**: Possibilidade de restaurar
- **Export manual**: Comando para backup sob demanda

## 🔧 Personalização

### 🎨 Customização de Embeds

Edite as cores e estilos em `index.js`:

```javascript
// Cores dos embeds
const COLORS = {
    SUCCESS: '#00ff00',
    ERROR: '#ff0000',
    WARNING: '#ffaa00',
    INFO: '#0099ff',
    VIP: '#ffd700'
};
```

### ⚙️ Configurações de XP

Ajuste o sistema de XP:

```javascript
// XP por mensagem (min-max)
const XP_PER_MESSAGE = { min: 10, max: 25 };

// XP por minuto em call
const XP_PER_VOICE_MINUTE = 1;

// Cooldown entre XP (segundos)
const XP_COOLDOWN = 60;
```

### 🎯 Configurações de Nível

Personalize a fórmula de níveis:

```javascript
// Fórmula: nível = (-50 + √(2500 + 200 * XP)) / 100
// 100 XP para nível 1, +50 XP para cada nível seguinte
const LEVEL_FORMULA = (xp) => Math.floor((-50 + Math.sqrt(2500 + 200 * xp)) / 100);
```

### 👑 Tipos de VIP

Adicione novos tipos de VIP:

```javascript
const VIP_TYPES = {
    bronze: { emoji: '🥉', color: '#cd7f32', benefits: ['call_create'] },
    prata: { emoji: '🥈', color: '#c0c0c0', benefits: ['call_create', 'custom_tag'] },
    ouro: { emoji: '🥇', color: '#ffd700', benefits: ['call_create', 'custom_tag', 'priority_support'] },
    diamante: { emoji: '💎', color: '#b9f2ff', benefits: ['call_create', 'custom_tag', 'priority_support', 'exclusive_channels'] }
};
```

## 📱 Screenshots

### 🎤 Ranking de Voz
```
🏆 TOP 10 - TEMPO DE VOZ

🥇 @Usuario1         2d 15h 32m
🥈 @Usuario2         1d 22h 18m  
🥉 @Usuario3         1d 8h 45m
4️⃣  @Usuario4         18h 23m
5️⃣  @Usuario5         15h 12m
...
```

### 👑 Sistema VIP
```
👑 PAINEL VIP

Tipo: 💎 Diamante
Expira: <t:1234567890:R>
Tag: [OWNER] Usuario
Call: 🔊💎diamante-call-usuario

✅ Benefícios Ativos:
• Criar calls personalizadas
• Tag personalizada  
• Suporte prioritário
• Canais exclusivos
```

### 🎫 Sistema de Tickets
```
🎫 TICKET #0001

👤 Usuário: @Usuario
📋 Tipo: Suporte
⚡ Prioridade: Alta
📅 Criado: <t:1234567890:R>
🔗 Call: Clique aqui para entrar

Use os botões abaixo para gerenciar este ticket:
[📞 Call] [👤 Adicionar] [🚫 Fechar]
```

## ❓ FAQ

### **Q: O bot funciona em múltiplos servidores?**
A: Sim! Todos os dados são isolados por servidor usando `guild_id`.

### **Q: Os dados são perdidos quando o bot reinicia?**
A: Não! Todos os dados são salvos no SQLite e o bot tem sistema de recuperação.

### **Q: Como fazer backup dos dados?**
A: Use `/backup create` ou os dados são automaticamente salvos quando membros saem.

### **Q: Posso personalizar os comandos?**
A: Sim! Edite os arquivos na pasta `commands/` ou crie comandos personalizados.

### **Q: O sistema de XP funciona automaticamente?**
A: Sim! XP é dado automaticamente por mensagens e tempo em call.

### **Q: Como configurar o filtro de palavras?**
A: Use `/filter add palavra ação` para adicionar palavras e definir ações.

### **Q: Os VIPs expiram automaticamente?**
A: Sim! O bot verifica e remove VIPs expirados automaticamente.

### **Q: Posso recuperar dados de usuários que saíram?**
A: Sim! O bot faz backup automático antes de limpar os dados.

### **Q: Como ver logs detalhados?**
A: Configure um canal de logs com `/setup log_channel #logs`.

### **Q: O bot tem proteção anti-spam?**
A: Sim! Cooldowns automáticos e filtro de palavras estão implementados.

## 🔧 Troubleshooting

### ❌ Erro: "Cannot find module 'discord.js'"
```bash
npm install discord.js@14
```

### ❌ Erro: "Invalid token"
Verifique se o token no `.env` está correto.

### ❌ Erro: "Missing permissions"
Certifique-se que o bot tem as permissões necessárias.

### ❌ Banco não conecta
Verifique se a pasta tem permissão de escrita.

### ❌ Comandos não aparecem
Execute:
```bash
node deploy-commands.js
```

## 📈 Roadmap

### 🔜 Próximas Funcionalidades

- [ ] **Dashboard Web** - Painel de controle online
- [ ] **Sistema de Economia** - Moedas e loja virtual
- [ ] **Mini-games** - Jogos integrados
- [ ] **Sistema de Clãs** - Grupos de usuários
- [ ] **API REST** - Integração externa
- [ ] **Sistema de Eventos** - Eventos automáticos
- [ ] **AI Chatbot** - Respostas inteligentes
- [ ] **Multi-idiomas** - Suporte internacional

### 🎯 Melhorias Planejadas

- [ ] **Performance** - Otimização de queries
- [ ] **Clustering** - Suporte a múltiplos processos
- [ ] **Cache Redis** - Cache distribuído
- [ ] **Monitoramento** - Métricas e alertas
- [ ] **Docker** - Containerização
- [ ] **CI/CD** - Deploy automatizado

## 🤝 Contribuição

Contribuições são muito bem-vindas! 

### Como Contribuir

1. **Fork** o projeto
2. **Crie** uma branch (`git checkout -b feature/nova-funcionalidade`)
3. **Commit** suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. **Push** para a branch (`git push origin feature/nova-funcionalidade`)
5. **Abra** um Pull Request

### 📋 Guidelines

- Use **ESLint** para manter o código limpo
- **Documente** novas funcionalidades
- **Teste** antes de enviar
- Siga o **padrão** de commits

### 🏷️ Tipos de Contribuição

- 🐛 **Bug fixes** - Correção de bugs
- ✨ **Features** - Novas funcionalidades  
- 📚 **Documentation** - Melhorias na documentação
- 🎨 **UI/UX** - Melhorias visuais
- ⚡ **Performance** - Otimizações
- 🔧 **Refactoring** - Limpeza de código

## 📞 Suporte

### 💬 Comunidade

- **Discord**: [Servidor de Suporte](https://discord.gg/seu-servidor)
- **GitHub Issues**: [Reportar Bugs](https://github.com/seu-usuario/discord-bot-completo/issues)
- **Discussions**: [Discussões e Ideias](https://github.com/seu-usuario/discord-bot-completo/discussions)

### 📧 Contato Direto

- **Email**: seu-email@exemplo.com
- **Twitter**: [@seu_usuario](https://twitter.com/seu_usuario)
- **LinkedIn**: [Seu Perfil](https://linkedin.com/in/seu-perfil)

### 🆘 Suporte Urgente

Para problemas críticos:
1. **Abra uma issue** com label `critical`
2. **Envie email** detalhando o problema
3. **Mencione** no Discord se possível

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🏆 Créditos

### 👨‍💻 Desenvolvedor
- **Seu Nome** - Desenvolvedor Principal

### 🙏 Agradecimentos
- **Discord.js** - Framework incrível
- **Comunidade Discord** - Feedback e sugestões
- **Contributors** - Todas as contribuições

### 🔗 Links Úteis
- [Discord.js Guide](https://discordjs.guide/)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [SQLite Documentation](https://sqlite.org/docs.html)

---

<div align="center">

**⭐ Se este projeto te ajudou, considere dar uma estrela!**

[![GitHub stars](https://img.shields.io/github/stars/seu-usuario/discord-bot-completo.svg?style=social)](https://github.com/seu-usuario/discord-bot-completo/stargazers)

**Feito com ❤️ para a comunidade Discord**

</div>
