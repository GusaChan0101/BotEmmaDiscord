const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// Criar cliente do Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Coleção de comandos
client.commands = new Collection();

// Conectar ao banco de dados SQLite
const db = new sqlite3.Database('./data/bot.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite');
    }
});

// Criação das tabelas
db.serialize(() => {
    // Tabela de configurações do servidor
    db.run(`CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        ticket_category_id TEXT,
        support_role_id TEXT,
        council_role_id TEXT,
        log_channel_id TEXT,
        vip_role_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    // Tabela de tickets
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        type TEXT DEFAULT 'support',
        status TEXT DEFAULT 'open',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        closed_at INTEGER
    )`);
    
    // Tabela de VIPs
    db.run(`CREATE TABLE IF NOT EXISTS vips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        vip_type TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    // Tabela de tempo de voz
    db.run(`CREATE TABLE IF NOT EXISTS voice_time (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        total_time INTEGER DEFAULT 0,
        session_start INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY(user_id, guild_id)
    )`);
    
    // Tabela de verificações
    db.run(`CREATE TABLE IF NOT EXISTS verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        ticket_id TEXT,
        status TEXT DEFAULT 'pending',
        image_url TEXT,
        approved_by TEXT,
        rejected_by TEXT,
        rejection_reason TEXT,
        notes TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    // Tabela de configurações de verificação
    db.run(`CREATE TABLE IF NOT EXISTS verification_settings (
        guild_id TEXT PRIMARY KEY,
        verified_role_id TEXT NOT NULL,
        verification_channel_id TEXT NOT NULL,
        log_channel_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    // Tabela de advertências
    db.run(`CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    // Tabela de logs de moderação
    db.run(`CREATE TABLE IF NOT EXISTS mod_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT,
        details TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    // Tabela de handlers de tickets
    db.run(`CREATE TABLE IF NOT EXISTS ticket_handlers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        handler_id TEXT NOT NULL,
        accepted_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(ticket_id) REFERENCES tickets(id)
    )`);
    
    // Tabela de calls de tickets
    db.run(`CREATE TABLE IF NOT EXISTS ticket_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(ticket_id) REFERENCES tickets(id)
    )`);
    
    // Tabela de prioridades de tickets
    db.run(`CREATE TABLE IF NOT EXISTS ticket_priorities (
        ticket_id INTEGER PRIMARY KEY,
        priority TEXT NOT NULL,
        set_by TEXT NOT NULL,
        set_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(ticket_id) REFERENCES tickets(id)
    )`);
    
    console.log('✅ Todas as tabelas criadas/verificadas com sucesso!');
});

// Carregar comandos
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;
        
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Comando carregado: ${command.data.name}`);
            } else {
                console.log(`⚠️ Comando em ${filePath} está faltando "data" ou "execute"`);
            }
        }
    }
} else {
    console.log('⚠️ Pasta de comandos não encontrada');
}

// Event listeners
client.once('ready', () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);
    console.log(`📊 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuários: ${client.users.cache.size}`);
    
    // Definir status do bot
    client.user.setActivity('🎮 Anime & Games | /help', { type: 'PLAYING' });
});

// Manipulador de interações
client.on('interactionCreate', async (interaction) => {
    try {
        // Comandos slash
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`Comando ${interaction.commandName} não encontrado.`);
                return;
            }
            
            await command.execute(interaction, db);
        }
        
        // Sistema de tickets e verificação via botões
        else if (interaction.isButton()) {
            if (interaction.customId.startsWith('create_ticket_')) {
                const ticketType = interaction.customId.split('_')[2];
                await createTicket(interaction, ticketType, db);
            }
            else if (interaction.customId === 'close_ticket') {
                await closeTicket(interaction, db);
            }
            else if (interaction.customId === 'start_verification') {
                await startVerificationProcess(interaction, db);
            }
            else if (interaction.customId.startsWith('accept_ticket_')) {
                const channelId = interaction.customId.split('_')[2];
                await acceptTicket(interaction, channelId, db);
            }
            else if (interaction.customId.startsWith('create_call_')) {
                const channelId = interaction.customId.split('_')[2];
                await createTicketCall(interaction, channelId, db);
            }
            // Painel de configuração - botões principais
            else if (interaction.customId === 'config_tickets') {
                await configureTicketsPanel(interaction, db);
            }
            else if (interaction.customId === 'config_moderation') {
                await configureModerationPanel(interaction, db);
            }
            else if (interaction.customId === 'config_vip') {
                await configureVIPPanel(interaction, db);
            }
            else if (interaction.customId === 'config_verification') {
                await configureVerificationPanel(interaction, db);
            }
            else if (interaction.customId === 'config_panels') {
                await createPanelsMenu(interaction, db);
            }
            else if (interaction.customId === 'config_status') {
                await showCompleteStatusPanel(interaction, db);
            }
            else if (interaction.customId === 'back_to_main') {
                await showMainConfigPanel(interaction, db);
            }
            else if (interaction.customId === 'create_ticket_panel_now') {
                await handleCreateTicketPanel(interaction, db);
            }
            else if (interaction.customId === 'create_verification_panel_now') {
                await handleCreateVerificationPanel(interaction, db);
            }
        }

        // Select menus do painel
        else if (interaction.isAnySelectMenu()) {
            await handleSelectMenuInteraction(interaction, db);
        }
        
    } catch (error) {
        console.error('Erro na interação:', error);
        
        const errorMessage = { content: 'Houve um erro ao processar sua solicitação!', ephemeral: true };
        
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (err) {
            console.error('Erro ao responder:', err);
        }
    }
});

// Sistema de contador de horas de voz
client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild?.id || oldState.guild?.id;
    const now = Math.floor(Date.now() / 1000);
    
    // Debug log
    console.log(`Voice state update: ${userId} - Old: ${oldState.channelId} - New: ${newState.channelId}`);
    
    // Usuário entrou no canal de voz
    if (!oldState.channelId && newState.channelId) {
        console.log(`${userId} entrou no canal ${newState.channelId}`);
        db.run(`INSERT OR REPLACE INTO voice_time (user_id, guild_id, total_time, session_start) 
                VALUES (?, ?, COALESCE((SELECT total_time FROM voice_time WHERE user_id = ? AND guild_id = ?), 0), ?)`,
            [userId, guildId, userId, guildId, now], function(err) {
                if (err) console.error('Erro ao inserir voice_time:', err);
                else console.log(`Session iniciada para ${userId}`);
            });
    }
    
    // Usuário saiu do canal de voz
    if (oldState.channelId && !newState.channelId) {
        console.log(`${userId} saiu do canal ${oldState.channelId}`);
        db.get(`SELECT session_start, total_time FROM voice_time WHERE user_id = ? AND guild_id = ?`,
            [userId, guildId], (err, row) => {
                if (err) {
                    console.error('Erro ao buscar voice_time:', err);
                    return;
                }
                
                if (row && row.session_start) {
                    const sessionTime = now - row.session_start;
                    const newTotal = row.total_time + sessionTime;
                    
                    console.log(`${userId} teve sessão de ${sessionTime} segundos. Total: ${newTotal}`);
                    
                    db.run(`UPDATE voice_time SET total_time = ?, session_start = NULL WHERE user_id = ? AND guild_id = ?`,
                        [newTotal, userId, guildId], function(err) {
                            if (err) console.error('Erro ao atualizar voice_time:', err);
                            else console.log(`Total atualizado para ${userId}: ${newTotal} segundos`);
                        });
                } else {
                    console.log(`Nenhuma sessão ativa encontrada para ${userId}`);
                }
            });
    }
    
    // Usuário mudou de canal (saiu de um e entrou em outro)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        console.log(`${userId} mudou do canal ${oldState.channelId} para ${newState.channelId}`);
        // Atualizar o tempo da sessão anterior e iniciar nova sessão
        db.get(`SELECT session_start, total_time FROM voice_time WHERE user_id = ? AND guild_id = ?`,
            [userId, guildId], (err, row) => {
                if (row && row.session_start) {
                    const sessionTime = now - row.session_start;
                    const newTotal = row.total_time + sessionTime;
                    
                    db.run(`UPDATE voice_time SET total_time = ?, session_start = ? WHERE user_id = ? AND guild_id = ?`,
                        [newTotal, now, userId, guildId]);
                }
            });
    }
});

// Função para criar tickets
async function createTicket(interaction, type, db) {
    const guild = interaction.guild;
    const user = interaction.user;
    const ticketId = `ticket-${type}-${user.id}`;
    
    // Verificar se já tem ticket aberto
    db.get(`SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = 'open'`,
        [user.id, guild.id], async (err, row) => {
            if (row) {
                return interaction.reply({ content: 'Você já tem um ticket aberto!', ephemeral: true });
            }
            
            // Buscar configurações do servidor
            db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [guild.id], async (err, settings) => {
                try {
                    const categoryId = settings?.ticket_category_id;
                    const supportRoleId = type === 'support' ? settings?.support_role_id : settings?.council_role_id;
                    
                    // Permissões base - AMBOS OS TIPOS SÃO PRIVADOS
                    const permissionOverwrites = [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: user.id, // Criador do ticket
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        }
                    ];
                    
                    // Adicionar cargo específico se configurado
                    if (supportRoleId) {
                        permissionOverwrites.push({
                            id: supportRoleId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        });
                    }
                    
                    // Criar canal do ticket
                    const ticketChannel = await guild.channels.create({
                        name: ticketId,
                        type: 0, // GUILD_TEXT
                        parent: categoryId,
                        permissionOverwrites: permissionOverwrites,
                    });
                    
                    // Salvar ticket no banco
                    db.run(`INSERT INTO tickets (ticket_id, user_id, guild_id, channel_id, type) VALUES (?, ?, ?, ?, ?)`,
                        [ticketId, user.id, guild.id, ticketChannel.id, type]);
                    
                    // Embed de boas-vindas do ticket
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor(type === 'support' ? '#0099ff' : '#8B008B') // Azul para suporte, roxo para conselho
                        .setTitle(`🎫 Ticket ${type === 'support' ? 'de Suporte' : 'do Conselho'}`)
                        .setDescription(`Olá ${user}, bem-vindo ao seu ticket **${type === 'support' ? 'de suporte técnico' : 'do conselho'}**!\n\n${type === 'support' ? 'Descreva seu problema técnico e nossa equipe de suporte irá ajudá-lo.' : 'Este é um canal privado para questões do conselho. Descreva sua situação detalhadamente.'}\n\n🔒 **Este ticket é completamente privado.**\n⏰ Aguarde um membro da equipe aceitar o atendimento.`)
                        .setTimestamp();
                    
                    const ticketButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`accept_ticket_${ticketChannel.id}`)
                                .setLabel('✋ Aceitar Ticket')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('✋'),
                            new ButtonBuilder()
                                .setCustomId(`create_call_${ticketChannel.id}`)
                                .setLabel('📞 Criar Call')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('📞'),
                            new ButtonBuilder()
                                .setCustomId('close_ticket')
                                .setLabel('🔒 Fechar Ticket')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('🔒')
                        );
                    
                    // Mencionar o cargo apropriado
                    const mentionText = supportRoleId ? `<@&${supportRoleId}>` : '';
                    
                    await ticketChannel.send({
                        content: mentionText,
                        embeds: [welcomeEmbed],
                        components: [ticketButtons]
                    });
                    
                    await interaction.reply({ 
                        content: `🎫 Ticket ${type === 'support' ? 'de Atendimento' : 'do conselho'} criado! ${ticketChannel}\n\n🔒 **Ticket completamente privado** - apenas você e a equipe podem ver.`, 
                        ephemeral: true 
                    });
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: 'Erro ao criar ticket!', ephemeral: true });
                }
            });
        });
}

// Função para fechar tickets
async function closeTicket(interaction, db) {
    const channel = interaction.channel;
    
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: 'Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            // Verificar permissões
            const member = interaction.member;
            const hasPermission = member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                                  ticket.user_id === member.id;
            
            if (!hasPermission) {
                return interaction.reply({ content: 'Você não tem permissão para fechar este ticket!', ephemeral: true });
            }
            
            // Atualizar banco
            db.run(`UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?`,
                [Math.floor(Date.now() / 1000), ticket.id]);
            
            // Deletar calls associadas
            db.all(`SELECT channel_id FROM ticket_calls WHERE ticket_id = ?`, [ticket.id], async (err, calls) => {
                if (calls) {
                    for (const call of calls) {
                        const callChannel = interaction.guild.channels.cache.get(call.channel_id);
                        if (callChannel) {
                            try {
                                await callChannel.delete();
                            } catch (error) {
                                console.error('Erro ao deletar call:', error);
                            }
                        }
                    }
                    // Remover calls do banco
                    db.run(`DELETE FROM ticket_calls WHERE ticket_id = ?`, [ticket.id]);
                }
            });
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔒 Ticket Fechado')
                .setDescription(`Ticket fechado por ${interaction.user}\n\nEste canal será deletado em 10 segundos...`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
            // Log do ticket (se canal de log configurado)
            db.get(`SELECT log_channel_id FROM guild_settings WHERE guild_id = ?`,
                [interaction.guild.id], async (err, settings) => {
                    if (settings?.log_channel_id) {
                        const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('📋 Ticket Fechado')
                                .setDescription(`**ID:** ${ticket.ticket_id}\n**Usuário:** <@${ticket.user_id}>\n**Tipo:** ${ticket.type}\n**Fechado por:** ${interaction.user}\n**Duração:** <t:${ticket.created_at}:R>`)
                                .setTimestamp();
                            
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }
                });
            
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error('Erro ao deletar canal:', error);
                }
            }, 10000);
        });
}

// Função para iniciar processo de verificação
async function startVerificationProcess(interaction, db) {
    const guild = interaction.guild;
    const user = interaction.user;
    
    // Verificar se o usuário já está verificado
    db.get(`SELECT verified_role_id FROM verification_settings WHERE guild_id = ?`, [guild.id], async (err, settings) => {
        if (!settings) {
            return interaction.reply({ content: '❌ Sistema de verificação não configurado!', ephemeral: true });
        }
        
        const verifiedRole = guild.roles.cache.get(settings.verified_role_id);
        const member = await guild.members.fetch(user.id);
        
        if (member.roles.cache.has(settings.verified_role_id)) {
            return interaction.reply({ content: '✅ Você já está verificado!', ephemeral: true });
        }
        
        // Verificar se já tem verificação pendente
        db.get(`SELECT * FROM verifications WHERE user_id = ? AND guild_id = ? AND status = 'pending'`,
            [user.id, guild.id], async (err, existingVerification) => {
                if (existingVerification) {
                    return interaction.reply({ 
                        content: '⚠️ Você já tem uma verificação pendente! Aguarde a análise da equipe.', 
                        ephemeral: true 
                    });
                }
                
                // Verificar se já tem ticket de verificação aberto
                db.get(`SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = 'open' AND type = 'verification'`,
                    [user.id, guild.id], async (err, existingTicket) => {
                        if (existingTicket) {
                            const existingChannel = guild.channels.cache.get(existingTicket.channel_id);
                            if (existingChannel) {
                                return interaction.reply({ 
                                    content: `⚠️ Você já tem um ticket de verificação aberto: ${existingChannel}`, 
                                    ephemeral: true 
                                });
                            }
                        }
                        
                        // Buscar configurações do sistema de tickets
                        db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [guild.id], async (err, ticketSettings) => {
                            try {
                                const categoryId = ticketSettings?.ticket_category_id;
                                const ticketId = `verification-${user.id}`;
                                
                                // Permissões do ticket de verificação
                                const permissionOverwrites = [
                                    {
                                        id: guild.id, // @everyone
                                        deny: [PermissionFlagsBits.ViewChannel],
                                    },
                                    {
                                        id: user.id, // Usuário
                                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                                    }
                                ];
                                
                                // Adicionar cargo de suporte se configurado
                                if (ticketSettings?.support_role_id) {
                                    permissionOverwrites.push({
                                        id: ticketSettings.support_role_id,
                                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                                    });
                                }
                                
                                // Criar canal do ticket
                                const ticketChannel = await guild.channels.create({
                                    name: ticketId,
                                    type: 0, // GUILD_TEXT
                                    parent: categoryId,
                                    permissionOverwrites: permissionOverwrites,
                                });
                                
                                // Salvar ticket no banco
                                db.run(`INSERT INTO tickets (ticket_id, user_id, guild_id, channel_id, type) VALUES (?, ?, ?, ?, ?)`,
                                    [ticketId, user.id, guild.id, ticketChannel.id, 'verification']);
                                
                                // Criar verificação pendente
                                db.run(`INSERT INTO verifications (user_id, guild_id, ticket_id, status) VALUES (?, ?, ?, ?)`,
                                    [user.id, guild.id, ticketId, 'pending']);
                                
                                // Embed de boas-vindas do ticket de verificação
                                const welcomeEmbed = new EmbedBuilder()
                                    .setColor('#00ff7f')
                                    .setTitle('🛡️ Ticket de Verificação')
                                    .setDescription(`Olá ${user}, bem-vindo ao seu ticket de verificação!\n\n**Instruções:**\n1️⃣ Nossa equipe irá te orientar no processo\n2️⃣ Siga as instruções fornecidas\n3️⃣ Aguarde a análise da documentação\n4️⃣ Após aprovação, você receberá o cargo ${verifiedRole}\n\n🔒 **Este ticket é completamente privado e seguro.**\n⏰ Aguarde um membro da equipe aceitar o atendimento.`)
                                    .setThumbnail(user.displayAvatarURL())
                                    .setTimestamp();
                                
                                const verificationButtons = new ActionRowBuilder()
                                    .addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`accept_ticket_${ticketChannel.id}`)
                                            .setLabel('✋ Aceitar Verificação')
                                            .setStyle(ButtonStyle.Success)
                                            .setEmoji('✋'),
                                        new ButtonBuilder()
                                            .setCustomId(`create_call_${ticketChannel.id}`)
                                            .setLabel('📞 Criar Call')
                                            .setStyle(ButtonStyle.Primary)
                                            .setEmoji('📞'),
                                        new ButtonBuilder()
                                            .setCustomId('close_ticket')
                                            .setLabel('🔒 Fechar Ticket')
                                            .setStyle(ButtonStyle.Danger)
                                            .setEmoji('🔒')
                                    );
                                
                                // Mencionar o cargo de suporte se configurado
                                const mentionText = ticketSettings?.support_role_id ? `<@&${ticketSettings.support_role_id}>` : '';
                                
                                await ticketChannel.send({
                                    content: mentionText,
                                    embeds: [welcomeEmbed],
                                    components: [verificationButtons]
                                });
                                
                                await interaction.reply({ 
                                    content: `🛡️ Ticket de verificação criado! ${ticketChannel}\n\n✅ Nossa equipe irá te ajudar no processo.`, 
                                    ephemeral: true 
                                });
                                
                            } catch (error) {
                                console.error(error);
                                await interaction.reply({ content: 'Erro ao criar ticket de verificação!', ephemeral: true });
                            }
                        });
                    });
            });
    });
}

// Função para aceitar ticket
async function acceptTicket(interaction, channelId, db) {
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel || channel.id !== interaction.channel.id) {
        return interaction.reply({ content: '❌ Erro ao identificar o ticket!', ephemeral: true });
    }
    
    // Verificar se tem permissão para aceitar tickets
    db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [interaction.guild.id], async (err, settings) => {
        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                             (settings?.support_role_id && interaction.member.roles.cache.has(settings.support_role_id)) ||
                             (settings?.council_role_id && interaction.member.roles.cache.has(settings.council_role_id));
        
        if (!hasPermission) {
            return interaction.reply({ content: '❌ Você não tem permissão para aceitar tickets!', ephemeral: true });
        }
        
        // Buscar informações do ticket
        db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`, [channelId], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: '❌ Ticket não encontrado!', ephemeral: true });
            }
            
            // Verificar se já foi aceito
            db.get(`SELECT * FROM ticket_handlers WHERE ticket_id = ?`, [ticket.id], async (err, handler) => {
                if (handler) {
                    const existingHandler = await interaction.guild.members.fetch(handler.handler_id).catch(() => null);
                    return interaction.reply({ 
                        content: `❌ Este ticket já foi aceito por ${existingHandler || 'um membro da equipe'}!`, 
                        ephemeral: true 
                    });
                }
                
                // Registrar o handler
                db.run(`INSERT INTO ticket_handlers (ticket_id, handler_id) VALUES (?, ?)`,
                    [ticket.id, interaction.user.id], async function(err) {
                        if (err) {
                            return interaction.reply({ content: 'Erro ao aceitar ticket!', ephemeral: true });
                        }
                        
                        const user = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
                        
                        const acceptEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✋ Ticket Aceito')
                            .setDescription(`**Atendente:** ${interaction.user}\n**Cliente:** ${user || 'Usuário não encontrado'}\n**Tipo:** ${ticket.type}\n\n✅ Atendimento iniciado! O cliente pode agora interagir diretamente com você.`)
                            .setThumbnail(interaction.user.displayAvatarURL())
                            .setTimestamp();
                        
                        // Atualizar botões - remover aceitar, manter call e fechar
                        const updatedButtons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`create_call_${channelId}`)
                                    .setLabel('📞 Criar Call')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('📞'),
                                new ButtonBuilder()
                                    .setCustomId('close_ticket')
                                    .setLabel('🔒 Fechar Ticket')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('🔒')
                            );
                        
                        await interaction.update({
                            components: [updatedButtons]
                        });
                        
                        await interaction.followUp({
                            embeds: [acceptEmbed]
                        });
                        
                        // Notificar o usuário por DM se possível
                        if (user) {
                            try {
                                const dmEmbed = new EmbedBuilder()
                                    .setColor('#00ff00')
                                    .setTitle('✅ Seu ticket foi aceito!')
                                    .setDescription(`Seu ticket em **${interaction.guild.name}** foi aceito por ${interaction.user}.\n\nVocê pode continuar a conversa no canal do ticket.`)
                                    .setTimestamp();
                                
                                await user.send({ embeds: [dmEmbed] });
                            } catch (error) {
                                // Usuário pode ter DMs desabilitadas
                            }
                        }
                        
                        // Log da ação
                        await logTicketAction(interaction, 'Ticket Accepted', ticket, user, db);
                    });
            });
        });
    });
}

// Função para criar call do ticket
async function createTicketCall(interaction, channelId, db) {
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel || channel.id !== interaction.channel.id) {
        return interaction.reply({ content: '❌ Erro ao identificar o ticket!', ephemeral: true });
    }
    
    // Verificar permissões
    db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [interaction.guild.id], async (err, settings) => {
        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                             (settings?.support_role_id && interaction.member.roles.cache.has(settings.support_role_id)) ||
                             (settings?.council_role_id && interaction.member.roles.cache.has(settings.council_role_id));
        
        if (!hasPermission) {
            return interaction.reply({ content: '❌ Você não tem permissão para criar calls!', ephemeral: true });
        }
        
        // Buscar ticket
        db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`, [channelId], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: '❌ Ticket não encontrado!', ephemeral: true });
            }
            
            // Verificar se já existe call para este ticket
            db.get(`SELECT * FROM ticket_calls WHERE ticket_id = ?`, [ticket.id], async (err, existingCall) => {
                if (existingCall) {
                    const existingChannel = interaction.guild.channels.cache.get(existingCall.channel_id);
                    if (existingChannel) {
                        return interaction.reply({ 
                            content: `❌ Já existe uma call para este ticket: ${existingChannel}`, 
                            ephemeral: true 
                        });
                    }
                }
                
                try {
                    await interaction.deferReply();
                    
                    const user = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
                    const callName = `Call-${ticket.type}-${user ? user.displayName : ticket.user_id}`;
                    
                    // Buscar categoria do ticket
                    const categoryId = settings?.ticket_category_id;
                    
                    // Permissões da call
                    const permissionOverwrites = [
                        {
                            id: interaction.guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                        },
                        {
                            id: ticket.user_id, // Cliente
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
                        },
                        {
                            id: interaction.user.id, // Atendente
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers],
                        }
                    ];
                    
                    // Adicionar cargos de suporte se configurados
                    if (settings?.support_role_id) {
                        permissionOverwrites.push({
                            id: settings.support_role_id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
                        });
                    }
                    
                    if (settings?.council_role_id) {
                        permissionOverwrites.push({
                            id: settings.council_role_id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
                        });
                    }
                    
                    // Criar canal de voz
                    const voiceChannel = await interaction.guild.channels.create({
                        name: callName,
                        type: 2, // GUILD_VOICE
                        parent: categoryId,
                        permissionOverwrites: permissionOverwrites,
                        userLimit: 10
                    });
                    
                    // Salvar call no banco
                    db.run(`INSERT INTO ticket_calls (ticket_id, channel_id, created_by) VALUES (?, ?, ?)`,
                        [ticket.id, voiceChannel.id, interaction.user.id]);
                    
                    const callEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('📞 Call Criada')
                        .setDescription(`**Call:** ${voiceChannel}\n**Criada por:** ${interaction.user}\n**Para:** ${user || 'Cliente'}\n**Tipo:** ${ticket.type}\n\n🔊 Ambos podem entrar na call para conversar por voz!`)
                        .setTimestamp();
                    
                    await interaction.editReply({
                        embeds: [callEmbed]
                    });
                    
                    // Notificar cliente por DM
                    if (user) {
                        try {
                            const dmEmbed = new EmbedBuilder()
                                .setColor('#0099ff')
                                .setTitle('📞 Call criada para seu ticket!')
                                .setDescription(`Uma call de voz foi criada para seu ticket em **${interaction.guild.name}**.\n\n🔊 **Call:** ${voiceChannel.name}\n\nVocê pode entrar na call para conversar diretamente com a equipe.`)
                                .setTimestamp();
                            
                            await user.send({ embeds: [dmEmbed] });
                        } catch (error) {
                            // Usuário pode ter DMs desabilitadas
                        }
                    }
                    
                    // Log da ação
                    await logTicketAction(interaction, 'Call Created', ticket, user, db);
                    
                } catch (error) {
                    console.error(error);
                    await interaction.editReply({ content: 'Erro ao criar call!' });
                }
            });
        });
    });
}

// Função para log de ações de ticket
async function logTicketAction(interaction, action, ticket, user, db) {
    db.get(`SELECT log_channel_id FROM guild_settings WHERE guild_id = ?`,
        [interaction.guild.id], async (err, settings) => {
            if (settings?.log_channel_id) {
                const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`📋 ${action}`)
                        .setDescription(`**Ticket ID:** ${ticket.ticket_id}\n**Usuário:** ${user || 'Não encontrado'}\n**Tipo:** ${ticket.type}\n**Staff:** ${interaction.user}\n**Canal:** ${interaction.channel}`)
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [embed] });
                }
            }
        });
}

// Funções do painel de configuração
async function configureTicketsPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎫 Configuração do Sistema de Tickets')
        .setDescription('Configure todos os aspectos do sistema de tickets de forma visual!')
        .setTimestamp();

    db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [interaction.guild.id], (err, settings) => {
        let configStatus = '**Status atual:**\n';
        configStatus += `📁 Categoria: ${settings?.ticket_category_id ? '✅' : '❌'}\n`;
        configStatus += `🛠️ Suporte: ${settings?.support_role_id ? '✅' : '❌'}\n`;
        configStatus += `🏛️ Conselho: ${settings?.council_role_id ? '✅' : '❌'}\n`;
        configStatus += `📋 Logs: ${settings?.log_channel_id ? '✅' : '❌'}`;

        embed.addFields({
            name: '📊 Status',
            value: configStatus,
            inline: false
        });

        const components = [];

        // Select para categoria
        components.push(new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('set_ticket_category')
                    .setPlaceholder('📁 Escolher categoria para tickets...')
                    .setChannelTypes([4]) // Category channels
            )
        );

        // Select para cargo de suporte
        components.push(new ActionRowBuilder()
            .addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('set_support_role')
                    .setPlaceholder('🛠️ Escolher cargo de suporte...')
            )
        );

        // Select para cargo do conselho
        components.push(new ActionRowBuilder()
            .addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('set_council_role')
                    .setPlaceholder('🏛️ Escolher cargo do conselho...')
            )
        );

        // Botões de ação
        components.push(new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_panel_now')
                    .setLabel('🎫 Criar Painel de Tickets')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('◀️ Voltar')
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        interaction.update({
            embeds: [embed],
            components: components
        });
    });
}

async function configureModerationPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#ff6600')
        .setTitle('🔨 Sistema de Moderação')
        .setDescription('Configure o canal de logs para registrar todas as ações de moderação.\n\n**Comandos já disponíveis:**\n• `/mod ban` - Banir usuários\n• `/mod kick` - Expulsar usuários\n• `/mod mute` - Silenciar usuários\n• `/mod warn` - Advertir usuários\n• `/mod addcargo` - Adicionar cargos\n• `/mod removecargo` - Remover cargos\n• `/mod clear` - Limpar mensagens')
        .setTimestamp();

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('set_log_channel')
                    .setPlaceholder('📋 Escolher canal para logs...')
                    .setChannelTypes([0]) // Text channels
            ),
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('◀️ Voltar')
                    .setStyle(ButtonStyle.Secondary)
            )
    ];

    interaction.update({
        embeds: [embed],
        components: components
    });
}

async function configureVIPPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('👑 Sistema VIP')
        .setDescription('Configure os cargos VIP e a categoria para calls permanentes.')
        .setTimestamp();

    // Cada select menu deve estar em sua própria ActionRow
    const vipTypes = [
        { type: 'bronze', emoji: '🥉', label: 'VIP Bronze' },
        { type: 'prata', emoji: '🥈', label: 'VIP Prata' },
        { type: 'ouro', emoji: '🥇', label: 'VIP Ouro' },
        { type: 'diamante', emoji: '💎', label: 'VIP Diamante' }
    ];

    const components = [];
    for (let i = 0; i < vipTypes.length; i++) {
        components.push(
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId(`set_vip_role_${vipTypes[i].type}`)
                    .setPlaceholder(`${vipTypes[i].emoji} Escolher cargo para ${vipTypes[i].label}...`)
            )
        );
    }

    // Select para categoria VIP
    components.push(new ActionRowBuilder()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('set_vip_category')
                .setPlaceholder('📁 Escolher categoria para calls VIP...')
                .setChannelTypes([4])
        )
    );

    // Botão voltar
    // Se já atingiu 5 ActionRows, substitui o último pelo botão voltar
    if (components.length === 5) {
        components[4] = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar')
                .setStyle(ButtonStyle.Secondary)
        );
    } else if (components.length < 5) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar')
                .setStyle(ButtonStyle.Secondary)
        ));
    }

    interaction.update({
        embeds: [embed],
        components: components.slice(0, 5)
    });
}

async function configureVerificationPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('🛡️ Sistema de Verificação')
        .setDescription('Configure o sistema de verificação com análise de documentos.')
        .setTimestamp();

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('set_verified_role')
                    .setPlaceholder('🎭 Escolher cargo de verificado...')
            ),
        new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('set_verification_channel')
                    .setPlaceholder('📍 Escolher canal para painel de verificação...')
                    .setChannelTypes([0]) // Text channels
            ),
        new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('set_verification_logs')
                    .setPlaceholder('📋 Escolher canal para logs de verificação...')
                    .setChannelTypes([0]) // Text channels
            ),
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_verification_panel_now')
                    .setLabel('🛡️ Criar Painel de Verificação')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('◀️ Voltar')
                    .setStyle(ButtonStyle.Secondary)
            )
    ];

    interaction.update({
        embeds: [embed],
        components: components
    });
}

async function createPanelsMenu(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#9932cc')
        .setTitle('📋 Criar Painéis')
        .setDescription('Escolha onde enviar os painéis interativos para os usuários.')
        .setTimestamp();

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_panel_now')
                    .setLabel('🎫 Criar Painel de Tickets')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('create_verification_panel_now')
                    .setLabel('🛡️ Criar Painel de Verificação')
                    .setStyle(ButtonStyle.Success)
            ),
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('◀️ Voltar')
                    .setStyle(ButtonStyle.Secondary)
            )
    ];

    interaction.update({
        embeds: [embed],
        components: components
    });
}

async function showCompleteStatusPanel(interaction, db) {
    await interaction.deferUpdate();

    // Buscar todas as estatísticas
    const stats = await gatherAllStats(interaction.guild.id, db);

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📊 Status Completo do Bot')
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

    // Configurações
    embed.addFields({
        name: '⚙️ Configurações',
        value: `🎫 Tickets: ${stats.ticketsConfigured ? '✅' : '❌'}\n🔨 Moderação: ${stats.moderationConfigured ? '✅' : '❌'}\n👑 VIP: ${stats.vipConfigured ? '✅' : '❌'}\n🛡️ Verificação: ${stats.verificationConfigured ? '✅' : '❌'}`,
        inline: true
    });

    // Estatísticas gerais
    embed.addFields({
        name: '📈 Estatísticas',
        value: `🎫 Tickets: ${stats.totalTickets}\n👥 VIPs: ${stats.totalVips}\n🛡️ Verificações: ${stats.totalVerifications}\n🎤 Tempo total: ${stats.totalVoiceTime}`,
        inline: true
    });

    // Atividade atual
    embed.addFields({
        name: '🔴 Atividade Atual',
        value: `🎫 Tickets abertos: ${stats.openTickets}\n🔴 Usuários em call: ${stats.usersInVoice}\n🕐 Verificações pendentes: ${stats.pendingVerifications}`,
        inline: true
    });

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({
        embeds: [embed],
        components: [backButton]
    });
}

async function showMainConfigPanel(interaction, db) {
    // Recarregar o painel principal
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('⚙️ Painel de Configuração Completo')
        .setDescription(`**Servidor:** ${interaction.guild.name}\n**Administrador:** ${interaction.user}\n\n🎛️ Use os botões abaixo para configurar todos os sistemas!`)
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

    const mainButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('config_tickets')
                .setLabel('🎫 Sistema de Tickets')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('config_moderation')
                .setLabel('🔨 Moderação & Logs')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('config_vip')
                .setLabel('👑 Sistema VIP')
                .setStyle(ButtonStyle.Success)
        );

    const secondaryButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('config_verification')
                .setLabel('🛡️ Verificação')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('config_panels')
                .setLabel('📋 Criar Painéis')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('config_status')
                .setLabel('📊 Ver Status')
                .setStyle(ButtonStyle.Secondary)
        );

    interaction.update({
        embeds: [embed],
        components: [mainButtons, secondaryButtons]
    });
}

// Handler para select menus
async function handleSelectMenuInteraction(interaction, db) {
    const { customId, values } = interaction;

    // Configuração de categoria de tickets
    if (customId === 'set_ticket_category') {
        const categoryId = values[0];
        
        db.run(`INSERT OR REPLACE INTO guild_settings (guild_id, ticket_category_id) 
                VALUES (?, ?)`,
            [interaction.guild.id, categoryId], (err) => {
                if (err) {
                    return interaction.reply({ content: 'Erro ao salvar categoria!', ephemeral: true });
                }
                
                const category = interaction.guild.channels.cache.get(categoryId);
                interaction.reply({ 
                    content: `✅ Categoria de tickets definida: **${category.name}**`, 
                    ephemeral: true 
                });
            });
    }

    // Configuração de cargo de suporte
    if (customId === 'set_support_role') {
        const roleId = values[0];
        
        db.run(`UPDATE guild_settings SET support_role_id = ? WHERE guild_id = ?`,
            [roleId, interaction.guild.id], (err) => {
                if (this.changes === 0) {
                    db.run(`INSERT INTO guild_settings (guild_id, support_role_id) VALUES (?, ?)`,
                        [interaction.guild.id, roleId]);
                }
                
                const role = interaction.guild.roles.cache.get(roleId);
                interaction.reply({ 
                    content: `✅ Cargo de suporte definido: **${role.name}**`, 
                    ephemeral: true 
                });
            });
    }

    // Configuração de cargo do conselho
    if (customId === 'set_council_role') {
        const roleId = values[0];
        
        db.run(`UPDATE guild_settings SET council_role_id = ? WHERE guild_id = ?`,
            [roleId, interaction.guild.id], (err) => {
                if (this.changes === 0) {
                    db.run(`INSERT INTO guild_settings (guild_id, council_role_id) VALUES (?, ?)`,
                        [interaction.guild.id, roleId]);
                }
                
                const role = interaction.guild.roles.cache.get(roleId);
                interaction.reply({ 
                    content: `✅ Cargo do conselho definido: **${role.name}**`, 
                    ephemeral: true 
                });
            });
    }

    // Configuração de canal de logs
    if (customId === 'set_log_channel') {
        const channelId = values[0];
        
        db.run(`UPDATE guild_settings SET log_channel_id = ? WHERE guild_id = ?`,
            [channelId, interaction.guild.id], (err) => {
                if (this.changes === 0) {
                    db.run(`INSERT INTO guild_settings (guild_id, log_channel_id) VALUES (?, ?)`,
                        [interaction.guild.id, channelId]);
                }
                
                const channel = interaction.guild.channels.cache.get(channelId);
                interaction.reply({ 
                    content: `✅ Canal de logs definido: **${channel.name}**`, 
                    ephemeral: true 
                });
            });
    }

    // Configuração de cargos VIP
    if (customId.startsWith('set_vip_role_')) {
        const vipType = customId.split('_')[3]; // bronze, prata, ouro, diamante
        const roleId = values[0];

        // Criar tabela VIP se não existir
        db.run(`CREATE TABLE IF NOT EXISTS vip_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            vip_type TEXT NOT NULL,
            role_id TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            UNIQUE(guild_id, vip_type)
        )`);

        db.run(`INSERT OR REPLACE INTO vip_roles (guild_id, vip_type, role_id) VALUES (?, ?, ?)`,
            [interaction.guild.id, vipType, roleId], (err) => {
                if (err) {
                    return interaction.reply({ content: 'Erro ao salvar cargo VIP!', ephemeral: true });
                }
                
                const role = interaction.guild.roles.cache.get(roleId);
                const emoji = getVipEmojiPanel(vipType);
                interaction.reply({ 
                    content: `✅ Cargo VIP ${emoji} **${vipType.toUpperCase()}** definido: **${role.name}**`, 
                    ephemeral: true 
                });
            });
    }

    // Configuração de categoria VIP
    if (customId === 'set_vip_category') {
        const categoryId = values[0];

        db.run(`CREATE TABLE IF NOT EXISTS vip_settings (
            guild_id TEXT PRIMARY KEY,
            vip_category_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);

        db.run(`INSERT OR REPLACE INTO vip_settings (guild_id, vip_category_id) VALUES (?, ?)`,
            [interaction.guild.id, categoryId], (err) => {
                if (err) {
                    return interaction.reply({ content: 'Erro ao salvar categoria VIP!', ephemeral: true });
                }
                
                const category = interaction.guild.channels.cache.get(categoryId);
                interaction.reply({ 
                    content: `✅ Categoria VIP definida: **${category.name}**`, 
                    ephemeral: true 
                });
            });
    }

    // Configuração de verificação
    if (customId === 'set_verified_role') {
        const roleId = values[0];

        db.run(`INSERT OR REPLACE INTO verification_settings (guild_id, verified_role_id, verification_channel_id) 
                VALUES (?, ?, '')`,
            [interaction.guild.id, roleId], (err) => {
                if (err) {
                    return interaction.reply({ content: 'Erro ao salvar cargo de verificado!', ephemeral: true });
                }
                
                const role = interaction.guild.roles.cache.get(roleId);
                interaction.reply({ 
                    content: `✅ Cargo de verificado definido: **${role.name}**`, 
                    ephemeral: true 
                });
            });
    }

    if (customId === 'set_verification_channel') {
        const channelId = values[0];

        db.run(`UPDATE verification_settings SET verification_channel_id = ? WHERE guild_id = ?`,
            [channelId, interaction.guild.id], (err) => {
                if (this.changes === 0) {
                    db.run(`INSERT INTO verification_settings (guild_id, verified_role_id, verification_channel_id) VALUES (?, '', ?)`,
                        [interaction.guild.id, channelId]);
                }
                
                const channel = interaction.guild.channels.cache.get(channelId);
                interaction.reply({ 
                    content: `✅ Canal de verificação definido: **${channel.name}**`, 
                    ephemeral: true 
                });
            });
    }

    if (customId === 'set_verification_logs') {
        const channelId = values[0];

        db.run(`UPDATE verification_settings SET log_channel_id = ? WHERE guild_id = ?`,
            [channelId, interaction.guild.id], (err) => {
                const channel = interaction.guild.channels.cache.get(channelId);
                interaction.reply({ 
                    content: `✅ Canal de logs de verificação definido: **${channel.name}**`, 
                    ephemeral: true 
                });
            });
    }
}

// Handlers para criar painéis
async function handleCreateTicketPanel(interaction, db) {
    // Verificar se está configurado
    db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [interaction.guild.id], async (err, settings) => {
        if (!settings?.ticket_category_id) {
            return interaction.reply({ 
                content: '❌ Configure primeiro a categoria de tickets!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎫 Sistema de Tickets')
            .setDescription('**Precisa de ajuda? Abra um ticket!**\n\n🛠️ **Suporte Técnico** - Problemas com o bot, comandos, bugs\n🏛️ **Conselho** - Questões administrativas, sugestões, denúncias\n\n🔒 **Todos os tickets são completamente privados**\n⚡ **Resposta rápida da nossa equipe**')
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Sistema de Tickets - Seguro e Confiável' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_support')
                    .setLabel('🛠️ Suporte Técnico')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🛠️'),
                new ButtonBuilder()
                    .setCustomId('create_ticket_council')
                    .setLabel('🏛️ Conselho')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏛️')
            );

        // Enviar para o canal atual
        const targetChannel = interaction.channel;
        
        await targetChannel.send({
            embeds: [embed],
            components: [buttons]
        });

        interaction.reply({ 
            content: `✅ Painel de tickets criado em ${targetChannel}!`, 
            ephemeral: true 
        });
    });
}

async function handleCreateVerificationPanel(interaction, db) {
    // Verificar se está configurado
    db.get(`SELECT * FROM verification_settings WHERE guild_id = ?`, [interaction.guild.id], async (err, settings) => {
        if (!settings?.verified_role_id) {
            return interaction.reply({ 
                content: '❌ Configure primeiro o sistema de verificação!', 
                ephemeral: true 
            });
        }

        const verifiedRole = interaction.guild.roles.cache.get(settings.verified_role_id);

        const embed = new EmbedBuilder()
            .setColor('#00ff7f')
            .setTitle('🛡️ Sistema de Verificação')
            .setDescription(`**Bem-vindo ao sistema de verificação!**\n\nPara ter acesso completo ao servidor, você precisa se verificar.\n\n**Como funciona:**\n1️⃣ Clique no botão abaixo\n2️⃣ Um ticket de verificação será criado\n3️⃣ Nossa equipe irá te orientar no processo\n4️⃣ Após aprovação, você receberá o cargo ${verifiedRole}\n\n🔒 **Processo seguro e privado**\n⚡ **Análise rápida pela equipe**`)
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Sistema de Verificação - Seguro e Confiável' })
            .setTimestamp();

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verification')
                    .setLabel('🛡️ Iniciar Verificação')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🛡️')
            );

        const targetChannel = interaction.channel;
        
        await targetChannel.send({
            embeds: [embed],
            components: [button]
        });

        interaction.reply({ 
            content: `✅ Painel de verificação criado em ${targetChannel}!`, 
            ephemeral: true 
        });
    });
}

// Função auxiliar para coletar estatísticas
async function gatherAllStats(guildId, db) {
    return new Promise((resolve) => {
        const stats = {};
        
        // Verificar configurações
        db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [guildId], (err, settings) => {
            stats.ticketsConfigured = !!(settings?.ticket_category_id);
            stats.moderationConfigured = !!(settings?.log_channel_id);
            
            // Verificar VIP
            db.get(`SELECT COUNT(*) as count FROM vip_roles WHERE guild_id = ?`, [guildId], (err, vipCount) => {
                stats.vipConfigured = (vipCount?.count > 0);
                
                // Verificar verificação
                db.get(`SELECT * FROM verification_settings WHERE guild_id = ?`, [guildId], (err, verificationSettings) => {
                    stats.verificationConfigured = !!verificationSettings;
                    
                    // Estatísticas de tickets
                    db.all(`SELECT 
                                COUNT(*) as total,
                                COUNT(CASE WHEN status = 'open' THEN 1 END) as open
                            FROM tickets WHERE guild_id = ?`, [guildId], (err, ticketStats) => {
                        
                        stats.totalTickets = ticketStats[0]?.total || 0;
                        stats.openTickets = ticketStats[0]?.open || 0;
                        
                        // Estatísticas VIP
                        db.get(`SELECT COUNT(*) as total FROM vips WHERE guild_id = ?`, [guildId], (err, vipStats) => {
                            stats.totalVips = vipStats?.total || 0;
                            
                            // Estatísticas de verificação
                            db.all(`SELECT 
                                        COUNT(*) as total,
                                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
                                    FROM verifications WHERE guild_id = ?`, [guildId], (err, verificationStats) => {
                                
                                stats.totalVerifications = verificationStats[0]?.total || 0;
                                stats.pendingVerifications = verificationStats[0]?.pending || 0;
                                
                                // Estatísticas de voz
                                db.all(`SELECT 
                                            COUNT(CASE WHEN session_start IS NOT NULL THEN 1 END) as online,
                                            SUM(total_time) as total_time
                                        FROM voice_time WHERE guild_id = ?`, [guildId], (err, voiceStats) => {
                                    
                                    stats.usersInVoice = voiceStats[0]?.online || 0;
                                    stats.totalVoiceTime = formatTimePanel(voiceStats[0]?.total_time || 0);
                                    
                                    resolve(stats);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

function getVipEmojiPanel(type) {
    const emojis = {
        'bronze': '🥉',
        'prata': '🥈',
        'ouro': '🥇',
        'diamante': '💎'
    };
    return emojis[type] || '👑';
}

function formatTimePanel(seconds) {
    if (!seconds || seconds < 0) return '0s';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m`;
    
    return result.trim() || '0m';
}

// Tratamento de erros não capturados
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Login do bot
client.login(config.token);