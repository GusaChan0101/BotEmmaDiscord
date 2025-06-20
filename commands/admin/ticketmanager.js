const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketmanager')
        .setDescription('Gerenciar tickets avançado (Staff apenas)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Listar todos os tickets ativos')
                .addStringOption(option =>
                    option.setName('filtro')
                        .setDescription('Filtrar por tipo')
                        .addChoices(
                            { name: 'Todos', value: 'all' },
                            { name: 'Suporte', value: 'support' },
                            { name: 'Conselho', value: 'council' },
                            { name: 'Verificação', value: 'verification' }
                        )
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Estatísticas de tickets'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transferir ticket para outro staff')
                .addUserOption(option =>
                    option.setName('staff')
                        .setDescription('Novo responsável pelo ticket')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('priority')
                .setDescription('Definir prioridade do ticket')
                .addStringOption(option =>
                    option.setName('nivel')
                        .setDescription('Nível de prioridade')
                        .addChoices(
                            { name: '🔴 Alta', value: 'high' },
                            { name: '🟡 Média', value: 'medium' },
                            { name: '🟢 Baixa', value: 'low' }
                        )
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('adduser')
                .setDescription('Adicionar usuário ao ticket atual')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para adicionar')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removeuser')
                .setDescription('Remover usuário do ticket atual')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para remover')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        // Verificar permissões de staff
        const hasStaffPermission = await checkStaffPermission(interaction, db);
        if (!hasStaffPermission) {
            return interaction.reply({ content: '❌ Você não tem permissão para gerenciar tickets!', ephemeral: true });
        }

        switch (subcommand) {
            case 'list':
                await listActiveTickets(interaction, db);
                break;
            case 'stats':
                await showTicketStats(interaction, db);
                break;
            case 'transfer':
                await transferTicket(interaction, db);
                break;
            case 'priority':
                await setTicketPriority(interaction, db);
                break;
            case 'adduser':
                await addUserToTicket(interaction, db);
                break;
            case 'removeuser':
                await removeUserFromTicket(interaction, db);
                break;
        }
    },
};

async function checkStaffPermission(interaction, db) {
    if (interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return true;
    }
    
    return new Promise((resolve) => {
        db.get(`SELECT support_role_id, council_role_id FROM guild_settings WHERE guild_id = ?`,
            [interaction.guild.id], (err, settings) => {
                if (settings) {
                    const hasRole = (settings.support_role_id && interaction.member.roles.cache.has(settings.support_role_id)) ||
                                   (settings.council_role_id && interaction.member.roles.cache.has(settings.council_role_id));
                    resolve(hasRole);
                } else {
                    resolve(false);
                }
            });
    });
}

async function listActiveTickets(interaction, db) {
    const filtro = interaction.options.getString('filtro') || 'all';
    
    await interaction.deferReply();
    
    let query = `SELECT t.*, th.handler_id, th.accepted_at 
                 FROM tickets t 
                 LEFT JOIN ticket_handlers th ON t.id = th.ticket_id 
                 WHERE t.guild_id = ? AND t.status = 'open'`;
    
    const params = [interaction.guild.id];
    
    if (filtro !== 'all') {
        query += ` AND t.type = ?`;
        params.push(filtro);
    }
    
    query += ` ORDER BY t.created_at DESC`;
    
    db.all(query, params, async (err, tickets) => {
        if (err || !tickets || tickets.length === 0) {
            return interaction.editReply({ content: '📭 Nenhum ticket ativo encontrado!' });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎫 Tickets Ativos')
            .setTimestamp();
        
        let description = '';
        
        for (const ticket of tickets.slice(0, 15)) {
            const user = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
            const handler = ticket.handler_id ? await interaction.guild.members.fetch(ticket.handler_id).catch(() => null) : null;
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            
            const typeEmoji = {
                'support': '🛠️',
                'council': '🏛️',
                'verification': '🛡️'
            };
            
            description += `${typeEmoji[ticket.type] || '🎫'} **${ticket.ticket_id}**\n`;
            description += `👤 ${user ? user.displayName : 'Usuário não encontrado'}\n`;
            description += `📍 ${channel || 'Canal não encontrado'}\n`;
            description += `⏰ <t:${ticket.created_at}:R>\n`;
            
            if (handler) {
                description += `✋ Atendente: ${handler.displayName}\n`;
            } else {
                description += `❌ Sem atendente\n`;
            }
            
            description += '\n';
        }
        
        embed.setDescription(description);
        
        if (tickets.length > 15) {
            embed.setFooter({ text: `Mostrando 15 de ${tickets.length} tickets` });
        }
        
        await interaction.editReply({ embeds: [embed] });
    });
}

async function showTicketStats(interaction, db) {
    await interaction.deferReply();
    
    // Estatísticas gerais
    db.all(`SELECT 
                COUNT(*) as total_open,
                COUNT(CASE WHEN type = 'support' THEN 1 END) as support_count,
                COUNT(CASE WHEN type = 'council' THEN 1 END) as council_count,
                COUNT(CASE WHEN type = 'verification' THEN 1 END) as verification_count
            FROM tickets 
            WHERE guild_id = ? AND status = 'open'`,
        [interaction.guild.id], async (err, openStats) => {
            
            db.all(`SELECT 
                        COUNT(*) as total_closed,
                        AVG(closed_at - created_at) as avg_resolution_time
                    FROM tickets 
                    WHERE guild_id = ? AND status = 'closed' AND closed_at IS NOT NULL`,
                [interaction.guild.id], async (err, closedStats) => {
                    
                    // Tickets aceitos hoje
                    const today = Math.floor(Date.now() / 1000) - 86400;
                    db.get(`SELECT COUNT(*) as accepted_today 
                            FROM ticket_handlers th
                            JOIN tickets t ON th.ticket_id = t.id
                            WHERE t.guild_id = ? AND th.accepted_at > ?`,
                        [interaction.guild.id, today], async (err, todayStats) => {
                            
                            const open = openStats[0];
                            const closed = closedStats[0];
                            const todayData = todayStats;
                            
                            const embed = new EmbedBuilder()
                                .setColor('#9932cc')
                                .setTitle('📊 Estatísticas de Tickets')
                                .setThumbnail(interaction.guild.iconURL())
                                .setTimestamp();
                            
                            let description = `**🎫 Tickets Abertos:** ${open.total_open}\n`;
                            description += `• 🛠️ Suporte: ${open.support_count}\n`;
                            description += `• 🏛️ Conselho: ${open.council_count}\n`;
                            description += `• 🛡️ Verificação: ${open.verification_count}\n\n`;
                            
                            description += `**📈 Estatísticas Gerais:**\n`;
                            description += `• ✅ Tickets fechados: ${closed.total_closed || 0}\n`;
                            description += `• ⏱️ Tempo médio de resolução: ${formatTime(closed.avg_resolution_time || 0)}\n`;
                            description += `• 📅 Aceitos hoje: ${todayData.accepted_today || 0}\n`;
                            
                            embed.setDescription(description);
                            
                            await interaction.editReply({ embeds: [embed] });
                        });
                });
        });
}

async function transferTicket(interaction, db) {
    const newStaff = interaction.options.getUser('staff');
    
    // Verificar se está em um ticket
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [interaction.channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: '❌ Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            // Verificar se o novo staff tem permissão
            const member = await interaction.guild.members.fetch(newStaff.id).catch(() => null);
            if (!member) {
                return interaction.reply({ content: '❌ Usuário não encontrado no servidor!', ephemeral: true });
            }
            
            const hasPermission = await checkStaffPermission({ member, guild: interaction.guild }, db);
            if (!hasPermission) {
                return interaction.reply({ content: '❌ O usuário especificado não tem permissão para atender tickets!', ephemeral: true });
            }
            
            // Transferir ticket
            db.run(`INSERT OR REPLACE INTO ticket_handlers (ticket_id, handler_id) VALUES (?, ?)`,
                [ticket.id, newStaff.id], async function(err) {
                    if (err) {
                        return interaction.reply({ content: 'Erro ao transferir ticket!', ephemeral: true });
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor('#ffa500')
                        .setTitle('🔄 Ticket Transferido')
                        .setDescription(`**De:** ${interaction.user}\n**Para:** ${newStaff}\n**Ticket:** ${ticket.ticket_id}\n\n✅ Transferência realizada com sucesso!`)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed] });
                    
                    // Notificar novo staff por DM
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setColor('#0099ff')
                            .setTitle('🎫 Ticket transferido para você')
                            .setDescription(`Um ticket foi transferido para você em **${interaction.guild.name}**.\n\n**Canal:** ${interaction.channel}\n**Transferido por:** ${interaction.user}`)
                            .setTimestamp();
                        
                        await newStaff.send({ embeds: [dmEmbed] });
                    } catch (error) {
                        // Usuário pode ter DMs desabilitadas
                    }
                });
        });
}

async function setTicketPriority(interaction, db) {
    const nivel = interaction.options.getString('nivel');
    
    // Verificar se está em um ticket
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [interaction.channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: '❌ Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            // Criar tabela de prioridades se não existir
            db.run(`CREATE TABLE IF NOT EXISTS ticket_priorities (
                ticket_id INTEGER PRIMARY KEY,
                priority TEXT NOT NULL,
                set_by TEXT NOT NULL,
                set_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY(ticket_id) REFERENCES tickets(id)
            )`);
            
            // Definir prioridade
            db.run(`INSERT OR REPLACE INTO ticket_priorities (ticket_id, priority, set_by) VALUES (?, ?, ?)`,
                [ticket.id, nivel, interaction.user.id], async function(err) {
                    if (err) {
                        return interaction.reply({ content: 'Erro ao definir prioridade!', ephemeral: true });
                    }
                    
                    const priorityEmojis = {
                        'high': '🔴',
                        'medium': '🟡',
                        'low': '🟢'
                    };
                    
                    const priorityNames = {
                        'high': 'Alta',
                        'medium': 'Média',
                        'low': 'Baixa'
                    };
                    
                    // Atualizar nome do canal para incluir prioridade
                    const newChannelName = `${priorityEmojis[nivel]}-${ticket.ticket_id}`;
                    try {
                        await interaction.channel.setName(newChannelName);
                    } catch (error) {
                        // Pode falhar por rate limit, não é crítico
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor(nivel === 'high' ? '#ff0000' : nivel === 'medium' ? '#ffff00' : '#00ff00')
                        .setTitle('⚡ Prioridade Definida')
                        .setDescription(`**Ticket:** ${ticket.ticket_id}\n**Prioridade:** ${priorityEmojis[nivel]} ${priorityNames[nivel]}\n**Definido por:** ${interaction.user}`)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed] });
                });
        });
}

async function addUserToTicket(interaction, db) {
    const user = interaction.options.getUser('usuario');
    
    // Verificar se está em um ticket
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [interaction.channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: '❌ Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            try {
                // Adicionar permissões ao usuário
                await interaction.channel.permissionOverwrites.create(user, {
                    ViewChannel: true,
                    SendMessages: true
                });
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('➕ Usuário Adicionado')
                    .setDescription(`${user} foi adicionado ao ticket!\n\n**Adicionado por:** ${interaction.user}`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                
                // Notificar usuário por DM
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🎫 Você foi adicionado a um ticket')
                        .setDescription(`Você foi adicionado a um ticket em **${interaction.guild.name}**.\n\n**Canal:** ${interaction.channel}`)
                        .setTimestamp();
                    
                    await user.send({ embeds: [dmEmbed] });
                } catch (error) {
                    // Usuário pode ter DMs desabilitadas
                }
                
            } catch (error) {
                await interaction.reply({ content: 'Erro ao adicionar usuário!', ephemeral: true });
            }
        });
}

async function removeUserFromTicket(interaction, db) {
    const user = interaction.options.getUser('usuario');
    
    // Verificar se está em um ticket
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [interaction.channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: '❌ Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            // Não permitir remover o criador do ticket
            if (user.id === ticket.user_id) {
                return interaction.reply({ content: '❌ Não é possível remover o criador do ticket!', ephemeral: true });
            }
            
            try {
                // Remover permissões do usuário
                await interaction.channel.permissionOverwrites.delete(user);
                
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('➖ Usuário Removido')
                    .setDescription(`${user} foi removido do ticket!\n\n**Removido por:** ${interaction.user}`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                
            } catch (error) {
                await interaction.reply({ content: 'Erro ao remover usuário!', ephemeral: true });
            }
        });
}

function formatTime(seconds) {
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