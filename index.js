// ==================== BOT DISCORD - INDEX.JS COMPLETO E CORRIGIDO ====================

const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ActivityType,
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    Events
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config.json');

// ==================== CONFIGURAÇÃO DO CLIENT ====================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildModeration
    ]
});

// ==================== MAPS E CACHES ====================

const voiceConnections = new Map(); // Tracking de voz ativo
const ticketCooldowns = new Map(); // Cooldown de tickets
const verificationPending = new Map(); // Verificações pendentes
const vipCallCooldowns = new Map(); // Cooldown de calls VIP
const messageCooldowns = new Map(); // Anti-spam
const autoRoleTimers = new Map(); // Auto-roles com delay

// ==================== CONFIGURAÇÃO DO BANCO DE DADOS ====================

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('❌ Erro ao conectar com o banco de dados:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite');
        initializeTables();
    }
});

// Função para inicializar todas as tabelas
function initializeTables() {
    console.log('🗃️ Inicializando tabelas do banco de dados...');

    // Tabela de configurações do servidor
    db.run(`CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        log_channel_id TEXT,
        ticket_category_id TEXT,
        vip_category_id TEXT,
        welcome_channel_id TEXT,
        auto_role_id TEXT,
        mute_role_id TEXT,
        mod_log_channel_id TEXT,
        support_role_id TEXT,
        council_role_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);

    // Tabela de tempo de voz CORRIGIDA
    db.run(`CREATE TABLE IF NOT EXISTS voice_time (
        user_id TEXT,
        guild_id TEXT,
        total_time INTEGER DEFAULT 0,
        session_start INTEGER,
        sessions INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, guild_id)
    )`);

    // Tabela de VIPs
    db.run(`CREATE TABLE IF NOT EXISTS vips (
        user_id TEXT,
        guild_id TEXT,
        vip_type TEXT CHECK(vip_type IN ('bronze', 'prata', 'ouro', 'diamante')),
        expires_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        created_by TEXT,
        PRIMARY KEY (user_id, guild_id)
    )`);

    // Tabela de tickets
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT UNIQUE,
        channel_id TEXT UNIQUE,
        user_id TEXT,
        guild_id TEXT,
        type TEXT DEFAULT 'support',
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'archived')),
        priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
        assigned_to TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        closed_at INTEGER,
        closed_by TEXT,
        close_reason TEXT
    )`);

    // Tabela de calls VIP
    db.run(`CREATE TABLE IF NOT EXISTS vip_calls (
        channel_id TEXT PRIMARY KEY,
        owner_id TEXT,
        guild_id TEXT,
        vip_type TEXT,
        call_name TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_used INTEGER
    )`);

    // Tabela de verificações
    db.run(`CREATE TABLE IF NOT EXISTS verifications (
        user_id TEXT,
        guild_id TEXT,
        verification_code TEXT,
        verified_at INTEGER DEFAULT (strftime('%s', 'now')),
        verified_by TEXT,
        verification_method TEXT DEFAULT 'manual',
        PRIMARY KEY (user_id, guild_id)
    )`);

    // Tabela de warnings/advertências
    db.run(`CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        guild_id TEXT,
        reason TEXT,
        evidence TEXT,
        warned_by TEXT,
        severity TEXT DEFAULT 'low' CHECK(severity IN ('low', 'medium', 'high')),
        active BOOLEAN DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER
    )`);

    // Tabela de contador de mensagens
    db.run(`CREATE TABLE IF NOT EXISTS message_count (
        user_id TEXT,
        guild_id TEXT,
        count INTEGER DEFAULT 0,
        last_message INTEGER DEFAULT (strftime('%s', 'now')),
        daily_count INTEGER DEFAULT 0,
        last_daily_reset INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (user_id, guild_id)
    )`);

    // Tabela de níveis/XP
    db.run(`CREATE TABLE IF NOT EXISTS user_levels (
        user_id TEXT,
        guild_id TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        messages INTEGER DEFAULT 0,
        voice_time INTEGER DEFAULT 0,
        last_xp_gain INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
    )`);

    console.log('✅ Todas as tabelas do banco de dados foram inicializadas');
}

// ==================== CARREGAMENTO DE COMANDOS ====================

client.commands = new Collection();

function loadCommands() {
    console.log('📚 Carregando comandos...');
    const commandsPath = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsPath)) {
        console.log('📁 Pasta commands não encontrada, criando estrutura...');
        createCommandStructure();
        return;
    }

    const commandFolders = fs.readdirSync(commandsPath);
    let commandCount = 0;

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commandCount++;
                    console.log(`✅ ${command.data.name} (${folder})`);
                } else {
                    console.log(`⚠️  Comando inválido: ${file}`);
                }
            } catch (error) {
                console.error(`❌ Erro ao carregar ${file}:`, error.message);
            }
        }
    }
    
    console.log(`🎉 ${commandCount} comandos carregados com sucesso!`);
}

function createCommandStructure() {
    const commandsPath = path.join(__dirname, 'commands');
    fs.mkdirSync(commandsPath, { recursive: true });
    
    const folders = ['admin', 'moderation', 'utility', 'fun', 'vip'];
    folders.forEach(folder => {
        fs.mkdirSync(path.join(commandsPath, folder), { recursive: true });
    });
    
    console.log('📁 Estrutura de comandos criada');
}

// ==================== EVENT LISTENERS PRINCIPAIS ====================

// Bot pronto
client.once('ready', async () => {
    console.log(`\n🚀 ${client.user.tag} está online!`);
    console.log(`📊 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuários: ${client.users.cache.size}`);
    console.log(`⚡ Ping: ${client.ws.ping}ms`);
    
    // Definir atividade rotativa
    const activities = [
        { name: 'os membros entrarem e saírem', type: ActivityType.Watching },
        { name: 'tickets sendo criados', type: ActivityType.Listening },
        { name: 'o servidor', type: ActivityType.Watching },
        { name: 'comandos sendo executados', type: ActivityType.Listening }
    ];
    
    let activityIndex = 0;
    setInterval(() => {
        client.user.setActivity(activities[activityIndex]);
        activityIndex = (activityIndex + 1) % activities.length;
    }, 30000);
    
    // Carregar comandos
    loadCommands();
    
    // Limpar dados expirados na inicialização
    await cleanExpiredData();
    
    // Recuperar dados de voz ativos
    await recoverVoiceConnections();
    
    console.log('✅ Bot totalmente iniciado e funcional!\n');
});

// ==================== SISTEMA DE VOZ CORRIGIDO ====================

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;
    const guildId = newState.guild.id;
    const now = Math.floor(Date.now() / 1000);

    try {
        // Usuário entrou em um canal de voz
        if (!oldState.channelId && newState.channelId) {
            voiceConnections.set(userId, { joinTime: now, guildId: guildId });
            
            // Garantir entrada no banco com session_start
            db.run(`INSERT OR IGNORE INTO voice_time (user_id, guild_id, total_time, sessions) VALUES (?, ?, 0, 0)`, 
                [userId, guildId]);
            
            db.run(`UPDATE voice_time SET session_start = ?, sessions = sessions + 1 WHERE user_id = ? AND guild_id = ?`, 
                [now, userId, guildId]);
            
            console.log(`🎤 ${newState.member.user.tag} entrou em ${newState.channel.name}`);
            
            // Dar XP por entrar em call
            await giveXP(userId, guildId, 5, 'voice_join');
        }
        
        // Usuário saiu de um canal de voz
        else if (oldState.channelId && !newState.channelId) {
            const connection = voiceConnections.get(userId);
            if (connection) {
                const timeSpent = now - connection.joinTime;
                
                if (timeSpent > 0) {
                    // Atualizar tempo total e limpar session_start
                    db.run(`UPDATE voice_time SET total_time = total_time + ?, session_start = NULL WHERE user_id = ? AND guild_id = ?`, 
                        [timeSpent, userId, guildId]);
                    
                    // Dar XP baseado no tempo (1 XP por minuto)
                    const xpGained = Math.floor(timeSpent / 60);
                    if (xpGained > 0) {
                        await giveXP(userId, guildId, xpGained, 'voice_time');
                    }
                    
                    console.log(`🔇 ${oldState.member.user.tag} saiu de ${oldState.channel.name} (+${formatTime(timeSpent)})`);
                }
                
                voiceConnections.delete(userId);
            }
        }
        
        // Usuário trocou de canal
        else if (oldState.channelId !== newState.channelId && oldState.channelId && newState.channelId) {
            console.log(`🔄 ${newState.member.user.tag} trocou de ${oldState.channel.name} para ${newState.channel.name}`);
        }
        
    } catch (error) {
        console.error('Erro no voice state update:', error);
    }
});

// ==================== SISTEMA DE MEMBROS (ENTRADA/SAÍDA) ====================

client.on('guildMemberAdd', async (member) => {
    try {
        console.log(`👋 ENTRADA: ${member.user.tag} | ${member.guild.name} | Total: ${member.guild.memberCount}`);
        
        const userId = member.user.id;
        const guildId = member.guild.id;
        const isBot = member.user.bot;
        const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
        
        // Buscar configurações do servidor
        db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, 
            [guildId], async (err, settings) => {
                
                if (err) {
                    console.error('Erro ao buscar configurações:', err);
                    return;
                }
                
                // Auto-role geral (se configurado)
                if (!isBot && settings?.auto_role_id) {
                    const autoRole = member.guild.roles.cache.get(settings.auto_role_id);
                    if (autoRole) {
                        setTimeout(async () => {
                            try {
                                await member.roles.add(autoRole);
                                console.log(`🎭 Auto-role adicionado: ${member.user.tag}`);
                            } catch (error) {
                                console.error('Erro ao adicionar auto-role:', error);
                            }
                        }, 2000);
                    }
                }
                
                // Log detalhado da entrada
                if (settings?.log_channel_id) {
                    const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor(isBot ? '#0099ff' : accountAge < 7 ? '#ffaa00' : '#00ff00')
                            .setTitle(isBot ? '🤖 Bot Adicionado' : '👋 Membro Entrou')
                            .setDescription(`**Usuário:** ${member.user}\n**Tag:** ${member.user.tag}\n**ID:** ${member.user.id}\n**Conta criada:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**Idade da conta:** ${accountAge} dias\n**Tipo:** ${isBot ? 'Bot' : 'Usuário'}`)
                            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                            .setFooter({ text: `Total de membros: ${member.guild.memberCount}` })
                            .setTimestamp();
                        
                        // Alertas de segurança
                        if (!isBot) {
                            if (accountAge < 1) {
                                embed.addFields({
                                    name: '🚨 ALERTA CRÍTICO',
                                    value: `Conta criada há menos de 1 dia (${accountAge} dias)`,
                                    inline: false
                                });
                                embed.setColor('#ff0000');
                            } else if (accountAge < 7) {
                                embed.addFields({
                                    name: '⚠️ Alerta de Segurança',
                                    value: `Conta nova (${accountAge} dias)`,
                                    inline: false
                                });
                            }
                        }
                        
                        await logChannel.send({ embeds: [embed] }).catch(console.error);
                    }
                }
            });
            
    } catch (error) {
        console.error('Erro no evento guildMemberAdd:', error);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        console.log(`👋 SAÍDA: ${member.user.tag} | ${member.guild.name} | Total: ${member.guild.memberCount}`);
        
        const userId = member.user.id;
        const guildId = member.guild.id;
        
        // Limpar dados do usuário
        await cleanUserDataOnLeave(userId, guildId);
        
        // Log da saída
        db.get(`SELECT log_channel_id FROM guild_settings WHERE guild_id = ?`, 
            [guildId], async (err, settings) => {
                if (settings?.log_channel_id) {
                    const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('👋 Membro Saiu')
                            .setDescription(`**Usuário:** ${member.user.tag}\n**ID:** ${member.user.id}\n**Estava no servidor:** ${member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Desconhecido'}`)
                            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                            .setFooter({ text: `Total de membros: ${member.guild.memberCount}` })
                            .setTimestamp();
                        
                        await logChannel.send({ embeds: [embed] }).catch(console.error);
                    }
                }
            });
            
    } catch (error) {
        console.error('Erro no evento guildMemberRemove:', error);
    }
});

// ==================== SISTEMA DE MENSAGENS E XP ====================

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const now = Math.floor(Date.now() / 1000);

    try {
        // Anti-spam básico
        const cooldownKey = `${userId}-${guildId}`;
        const lastMessage = messageCooldowns.get(cooldownKey);
        if (lastMessage && (now - lastMessage) < 3) return;
        
        messageCooldowns.set(cooldownKey, now);
        
        // Atualizar contador de mensagens
        db.run(`INSERT INTO message_count (user_id, guild_id, count, last_message) 
                VALUES (?, ?, 1, ?) 
                ON CONFLICT(user_id, guild_id) 
                DO UPDATE SET count = count + 1, last_message = ?`,
            [userId, guildId, now, now]);
        
        // Sistema de XP por mensagem
        const xpGained = Math.floor(Math.random() * 15) + 10;
        await giveXP(userId, guildId, xpGained, 'message');
        
    } catch (error) {
        console.error('Erro no processamento de mensagem:', error);
    }
});

// ==================== SISTEMA DE INTERAÇÕES ====================

client.on('interactionCreate', async (interaction) => {
    try {
        // Comandos Slash
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`Comando não encontrado: ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction, db);
                console.log(`⚡ ${interaction.user.tag} usou /${interaction.commandName} em ${interaction.guild.name}`);
            } catch (error) {
                console.error(`Erro ao executar comando ${interaction.commandName}:`, error);
                const reply = { 
                    content: '❌ Houve um erro ao executar este comando!', 
                    ephemeral: true 
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        }
        
        // Botões
        else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }
        
        // Modals
        else if (interaction.isModalSubmit()) {
            await handleModalInteraction(interaction);
        }
        
        // Select Menus
        else if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        }
        
    } catch (error) {
        console.error('Erro no interaction handler:', error);
    }
});

// ==================== HANDLERS DE INTERAÇÕES CORRIGIDOS ====================

// ==================== HANDLERS COMPLEMENTARES PARA O PAINEL ====================
// Adicione essas funções ao seu index.js na seção de handlers

// No seu index.js, substitua a função handleButtonInteraction existente por esta:

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    
    try {
        // Handlers do painel melhorado
        if (customId.startsWith('config_')) {
            const { handleConfigButton } = require('./commands/admin/painel');
            await handleConfigButton(interaction, customId, db);
        }
        
        // Voltar ao painel principal
        else if (customId === 'back_to_main_panel') {
            const { showMainPanel } = require('./commands/admin/painel');
            await showMainPanel(interaction, db);
        }
        
        // Botões de configuração específicos
        else if (customId === 'ticket_channel_select' || customId === 'ticket_category_select') {
            await handleTicketConfiguration(interaction, customId);
        }
        
        // Atualizar status
        else if (customId === 'refresh_status') {
            const { handleConfigButton } = require('./commands/admin/painel');
            await handleConfigButton(interaction, 'config_status', db);
        }
        
        // Exportar configuração
        else if (customId === 'export_config') {
            await exportConfiguration(interaction);
        }
        
        // Botões do painel de configuração rápida de tickets
        else if (customId === 'setup_tickets_now') {
            await quickTicketSetup(interaction);
        }
        
        // Botões existentes (manter os que já funcionam)
        else if (customId.startsWith('ticket_') || customId === 'create_ticket_support') {
            await handleTicketButton(interaction, customId);
        }
        
        else if (customId.startsWith('verify_') || customId === 'start_verification') {
            await handleVerificationButton(interaction, customId);
        }
        
        else if (customId.startsWith('vip_')) {
            await handleVIPButton(interaction, customId);
        }
        
        else {
            await interaction.reply({ content: '❌ Botão não reconhecido!', ephemeral: true });
        }
        
    } catch (error) {
        console.error('Erro no button handler:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '❌ Erro ao processar botão!', ephemeral: true });
        }
    }
}

// Adicione também esta função para handles de select menus:

async function handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    
    try {
        // Select menus do painel
        if (customId.includes('_setup_select') || customId.includes('_select')) {
            const { handleSelectMenuInteraction } = require('./commands/admin/painel');
            await handleSelectMenuInteraction(interaction, db);
        }
        
        // Configuração de tickets
        else if (customId === 'ticket_channel_select') {
            // Armazenar seleção temporariamente
            global.ticketSetupData = global.ticketSetupData || {};
            global.ticketSetupData[interaction.user.id] = {
                ...global.ticketSetupData[interaction.user.id],
                channelId: interaction.values[0]
            };
            
            await interaction.reply({ 
                content: `✅ Canal selecionado: <#${interaction.values[0]}>\nAgora selecione a categoria para os tickets.`, 
                ephemeral: true 
            });
        }
        
        else if (customId === 'ticket_category_select') {
            // Finalizar configuração de tickets
            global.ticketSetupData = global.ticketSetupData || {};
            const setupData = global.ticketSetupData[interaction.user.id] || {};
            const categoryId = interaction.values[0];
            
            if (!setupData.channelId) {
                return interaction.reply({ 
                    content: '❌ Selecione primeiro o canal para o painel!', 
                    ephemeral: true 
                });
            }
            
            await finalizeTicketSetup(interaction, setupData.channelId, categoryId);
        }
        
        else {
            await interaction.reply({ content: '❌ Menu não reconhecido!', ephemeral: true });
        }
        
    } catch (error) {
        console.error('Erro no select menu handler:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '❌ Erro ao processar seleção!', ephemeral: true });
        }
    }
}

// ==================== FUNÇÕES ESPECÍFICAS ====================

async function finalizeTicketSetup(interaction, channelId, categoryId) {
    await interaction.deferReply({ ephemeral: true });
    
    const channel = interaction.guild.channels.cache.get(channelId);
    const category = interaction.guild.channels.cache.get(categoryId);
    
    if (!channel || !category) {
        return interaction.editReply({ content: '❌ Canal ou categoria não encontrados!' });
    }
    
    // Salvar configurações no banco
    db.run(`INSERT OR REPLACE INTO guild_settings (guild_id, ticket_category_id) VALUES (?, ?)`,
        [interaction.guild.id, categoryId], async function(err) {
            if (err) {
                console.error(err);
                return interaction.editReply({ content: '❌ Erro ao salvar configurações!' });
            }
            
            // Criar painel de tickets
            const embed = new EmbedBuilder()
                .setColor('#fa32fc')
                .setTitle('🎫 Sistema de Tickets')
                .setDescription(`**<:p_tdecorchat4:1385266779475017831> Atendimento Neverland .𝜗𝜚**

<:p_starrosa:1383810818868510790> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_starrosa:1383810818868510790>

﹒୨ Bem vinda a nossa central de atendimento!
Esse chat foi criado com o intuito de ajudar vocês dentro do servidor, retirar suas dúvidas, responder denúncias e resolver brigas de dentro do servidor.

-# - Obs: Não tragam problemas de fora do servidor, para dentro de um ticket; simplificando, problemas pessoais de vocês devem ser resolvido no privado ! Não iremos tomar providências por problemas pessoais.

<:p_star:1384924354067824834> ﹒୨ Fichinha:

﹒୨ Nome:
﹒୨ Qual o intuito da abertura do ticket ? 
﹒୨ ~~marque a equipe de atendimento.~~ 

*Aguarde a resposta da nossa equipe!*`)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'Sistema de Tickets Privados - Anime & Games' })
                .setTimestamp();
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket_support')
                        .setLabel('🎟️ Abrir Ticket')
                        .setStyle(ButtonStyle.Primary)
                );
            
            try {
                await channel.send({
                    embeds: [embed],
                    components: [buttons]
                });
                
                const successEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Sistema de Tickets Configurado!')
                    .setDescription(`**Canal do painel:** ${channel}\n**Categoria dos tickets:** ${category}\n\n🎉 Sistema totalmente configurado e funcionando!\n\n🎫 Os usuários agora podem criar tickets clicando no botão.`)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [successEmbed] });
                
                // Limpar dados temporários
                if (global.ticketSetupData && global.ticketSetupData[interaction.user.id]) {
                    delete global.ticketSetupData[interaction.user.id];
                }
                
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ Erro ao enviar painel de tickets!' });
            }
        });
}

async function exportConfiguration(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [interaction.guild.id], async (err, settings) => {
        if (!settings) {
            return interaction.editReply({ content: '❌ Nenhuma configuração encontrada!' });
        }
        
        const config = {
            guildId: interaction.guild.id,
            guildName: interaction.guild.name,
            exportDate: new Date().toISOString(),
            settings: {
                logChannelId: settings.log_channel_id,
                ticketCategoryId: settings.ticket_category_id,
                vipCategoryId: settings.vip_category_id,
                autoRoleId: settings.auto_role_id,
                supportRoleId: settings.support_role_id,
                councilRoleId: settings.council_role_id
            }
        };
        
        const configText = JSON.stringify(config, null, 2);
        
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('📤 Configuração Exportada')
            .setDescription(`**Servidor:** ${interaction.guild.name}\n**Data:** ${new Date().toLocaleDateString()}\n\n📋 Configuração atual exportada em JSON.\n\n⚠️ **Importante:** Este arquivo contém IDs específicos do seu servidor.`)
            .setTimestamp();
        
        // Criar arquivo temporário (você pode salvar em um diretório temporário)
        const fs = require('fs');
        const path = require('path');
        const tempFile = path.join(__dirname, '../../data', `config_${interaction.guild.id}.json`);
        
        // Criar diretório se não existir
        const dataDir = path.dirname(tempFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(tempFile, configText);
        
        await interaction.editReply({ 
            embeds: [embed],
            files: [{
                attachment: tempFile,
                name: `configuracao_${interaction.guild.name}_${Date.now()}.json`
            }]
        });
        
        // Remover arquivo temporário após envio
        setTimeout(() => {
            try {
                fs.unlinkSync(tempFile);
            } catch (error) {
                console.error('Erro ao remover arquivo temporário:', error);
            }
        }, 5000);
    });
}

// ==================== INTEGRAÇÃO NO INDEX.JS ====================

// Substitua o event listener de interactionCreate no seu index.js por este:

client.on('interactionCreate', async (interaction) => {
    try {
        // Comandos Slash
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`Comando não encontrado: ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction, db);
                console.log(`⚡ ${interaction.user.tag} usou /${interaction.commandName} em ${interaction.guild.name}`);
            } catch (error) {
                console.error(`Erro ao executar comando ${interaction.commandName}:`, error);
                const reply = { 
                    content: '❌ Houve um erro ao executar este comando!', 
                    ephemeral: true 
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        }
        
        // Botões
        else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }
        
        // Modals
        else if (interaction.isModalSubmit()) {
            await handleModalInteraction(interaction);
        }
        
        // Select Menus
        else if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
        }
        
    } catch (error) {
        console.error('Erro no interaction handler:', error);
    }
});

async function handleConfigButton(interaction, customId) {
    const action = customId.replace('config_', '');
    
    switch (action) {
        case 'tickets':
            const ticketEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎫 Configuração de Tickets')
                .setDescription('Para configurar o sistema de tickets:\n\n1. Use `/ticket setup` para definir canal e categoria\n2. Configure cargos de suporte\n3. Teste criando um ticket')
                .setTimestamp();
            await interaction.reply({ embeds: [ticketEmbed], ephemeral: true });
            break;
            
        case 'moderation':
            const modEmbed = new EmbedBuilder()
                .setColor('#ff6600')
                .setTitle('🔨 Configuração de Moderação')
                .setDescription('Para configurar moderação:\n\n1. Use `/config logs` para definir canal de logs\n2. Configure cargos de moderação\n3. Use comandos `/mod` para moderar')
                .setTimestamp();
            await interaction.reply({ embeds: [modEmbed], ephemeral: true });
            break;
            
        case 'vip':
            const vipEmbed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('👑 Configuração VIP')
                .setDescription('Para configurar sistema VIP:\n\n1. Use `/vip setup` para definir categoria\n2. Configure cargos VIP com `/vip config`\n3. Adicione VIPs com `/vip add`')
                .setTimestamp();
            await interaction.reply({ embeds: [vipEmbed], ephemeral: true });
            break;
            
        case 'verification':
            const verifyEmbed = new EmbedBuilder()
                .setColor('#00ff7f')
                .setTitle('🛡️ Configuração de Verificação')
                .setDescription('Para configurar verificação:\n\n1. Use `/verification setup` para configurar\n2. Defina cargo de verificado\n3. Configure canal de verificação')
                .setTimestamp();
            await interaction.reply({ embeds: [verifyEmbed], ephemeral: true });
            break;
            
        case 'panels':
            const panelEmbed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('📋 Criação de Painéis')
                .setDescription('Para criar painéis:\n\n1. Use `/embed create` para embeds personalizados\n2. Use `/ticket setup` para painel de tickets\n3. Use `/verification setup` para painel de verificação')
                .setTimestamp();
            await interaction.reply({ embeds: [panelEmbed], ephemeral: true });
            break;
            
        case 'status':
            await showSystemStatus(interaction);
            break;
            
        default:
            await interaction.reply({ content: '❌ Configuração não encontrada!', ephemeral: true });
    }
}

async function showSystemStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const guild = interaction.guild;
    const guildId = guild.id;
    
    // Buscar configurações
    db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [guildId], async (err, settings) => {
        // Buscar estatísticas
        db.all(`SELECT 
                    (SELECT COUNT(*) FROM voice_time WHERE guild_id = ?) as voice_users,
                    (SELECT COUNT(*) FROM vips WHERE guild_id = ?) as vip_users,
                    (SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'open') as open_tickets,
                    (SELECT COUNT(*) FROM message_count WHERE guild_id = ?) as message_users`,
            [guildId, guildId, guildId, guildId], async (err, stats) => {
                
                const data = stats[0] || {};
                
                const embed = new EmbedBuilder()
                    .setColor('#4CAF50')
                    .setTitle('📊 Status do Sistema')
                    .addFields(
                        {
                            name: '⚙️ Configurações',
                            value: `**Log Channel:** ${settings?.log_channel_id ? '✅' : '❌'}\n**Ticket Category:** ${settings?.ticket_category_id ? '✅' : '❌'}\n**VIP Category:** ${settings?.vip_category_id ? '✅' : '❌'}`,
                            inline: true
                        },
                        {
                            name: '📈 Atividade',
                            value: `**Usuários com tempo de voz:** ${data.voice_users || 0}\n**VIPs ativos:** ${data.vip_users || 0}\n**Tickets abertos:** ${data.open_tickets || 0}`,
                            inline: true
                        },
                        {
                            name: '🔧 Sistema',
                            value: `**Bot Online:** ✅\n**Banco de Dados:** ✅\n**Comandos:** ${client.commands.size}`,
                            inline: true
                        }
                    )
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            });
    });
}

async function handleTicketButton(interaction, customId) {
    if (customId === 'create_ticket_support') {
        await createTicket(interaction, 'support');
    } else {
        await interaction.reply({ content: '🎫 Sistema de tickets em desenvolvimento...', ephemeral: true });
    }
}

async function createTicket(interaction, type) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    
    // Verificar cooldown
    const cooldownKey = `${userId}-${guildId}`;
    if (ticketCooldowns.has(cooldownKey)) {
        return interaction.reply({ 
            content: '⏰ Aguarde antes de criar outro ticket!', 
            ephemeral: true 
        });
    }
    
    ticketCooldowns.set(cooldownKey, Date.now());
    setTimeout(() => ticketCooldowns.delete(cooldownKey), 60000); // 1 minuto
    
    // Verificar se já tem ticket aberto
    db.get(`SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = 'open'`,
        [userId, guildId], async (err, existingTicket) => {
            if (existingTicket) {
                return interaction.reply({ 
                    content: `❌ Você já tem um ticket aberto: <#${existingTicket.channel_id}>`, 
                    ephemeral: true 
                });
            }
            
            // Buscar configurações
            db.get(`SELECT ticket_category_id, support_role_id FROM guild_settings WHERE guild_id = ?`,
                [guildId], async (err, settings) => {
                    if (!settings?.ticket_category_id) {
                        return interaction.reply({ 
                            content: '❌ Sistema de tickets não configurado!', 
                            ephemeral: true 
                        });
                    }
                    
                    await interaction.deferReply({ ephemeral: true });
                    
                    try {
                        // Gerar ID único do ticket
                        const ticketId = `ticket-${Date.now().toString().slice(-6)}`;
                        
                        // Criar canal do ticket
                        const ticketChannel = await interaction.guild.channels.create({
                            name: `🎫-${interaction.user.username}`,
                            type: ChannelType.GuildText,
                            parent: settings.ticket_category_id,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel],
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                                },
                                {
                                    id: interaction.client.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                                }
                            ]
                        });
                        
                        // Adicionar role de suporte se configurada
                        if (settings.support_role_id) {
                            await ticketChannel.permissionOverwrites.create(settings.support_role_id, {
                                ViewChannel: true,
                                SendMessages: true
                            });
                        }
                        
                        // Salvar no banco
                        db.run(`INSERT INTO tickets (ticket_id, channel_id, user_id, guild_id, type) VALUES (?, ?, ?, ?, ?)`,
                            [ticketId, ticketChannel.id, userId, guildId, type]);
                        
                        // Embed inicial do ticket
                        const ticketEmbed = new EmbedBuilder()
                            .setColor('#fa32fc')
                            .setTitle('🎫 Ticket Criado')
                            .setDescription(`**<:p_tdecorchat4:1385266779475017831> Atendimento Neverland .𝜗𝜚**\n\n<:p_starrosa:1383810818868510790> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_starrosa:1383810818868510790>\n\n﹒୨ Bem vinda a nossa central de atendimento!\nEsse chat foi criado com o intuito de ajudar vocês dentro do servidor, retirar suas dúvidas, responder denúncias e resolver brigas de dentro do servidor.\n\n-# - Obs: Não tragam problemas de fora do servidor, para dentro de um ticket; simplificando, problemas pessoais de vocês devem ser resolvido no privado ! Não iremos tomar providências por problemas pessoais.\n\n<:p_star:1384924354067824834> ﹒୨ Fichinha:\n\n﹒୨ Nome:\n﹒୨ Qual o intuito da abertura do ticket ?\n﹒୨ ~~marque a equipe de atendimento.~~\n\n*Aguarde a resposta da nossa equipe!*`)
                            .setFooter({ text: `ID: ${ticketId}` })
                            .setTimestamp();
                        
                        const closeButton = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('close_ticket')
                                    .setLabel('🔒 Fechar Ticket')
                                    .setStyle(ButtonStyle.Danger)
                            );
                        
                        await ticketChannel.send({ 
                            content: `${interaction.user} ${settings.support_role_id ? `<@&${settings.support_role_id}>` : ''}`,
                            embeds: [ticketEmbed], 
                            components: [closeButton] 
                        });
                        
                        await interaction.editReply({ 
                            content: `✅ Ticket criado: ${ticketChannel}` 
                        });
                        
                    } catch (error) {
                        console.error('Erro ao criar ticket:', error);
                        await interaction.editReply({ 
                            content: '❌ Erro ao criar ticket!' 
                        });
                    }
                });
        });
}

async function handleVerificationButton(interaction, customId) {
    if (customId === 'start_verification') {
        await startVerification(interaction);
    } else {
        await interaction.reply({ content: '✅ Sistema de verificação em desenvolvimento...', ephemeral: true });
    }
}

async function startVerification(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    
    // Verificar se já está verificado
    db.get(`SELECT * FROM verifications WHERE user_id = ? AND guild_id = ?`,
        [userId, guildId], async (err, existing) => {
            if (existing) {
                return interaction.reply({ 
                    content: '✅ Você já está verificado!', 
                    ephemeral: true 
                });
            }
            
            // Criar ticket de verificação
            await createTicket(interaction, 'verification');
        });
}

async function handleVIPButton(interaction, customId) {
    await interaction.reply({ content: '👑 Sistema VIP em desenvolvimento...', ephemeral: true });
}

async function handleModalInteraction(interaction) {
    const customId = interaction.customId;
    
    try {
        // Modal do embed
        if (customId === 'embed_modal') {
            await handleEmbedModal(interaction);
        }
        else {
            await interaction.reply({ content: '❌ Modal não reconhecido!', ephemeral: true });
        }
        
    } catch (error) {
        console.error('Erro no modal handler:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '❌ Erro ao processar modal!', ephemeral: true });
        }
    }
}

async function handleEmbedModal(interaction) {
    const title = interaction.fields.getTextInputValue('embed_title');
    const description = interaction.fields.getTextInputValue('embed_description');
    const color = interaction.fields.getTextInputValue('embed_color') || '#0099ff';
    const image = interaction.fields.getTextInputValue('embed_image');
    const footer = interaction.fields.getTextInputValue('embed_footer');
    
    try {
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setColor(color)
            .setTimestamp();
        
        if (title) embed.setTitle(title);
        if (image) embed.setImage(image);
        if (footer) embed.setFooter({ text: footer });
        else embed.setFooter({ text: `Criado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
        
        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Embed criado com sucesso!', ephemeral: true });
        
    } catch (error) {
        await interaction.reply({ content: '❌ Erro ao criar embed! Verifique os dados fornecidos.', ephemeral: true });
    }
}

async function handleSelectMenuInteraction(interaction) {
    await interaction.reply({ content: '❌ Menu não reconhecido!', ephemeral: true });
}

// ==================== FUNÇÕES AUXILIARES ====================

// Sistema de XP
async function giveXP(userId, guildId, amount, source = 'unknown') {
    return new Promise((resolve) => {
        const now = Math.floor(Date.now() / 1000);
        
        db.get(`SELECT level, xp, last_xp_gain FROM user_levels WHERE user_id = ? AND guild_id = ?`,
            [userId, guildId], (err, userData) => {
                
                if (source === 'message' && userData?.last_xp_gain && (now - userData.last_xp_gain) < 60) {
                    resolve();
                    return;
                }
                
                const currentLevel = userData?.level || 0;
                const currentXP = userData?.xp || 0;
                const newXP = currentXP + amount;
                
                const newLevel = Math.floor((-50 + Math.sqrt(2500 + 200 * newXP)) / 100);
                
                db.run(`INSERT INTO user_levels (user_id, guild_id, xp, level, last_xp_gain) 
                        VALUES (?, ?, ?, ?, ?) 
                        ON CONFLICT(user_id, guild_id) 
                        DO UPDATE SET xp = ?, level = ?, last_xp_gain = ?`,
                    [userId, guildId, newXP, newLevel, now, newXP, newLevel, now], function() {
                        
                        if (newLevel > currentLevel) {
                            console.log(`📈 ${userId} subiu para o nível ${newLevel}!`);
                        }
                        
                        resolve();
                    });
            });
    });
}

// Limpeza de dados quando usuário sai
async function cleanUserDataOnLeave(userId, guildId) {
    try {
        console.log(`🗑️ Limpando dados para usuário ${userId} no servidor ${guildId}`);
        
        // Salvar tempo de voz ativo se houver
        const connection = voiceConnections.get(userId);
        if (connection) {
            const timeSpent = Math.floor(Date.now() / 1000) - connection.joinTime;
            if (timeSpent > 0) {
                db.run(`UPDATE voice_time SET total_time = total_time + ?, session_start = NULL WHERE user_id = ? AND guild_id = ?`, 
                    [timeSpent, userId, guildId]);
            }
            voiceConnections.delete(userId);
        }
        
        // Fechar tickets abertos
        db.all(`SELECT channel_id FROM tickets WHERE user_id = ? AND guild_id = ? AND status = 'open'`,
            [userId, guildId], (err, tickets) => {
                if (tickets) {
                    tickets.forEach(async (ticket) => {
                        try {
                            const channel = client.channels.cache.get(ticket.channel_id);
                            if (channel) {
                                await channel.delete('Usuário saiu do servidor');
                            }
                        } catch (error) {
                            console.error('Erro ao deletar canal:', error);
                        }
                    });
                    
                    db.run(`UPDATE tickets SET status = 'closed', closed_at = ?, close_reason = ? WHERE user_id = ? AND guild_id = ? AND status = 'open'`,
                        [Math.floor(Date.now() / 1000), 'Usuário saiu do servidor', userId, guildId]);
                }
            });
        
        console.log(`✅ Dados limpos para ${userId}`);
        
    } catch (error) {
        console.error('Erro na limpeza de dados:', error);
    }
}

// Limpar dados expirados
async function cleanExpiredData() {
    console.log('🧹 Limpando dados expirados...');
    const now = Math.floor(Date.now() / 1000);
    
    try {
        db.run(`DELETE FROM vips WHERE expires_at IS NOT NULL AND expires_at < ?`, [now]);
        db.run(`UPDATE warnings SET active = 0 WHERE expires_at IS NOT NULL AND expires_at < ? AND active = 1`, [now]);
        console.log('✅ Limpeza de dados expirados concluída');
    } catch (error) {
        console.error('Erro na limpeza de dados expirados:', error);
    }
}

// Recuperar conexões de voz ativas
async function recoverVoiceConnections() {
    console.log('🔄 Recuperando conexões de voz ativas...');
    
    try {
        db.all(`SELECT user_id, guild_id, session_start FROM voice_time WHERE session_start IS NOT NULL`, 
            (err, connections) => {
                if (connections) {
                    connections.forEach(conn => {
                        const guild = client.guilds.cache.get(conn.guild_id);
                        if (guild) {
                            const member = guild.members.cache.get(conn.user_id);
                            if (member && member.voice.channelId) {
                                voiceConnections.set(conn.user_id, {
                                    joinTime: conn.session_start,
                                    guildId: conn.guild_id
                                });
                                console.log(`🎤 Recuperado: ${member.user.tag} em call`);
                            } else {
                                db.run(`UPDATE voice_time SET session_start = NULL WHERE user_id = ? AND guild_id = ?`,
                                    [conn.user_id, conn.guild_id]);
                            }
                        }
                    });
                }
                console.log(`✅ ${voiceConnections.size} conexões de voz recuperadas`);
            });
    } catch (error) {
        console.error('Erro ao recuperar conexões de voz:', error);
    }
}

// Função para formatar tempo
function formatTime(seconds) {
    if (!seconds || seconds < 0) return '0s';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (secs > 0 && days === 0) result += `${secs}s`;
    
    return result.trim() || '0s';
}

// ==================== TRATAMENTO DE ERROS E SHUTDOWN ====================

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Desligando bot graciosamente...');
    
    try {
        const now = Math.floor(Date.now() / 1000);
        const savePromises = [];
        
        voiceConnections.forEach((connection, userId) => {
            const timeSpent = now - connection.joinTime;
            if (timeSpent > 0) {
                savePromises.push(
                    new Promise((resolve) => {
                        db.run(`UPDATE voice_time SET total_time = total_time + ?, session_start = NULL 
                                WHERE user_id = ? AND guild_id = ?`, 
                            [timeSpent, userId, connection.guildId], () => resolve());
                    })
                );
            }
        });
        
        await Promise.all(savePromises);
        console.log('💾 Dados de voz salvos');
        
        await new Promise((resolve) => {
            db.close((err) => {
                if (err) {
                    console.error('❌ Erro ao fechar banco:', err);
                } else {
                    console.log('✅ Banco de dados fechado');
                }
                resolve();
            });
        });
        
        client.destroy();
        console.log('✅ Bot desligado com sucesso!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro durante shutdown:', error);
        process.exit(1);
    }
});

// ==================== INICIAR BOT ====================

async function startBot() {
    try {
        console.log('🚀 Iniciando bot...');
        await client.login(config.token);
        
        setInterval(cleanExpiredData, 6 * 60 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ Erro crítico ao iniciar bot:', error);
        process.exit(1);
    }
}

startBot();