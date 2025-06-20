const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempo')
        .setDescription('Sistema de tempo em calls de voz')
        .addSubcommand(subcommand =>
            subcommand
                .setName('usuario')
                .setDescription('Ver tempo de um usuário específico')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para verificar')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ranking')
                .setDescription('Ver ranking de tempo em calls')
                .addIntegerOption(option =>
                    option.setName('posicoes')
                        .setDescription('Número de posições a mostrar (padrão: 10)')
                        .setMinValue(5)
                        .setMaxValue(25)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Resetar tempo de um usuário ou todos')
                .addBooleanOption(option =>
                    option.setName('confirmar')
                        .setDescription('Confirmar reset (ATENÇÃO: Ação irreversível!)')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para resetar (deixe vazio para resetar todos)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Estatísticas gerais do servidor'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ativos')
                .setDescription('Ver quem está atualmente em calls')),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'usuario':
                await showUserTime(interaction, db);
                break;
            case 'ranking':
                await showRanking(interaction, db);
                break;
            case 'reset':
                await resetTime(interaction, db);
                break;
            case 'stats':
                await showStats(interaction, db);
                break;
            case 'ativos':
                await showActiveUsers(interaction, db);
                break;
        }
    },
};

async function showUserTime(interaction, db) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    const now = Math.floor(Date.now() / 1000);
    
    db.get(`SELECT * FROM voice_time WHERE user_id = ? AND guild_id = ?`,
        [user.id, interaction.guild.id], async (err, result) => {
            
            let totalTime = 0;
            let sessionTime = 0;
            let isOnline = false;
            
            if (result) {
                totalTime = result.total_time;
                
                // Se está em sessão ativa, calcular tempo atual
                if (result.session_start) {
                    sessionTime = now - result.session_start;
                    totalTime += sessionTime;
                    isOnline = true;
                }
            }
            
            // Buscar posição no ranking
            db.all(`SELECT user_id, 
                           CASE 
                               WHEN session_start IS NOT NULL 
                               THEN total_time + (? - session_start)
                               ELSE total_time
                           END as final_time
                    FROM voice_time 
                    WHERE guild_id = ? AND final_time > 0
                    ORDER BY final_time DESC`,
                [now, interaction.guild.id], async (err, ranking) => {
                    
                    let position = 0;
                    if (ranking) {
                        position = ranking.findIndex(r => r.user_id === user.id) + 1;
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor(isOnline ? '#00ff00' : '#0099ff')
                        .setTitle(`🎤 Tempo em Calls - ${user.displayName}`)
                        .setThumbnail(user.displayAvatarURL())
                        .setTimestamp();
                    
                    let description = `**👤 Usuário:** ${user}\n`;
                    description += `**⏰ Tempo total:** ${formatTime(totalTime)}\n`;
                    description += `**📊 Posição no ranking:** ${position > 0 ? `#${position}` : 'Não ranqueado'}\n`;
                    
                    if (isOnline) {
                        description += `**🔴 Status:** Online em call\n`;
                        description += `**⏱️ Sessão atual:** ${formatTime(sessionTime)}\n`;
                        
                        // Buscar canal atual
                        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                        if (member && member.voice.channel) {
                            description += `**📍 Canal:** ${member.voice.channel}\n`;
                        }
                    } else {
                        description += `**🔘 Status:** Offline\n`;
                    }
                    
                    // Adicionar estatísticas extras se tiver tempo
                    if (totalTime > 0) {
                        const days = Math.floor(totalTime / 86400);
                        const hours = Math.floor((totalTime % 86400) / 3600);
                        const minutes = Math.floor((totalTime % 3600) / 60);
                        
                        description += `\n**📈 Detalhes:**\n`;
                        description += `• ${days} dias, ${hours} horas, ${minutes} minutos\n`;
                        description += `• Média diária: ${formatTime(Math.floor(totalTime / Math.max(days || 1, 1)))}\n`;
                    }
                    
                    embed.setDescription(description);
                    
                    await interaction.reply({ embeds: [embed] });
                });
        });
}

async function showRanking(interaction, db) {
    const posicoes = interaction.options.getInteger('posicoes') || 10;
    const now = Math.floor(Date.now() / 1000);
    
    await interaction.deferReply();
    
    db.all(`SELECT user_id, 
                   total_time,
                   session_start,
                   CASE 
                       WHEN session_start IS NOT NULL 
                       THEN total_time + (? - session_start)
                       ELSE total_time
                   END as final_time
            FROM voice_time 
            WHERE guild_id = ? AND final_time > 0
            ORDER BY final_time DESC 
            LIMIT ?`,
        [now, interaction.guild.id, posicoes], async (err, results) => {
            
            if (err || !results || results.length === 0) {
                return interaction.editReply({ content: '❌ Nenhum dados de tempo encontrado!' });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('🏆 Ranking de Tempo em Calls')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            let description = '';
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const user = await interaction.guild.members.fetch(result.user_id).catch(() => null);
                const userName = user ? user.displayName : 'Usuário não encontrado';
                
                const position = i + 1;
                const emoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🔹';
                const statusEmoji = result.session_start ? '🔴' : '🔘';
                
                description += `${emoji} **#${position}** ${statusEmoji} **${userName}**\n`;
                description += `⏰ ${formatTime(result.final_time)}\n\n`;
            }
            
            embed.setDescription(description);
            embed.setFooter({ text: `🔴 = Online | 🔘 = Offline | Mostrando top ${results.length}` });
            
            await interaction.editReply({ embeds: [embed] });
        });
}

async function resetTime(interaction, db) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Apenas administradores podem resetar tempos!', ephemeral: true });
    }
    
    const user = interaction.options.getUser('usuario');
    const confirmar = interaction.options.getBoolean('confirmar');
    
    if (!confirmar) {
        return interaction.reply({ content: '❌ Você deve confirmar a ação marcando "confirmar" como verdadeiro!', ephemeral: true });
    }
    
    if (user) {
        // Reset de usuário específico
        db.run(`DELETE FROM voice_time WHERE user_id = ? AND guild_id = ?`,
            [user.id, interaction.guild.id], function(err) {
                if (err) {
                    return interaction.reply({ content: 'Erro ao resetar tempo do usuário!', ephemeral: true });
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#ff6600')
                    .setTitle('🔄 Tempo Resetado')
                    .setDescription(`Tempo de ${user} foi resetado para zero.`)
                    .setTimestamp();
                
                interaction.reply({ embeds: [embed] });
            });
    } else {
        // Reset de todos os usuários
        db.run(`DELETE FROM voice_time WHERE guild_id = ?`,
            [interaction.guild.id], function(err) {
                if (err) {
                    return interaction.reply({ content: 'Erro ao resetar tempos!', ephemeral: true });
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#ff6600')
                    .setTitle('🔄 Todos os Tempos Resetados')
                    .setDescription(`Todos os tempos de call foram resetados para zero.\n\n⚠️ **Ação irreversível realizada por ${interaction.user}**`)
                    .setTimestamp();
                
                interaction.reply({ embeds: [embed] });
            });
    }
}

async function showStats(interaction, db) {
    const now = Math.floor(Date.now() / 1000);
    
    await interaction.deferReply();
    
    // Estatísticas gerais
    db.all(`SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN session_start IS NOT NULL THEN 1 END) as online_users,
                SUM(CASE 
                    WHEN session_start IS NOT NULL 
                    THEN total_time + (? - session_start)
                    ELSE total_time
                END) as total_time,
                AVG(CASE 
                    WHEN session_start IS NOT NULL 
                    THEN total_time + (? - session_start)
                    ELSE total_time
                END) as avg_time,
                MAX(CASE 
                    WHEN session_start IS NOT NULL 
                    THEN total_time + (? - session_start)
                    ELSE total_time
                END) as max_time
            FROM voice_time 
            WHERE guild_id = ? AND total_time > 0`,
        [now, now, now, interaction.guild.id], async (err, stats) => {
            
            const stat = stats[0];
            
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('📊 Estatísticas do Servidor')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            let description = '';
            description += `**👥 Total de usuários registrados:** ${stat.total_users || 0}\n`;
            description += `**🔴 Usuários online em calls:** ${stat.online_users || 0}\n`;
            description += `**⏰ Tempo total acumulado:** ${formatTime(stat.total_time || 0)}\n`;
            description += `**📈 Tempo médio por usuário:** ${formatTime(stat.avg_time || 0)}\n`;
            description += `**🏆 Maior tempo individual:** ${formatTime(stat.max_time || 0)}\n`;
            
            // Calcular usuários ativos nas últimas 24h
            const yesterday = now - 86400;
            db.get(`SELECT COUNT(*) as active_today 
                    FROM voice_time 
                    WHERE guild_id = ? AND session_start > ?`,
                [interaction.guild.id, yesterday], (err, todayStats) => {
                    
                    description += `**📅 Ativos hoje:** ${todayStats?.active_today || 0} usuários\n`;
                    
                    embed.setDescription(description);
                    interaction.editReply({ embeds: [embed] });
                });
        });
}

async function showActiveUsers(interaction, db) {
    const now = Math.floor(Date.now() / 1000);
    
    db.all(`SELECT user_id, session_start, total_time 
            FROM voice_time 
            WHERE guild_id = ? AND session_start IS NOT NULL 
            ORDER BY session_start ASC`,
        [interaction.guild.id], async (err, activeUsers) => {
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔴 Usuários Ativos em Calls')
                .setTimestamp();
            
            if (!activeUsers || activeUsers.length === 0) {
                embed.setDescription('😴 Nenhum usuário está atualmente em calls de voz.');
                return interaction.reply({ embeds: [embed] });
            }
            
            let description = '';
            
            for (const activeUser of activeUsers) {
                const user = await interaction.guild.members.fetch(activeUser.user_id).catch(() => null);
                if (user) {
                    const sessionTime = now - activeUser.session_start;
                    const totalTime = activeUser.total_time + sessionTime;
                    
                    description += `🔴 **${user.displayName}**\n`;
                    description += `⏱️ Sessão atual: ${formatTime(sessionTime)}\n`;
                    description += `⏰ Tempo total: ${formatTime(totalTime)}\n`;
                    
                    // Mostrar canal se possível
                    if (user.voice.channel) {
                        description += `📍 Canal: ${user.voice.channel}\n`;
                    }
                    
                    description += '\n';
                }
            }
            
            embed.setDescription(description);
            embed.setFooter({ text: `${activeUsers.length} usuário(s) ativo(s)` });
            
            await interaction.reply({ embeds: [embed] });
        });
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