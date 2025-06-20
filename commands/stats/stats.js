const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

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
                .setDescription('Estatísticas gerais do servidor')),

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
            if (err || rows.length === 0) {
                return interaction.editReply({ content: 'Nenhum dado encontrado!' });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Top Mensagens')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            let description = '';
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const user = await interaction.guild.members.fetch(row.user_id).catch(() => null);
                const userName = user ? user.displayName : 'Usuário não encontrado';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
                
                description += `${medal} **${userName}** - ${row.count.toLocaleString()} mensagens\n`;
            }
            
            embed.setDescription(description);
            embed.setFooter({ text: `Top ${limit} usuários mais ativos` });
            
            await interaction.editReply({ embeds: [embed] });
        });
}

async function voiceStats(interaction, db) {
    const limit = interaction.options.getInteger('limite') || 10;
    
    await interaction.deferReply();
    
    db.all(`SELECT user_id, total_time FROM voice_time 
            WHERE guild_id = ? AND total_time > 0
            ORDER BY total_time DESC 
            LIMIT ?`,
        [interaction.guild.id, limit], async (err, rows) => {
            if (err || rows.length === 0) {
                return interaction.editReply({ content: 'Nenhum dado encontrado!' });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🎙️ Top Tempo de Voz')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            let description = '';
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const user = await interaction.guild.members.fetch(row.user_id).catch(() => null);
                const userName = user ? user.displayName : 'Usuário não encontrado';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
                const time = formatTime(row.total_time);
                
                description += `${medal} **${userName}** - ${time}\n`;
            }
            
            embed.setDescription(description);
            embed.setFooter({ text: `Top ${limit} usuários em call` });
            
            await interaction.editReply({ embeds: [embed] });
        });
}

async function userStats(interaction, db) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    
    await interaction.deferReply();
    
    // Buscar dados de mensagem
    db.get(`SELECT count FROM message_count WHERE user_id = ? AND guild_id = ?`,
        [user.id, interaction.guild.id], async (err, messageData) => {
            
            // Buscar dados de voz
            db.get(`SELECT total_time FROM voice_time WHERE user_id = ? AND guild_id = ?`,
                [user.id, interaction.guild.id], async (err, voiceData) => {
                
                // Buscar VIP
                db.get(`SELECT vip_type, expires_at FROM vips WHERE user_id = ? AND guild_id = ?`,
                    [user.id, interaction.guild.id], async (err, vipData) => {
                    
                    // Buscar ranking de mensagens
                    db.get(`SELECT COUNT(*) + 1 as rank FROM message_count 
                            WHERE guild_id = ? AND count > ?`,
                        [interaction.guild.id, messageData?.count || 0], async (err, msgRank) => {
                        
                        // Buscar ranking de voz
                        db.get(`SELECT COUNT(*) + 1 as rank FROM voice_time 
                                WHERE guild_id = ? AND total_time > ?`,
                            [interaction.guild.id, voiceData?.total_time || 0], async (err, voiceRank) => {
                            
                            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                            
                            const embed = new EmbedBuilder()
                                .setColor(member?.displayHexColor || '#0099ff')
                                .setTitle(`📊 Estatísticas de ${user.displayName}`)
                                .setThumbnail(user.displayAvatarURL({ size: 256 }))
                                .addFields(
                                    {
                                        name: '💬 Mensagens',
                                        value: `**Total:** ${(messageData?.count || 0).toLocaleString()}\n**Ranking:** #${msgRank?.rank || 'N/A'}`,
                                        inline: true
                                    },
                                    {
                                        name: '🎙️ Tempo de Voz',
                                        value: `**Total:** ${formatTime(voiceData?.total_time || 0)}\n**Ranking:** #${voiceRank?.rank || 'N/A'}`,
                                        inline: true
                                    },
                                    {
                                        name: '👑 Status VIP',
                                        value: vipData ? 
                                            `**Tipo:** ${vipData.vip_type.toUpperCase()}\n**Expira:** ${vipData.expires_at ? `<t:${vipData.expires_at}:R>` : 'Permanente'}` :
                                            'Não possui VIP',
                                        inline: true
                                    }
                                )
                                .setFooter({ text: `Membro desde: ${member?.joinedAt?.toLocaleDateString() || 'Desconhecido'}` })
                                .setTimestamp();
                            
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
    
    // Estatísticas gerais
    db.get(`SELECT 
                COUNT(*) as total_users,
                SUM(count) as total_messages 
            FROM message_count WHERE guild_id = ?`,
        [guild.id], async (err, msgStats) => {
        
        db.get(`SELECT 
                    COUNT(*) as voice_users,
                    SUM(total_time) as total_voice_time 
                FROM voice_time WHERE guild_id = ? AND total_time > 0`,
            [guild.id], async (err, voiceStats) => {
            
            db.get(`SELECT COUNT(*) as total_vips FROM vips WHERE guild_id = ?`,
                [guild.id], async (err, vipStats) => {
                
                db.get(`SELECT COUNT(*) as total_tickets FROM tickets WHERE guild_id = ?`,
                    [guild.id], async (err, ticketStats) => {
                    
                    const embed = new EmbedBuilder()
                        .setColor('#4CAF50')
                        .setTitle(`📈 Estatísticas do ${guild.name}`)
                        .setThumbnail(guild.iconURL({ size: 256 }))
                        .addFields(
                            {
                                name: '👥 Membros',
                                value: `**Total:** ${guild.memberCount.toLocaleString()}\n**Online:** ${guild.members.cache.filter(m => m.presence?.status !== 'offline').size.toLocaleString()}\n**Bots:** ${guild.members.cache.filter(m => m.user.bot).size.toLocaleString()}`,
                                inline: true
                            },
                            {
                                name: '💬 Mensagens',
                                value: `**Total:** ${(msgStats?.total_messages || 0).toLocaleString()}\n**Usuários ativos:** ${msgStats?.total_users || 0}`,
                                inline: true
                            },
                            {
                                name: '🎙️ Tempo de Voz',
                                value: `**Total:** ${formatTime(voiceStats?.total_voice_time || 0)}\n**Usuários ativos:** ${voiceStats?.voice_users || 0}`,
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
                                value: `**Total:** ${ticketStats?.total_tickets || 0}`,
                                inline: true
                            }
                        )
                        .setFooter({ text: `Servidor criado em ${guild.createdAt.toLocaleDateString()}` })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                });
            });
        });
    });
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}