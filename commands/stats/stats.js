const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Visualizar estatísticas do servidor')
        .addSubcommand(subcommand =>
            subcommand
                .setName('messages')
                .setDescription('Top usuários por mensagens')
                .addIntegerOption(option =>
                    option.setName('limite')
                        .setDescription('Número de usuários (1-20)')
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('Top usuários por tempo de voz')
                .addIntegerOption(option =>
                    option.setName('limite')
                        .setDescription('Número de usuários (1-20)')
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Estatísticas de um usuário específico')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para verificar')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('server')
                .setDescription('Estatísticas gerais do servidor'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('activity')
                .setDescription('Atividade recente do servidor')),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'messages':
                await messageStats(interaction, db);
                break;
            case 'voice':
                await voiceStats(interaction, db);
                break;
            case 'user':
                await userStats(interaction, db);
                break;
            case 'server':
                await serverStats(interaction, db);
                break;
            case 'activity':
                await activityStats(interaction, db);
                break;
        }
    },
};

async function messageStats(interaction, db) {
    const limit = interaction.options.getInteger('limite') || 10;
    
    await interaction.deferReply();
    
    db.all(`SELECT user_id, count FROM message_count 
            WHERE guild_id = ? 
            ORDER BY count DESC 
            LIMIT ?`,
        [interaction.guild.id, limit], async (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return interaction.editReply({ content: '❌ Nenhum dado de mensagens encontrado!' });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Top Mensagens')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            let description = '';
            let totalMessages = 0;
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const user = await interaction.guild.members.fetch(row.user_id).catch(() => null);
                const userName = user ? user.displayName : 'Usuário não encontrado';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
                
                description += `${medal} **${userName}** - ${row.count.toLocaleString()} mensagens\n`;
                totalMessages += row.count;
            }
            
            embed.setDescription(description);
            embed.addFields({
                name: '📈 Total Registrado',
                value: `${totalMessages.toLocaleString()} mensagens`,
                inline: true
            });
            embed.setFooter({ text: `Top ${limit} usuários mais ativos em mensagens` });
            
            await interaction.editReply({ embeds: [embed] });
        });
}

async function voiceStats(interaction, db) {
    const limit = interaction.options.getInteger('limite') || 10;
    const now = Math.floor(Date.now() / 1000);
    
    await interaction.deferReply();
    
    db.all(`SELECT user_id, 
                   total_time,
                   session_start,
                   sessions,
                   CASE 
                       WHEN session_start IS NOT NULL 
                       THEN total_time + (? - session_start)
                       ELSE total_time
                   END as final_time
            FROM voice_time 
            WHERE guild_id = ? AND final_time > 0
            ORDER BY final_time DESC 
            LIMIT ?`,
        [now, interaction.guild.id, limit], async (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return interaction.editReply({ content: '❌ Nenhum dado de tempo de voz encontrado!' });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🎙️ Top Tempo de Voz')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            let description = '';
            let totalTime = 0;
            let totalSessions = 0;
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const user = await interaction.guild.members.fetch(row.user_id).catch(() => null);
                const userName = user ? user.displayName : 'Usuário não encontrado';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
                const time = formatTime(row.final_time);
                const statusEmoji = row.session_start ? '🔴' : '🔘';
                
                description += `${medal} ${statusEmoji} **${userName}** - ${time}\n`;
                totalTime += row.final_time;
                totalSessions += row.sessions || 0;
            }
            
            embed.setDescription(description);
            embed.addFields(
                {
                    name: '⏰ Tempo Total',
                    value: formatTime(totalTime),
                    inline: true
                },
                {
                    name: '🎯 Sessões Totais',
                    value: totalSessions.toLocaleString(),
                    inline: true
                },
                {
                    name: '📊 Média por Usuário',
                    value: formatTime(Math.floor(totalTime / rows.length)),
                    inline: true
                }
            );
            embed.setFooter({ text: `🔴 = Online | 🔘 = Offline | Top ${limit} usuários` });
            
            await interaction.editReply({ embeds: [embed] });
        });
}

async function userStats(interaction, db) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    const now = Math.floor(Date.now() / 1000);
    
    await interaction.deferReply();
    
    // Buscar dados de mensagem
    db.get(`SELECT count FROM message_count WHERE user_id = ? AND guild_id = ?`,
        [user.id, interaction.guild.id], async (err, messageData) => {
            
            // Buscar dados de voz
            db.get(`SELECT total_time, session_start, sessions FROM voice_time WHERE user_id = ? AND guild_id = ?`,
                [user.id, interaction.guild.id], async (err, voiceData) => {
                
                // Buscar VIP
                db.get(`SELECT vip_type, expires_at FROM vips WHERE user_id = ? AND guild_id = ?`,
                    [user.id, interaction.guild.id], async (err, vipData) => {
                    
                    // Buscar ranking de mensagens
                    db.get(`SELECT COUNT(*) + 1 as rank FROM message_count 
                            WHERE guild_id = ? AND count > ?`,
                        [interaction.guild.id, messageData?.count || 0], async (err, msgRank) => {
                        
                        // Buscar ranking de voz
                        const voiceTime = voiceData ? 
                            (voiceData.session_start ? voiceData.total_time + (now - voiceData.session_start) : voiceData.total_time) : 0;
                        
                        db.get(`SELECT COUNT(*) + 1 as rank FROM voice_time 
                                WHERE guild_id = ? AND 
                                CASE 
                                    WHEN session_start IS NOT NULL 
                                    THEN total_time + (? - session_start)
                                    ELSE total_time
                                END > ?`,
                            [interaction.guild.id, now, voiceTime], async (err, voiceRank) => {
                            
                            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                            
                            const embed = new EmbedBuilder()
                                .setColor(member?.displayHexColor || '#0099ff')
                                .setTitle(`📊 Estatísticas de ${user.displayName}`)
                                .setThumbnail(user.displayAvatarURL({ size: 256 }))
                                .setTimestamp();
                            
                            let description = `**👤 Usuário:** ${user}\n`;
                            
                            // Status de voz
                            if (voiceData?.session_start) {
                                description += `**🔴 Status:** Online em call\n`;
                                description += `**⏱️ Sessão atual:** ${formatTime(now - voiceData.session_start)}\n`;
                            } else {
                                description += `**🔘 Status:** Offline\n`;
                            }
                            
                            description += '\n';
                            
                            embed.setDescription(description);
                            
                            embed.addFields(
                                {
                                    name: '💬 Mensagens',
                                    value: `**Total:** ${(messageData?.count || 0).toLocaleString()}\n**Ranking:** #${msgRank?.rank || 'N/A'}`,
                                    inline: true
                                },
                                {
                                    name: '🎙️ Tempo de Voz',
                                    value: `**Total:** ${formatTime(voiceTime)}\n**Ranking:** #${voiceRank?.rank || 'N/A'}\n**Sessões:** ${voiceData?.sessions || 0}`,
                                    inline: true
                                },
                                {
                                    name: '👑 Status VIP',
                                    value: vipData ? 
                                        `**Tipo:** ${vipData.vip_type.toUpperCase()}\n**Expira:** ${vipData.expires_at ? `<t:${vipData.expires_at}:R>` : 'Permanente'}` :
                                        'Não possui VIP',
                                    inline: true
                                }
                            );
                            
                            if (member) {
                                embed.setFooter({ 
                                    text: `Entrou no servidor: ${member.joinedAt?.toLocaleDateString() || 'Desconhecido'}` 
                                });
                            }
                            
                            await interaction.editReply({ embeds: [embed] });
                        });
                    });
                });
            });
        });
}

async function serverStats(interaction, db) {
    await interaction.deferReply();
    
    const guild = interaction.guild;
    
    // Estatísticas de mensagens
    db.get(`SELECT 
                COUNT(*) as active_users,
                SUM(count) as total_messages 
            FROM message_count WHERE guild_id = ?`,
        [guild.id], async (err, msgStats) => {
        
        // Estatísticas de voz
        const now = Math.floor(Date.now() / 1000);
        db.get(`SELECT 
                    COUNT(*) as voice_users,
                    SUM(CASE 
                        WHEN session_start IS NOT NULL 
                        THEN total_time + (? - session_start)
                        ELSE total_time
                    END) as total_voice_time,
                    COUNT(CASE WHEN session_start IS NOT NULL THEN 1 END) as online_users
                FROM voice_time WHERE guild_id = ? AND total_time > 0`,
            [now, guild.id], async (err, voiceStats) => {
            
            // Estatísticas VIP
            db.get(`SELECT COUNT(*) as total_vips FROM vips WHERE guild_id = ?`,
                [guild.id], async (err, vipStats) => {
                
                // Estatísticas de tickets
                db.get(`SELECT 
                            COUNT(*) as total_tickets,
                            COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets
                        FROM tickets WHERE guild_id = ?`,
                    [guild.id], async (err, ticketStats) => {
                    
                    const embed = new EmbedBuilder()
                        .setColor('#4CAF50')
                        .setTitle(`📈 Estatísticas do ${guild.name}`)
                        .setThumbnail(guild.iconURL({ size: 256 }))
                        .setTimestamp();
                    
                    const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
                    const bots = guild.members.cache.filter(m => m.user.bot).size;
                    
                    embed.addFields(
                        {
                            name: '👥 Membros',
                            value: `**Total:** ${guild.memberCount.toLocaleString()}\n**Online:** ${onlineMembers.toLocaleString()}\n**Bots:** ${bots.toLocaleString()}`,
                            inline: true
                        },
                        {
                            name: '💬 Mensagens',
                            value: `**Total:** ${(msgStats?.total_messages || 0).toLocaleString()}\n**Usuários ativos:** ${msgStats?.active_users || 0}`,
                            inline: true
                        },
                        {
                            name: '🎙️ Tempo de Voz',
                            value: `**Total:** ${formatTime(voiceStats?.total_voice_time || 0)}\n**Usuários ativos:** ${voiceStats?.voice_users || 0}\n**Online agora:** ${voiceStats?.online_users || 0}`,
                            inline: true
                        },
                        {
                            name: '📁 Canais',
                            value: `**Texto:** ${guild.channels.cache.filter(c => c.type === 0).size}\n**Voz:** ${guild.channels.cache.filter(c => c.type === 2).size}\n**Categorias:** ${guild.channels.cache.filter(c => c.type === 4).size}`,
                            inline: true
                        },
                        {
                            name: '👑 VIPs',
                            value: `**Total:** ${vipStats?.total_vips || 0}`,
                            inline: true
                        },
                        {
                            name: '🎫 Tickets',
                            value: `**Total:** ${ticketStats?.total_tickets || 0}\n**Abertos:** ${ticketStats?.open_tickets || 0}`,
                            inline: true
                        }
                    );
                    
                    embed.setFooter({ 
                        text: `Servidor criado em ${guild.createdAt.toLocaleDateString()}` 
                    });
                    
                    await interaction.editReply({ embeds: [embed] });
                });
            });
        });
    });
}

async function activityStats(interaction, db) {
    await interaction.deferReply();
    
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - (7 * 86400);
    
    // Estatísticas de atividade
    db.all(`SELECT 
                (SELECT COUNT(*) FROM message_count WHERE guild_id = ? AND last_message > ?) as active_today,
                (SELECT COUNT(*) FROM message_count WHERE guild_id = ? AND last_message > ?) as active_week,
                (SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND created_at > ?) as tickets_today,
                (SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND created_at > ?) as tickets_week`,
        [
            interaction.guild.id, oneDayAgo,
            interaction.guild.id, oneWeekAgo,
            interaction.guild.id, oneDayAgo,
            interaction.guild.id, oneWeekAgo
        ], async (err, stats) => {
            
            const data = stats[0] || {};
            
            // Usuários em calls agora
            const voiceChannels = interaction.guild.channels.cache.filter(c => c.type === 2);
            let currentVoiceUsers = 0;
            let channelInfo = '';
            
            voiceChannels.forEach(channel => {
                if (channel.members.size > 0) {
                    currentVoiceUsers += channel.members.size;
                    channelInfo += `• **${channel.name}:** ${channel.members.size} usuários\n`;
                }
            });
            
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('📊 Atividade Recente')
                .addFields(
                    {
                        name: '💬 Mensagens',
                        value: `**Hoje:** ${data.active_today || 0} usuários ativos\n**Esta semana:** ${data.active_week || 0} usuários ativos`,
                        inline: true
                    },
                    {
                        name: '🎫 Tickets',
                        value: `**Hoje:** ${data.tickets_today || 0} criados\n**Esta semana:** ${data.tickets_week || 0} criados`,
                        inline: true
                    },
                    {
                        name: '🎤 Calls Agora',
                        value: `**Usuários em call:** ${currentVoiceUsers}\n**Canais ativos:** ${channelInfo ? voiceChannels.filter(c => c.members.size > 0).size : 0}`,
                        inline: true
                    }
                )
                .setTimestamp();
            
            if (channelInfo) {
                embed.addFields({
                    name: '🔴 Canais de Voz Ativos',
                    value: channelInfo,
                    inline: false
                });
            }
            
            await interaction.editReply({ embeds: [embed] });
        });
}

function formatTime(seconds) {
    if (!seconds || seconds < 0) return '0s';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}