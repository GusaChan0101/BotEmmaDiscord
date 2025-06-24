const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Comandos de debug (Admin apenas)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('Debug do sistema de tempo de voz'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addtime')
                .setDescription('Adicionar tempo manual para teste')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('segundos')
                        .setDescription('Segundos para adicionar')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('database')
                .setDescription('Verificar status do banco de dados'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('Limpar dados órfãos do banco'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fix')
                .setDescription('Corrigir usuários em call sem registro'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, db) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Apenas administradores podem usar comandos de debug!', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'voice':
                await debugVoice(interaction, db);
                break;
            case 'addtime':
                await addTestTime(interaction, db);
                break;
            case 'database':
                await checkDatabase(interaction, db);
                break;
            case 'cleanup':
                await cleanupDatabase(interaction, db);
                break;
            case 'fix':
                await fixVoiceUsers(interaction, db);
                break;
        }
    },
};

async function debugVoice(interaction, db) {
    await interaction.deferReply({ ephemeral: true });
    
    // Verificar todos os registros de voice_time
    db.all(`SELECT * FROM voice_time WHERE guild_id = ?`, [interaction.guild.id], async (err, results) => {
        if (err) {
            return interaction.editReply({ content: `❌ Erro: ${err.message}` });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🔧 Debug - Sistema de Voz')
            .setTimestamp();
        
        if (!results || results.length === 0) {
            embed.setDescription('❌ Nenhum registro encontrado na tabela voice_time');
        } else {
            let description = `**Total de registros:** ${results.length}\n\n`;
            
            for (const result of results.slice(0, 10)) {
                const user = await interaction.guild.members.fetch(result.user_id).catch(() => null);
                const userName = user ? user.displayName : `ID: ${result.user_id}`;
                
                description += `**${userName}:**\n`;
                description += `• Total: ${result.total_time}s (${formatTime(result.total_time)})\n`;
                description += `• Sessão: ${result.session_start ? `Ativa desde <t:${result.session_start}:R>` : 'Inativa'}\n`;
                description += `• Sessões totais: ${result.sessions || 0}\n`;
                description += `• Criado: <t:${result.created_at}:R>\n\n`;
            }
            
            if (results.length > 10) {
                description += `... e mais ${results.length - 10} registros`;
            }
            
            embed.setDescription(description);
        }
        
        // Verificar usuários atualmente em calls
        const voiceChannels = interaction.guild.channels.cache.filter(c => c.type === 2);
        let activeUsers = [];
        
        voiceChannels.forEach(channel => {
            channel.members.forEach(member => {
                if (!member.user.bot) {
                    activeUsers.push({
                        user: member.displayName,
                        channel: channel.name,
                        id: member.id
                    });
                }
            });
        });
        
        if (activeUsers.length > 0) {
            embed.addFields({
                name: '🔴 Usuários atualmente em calls',
                value: activeUsers.map(u => `• ${u.user} em **${u.channel}**`).join('\n'),
                inline: false
            });
        } else {
            embed.addFields({
                name: '🔴 Usuários em calls',
                value: 'Nenhum usuário em calls no momento',
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
    });
}

async function addTestTime(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const seconds = interaction.options.getInteger('segundos');
    
    if (seconds <= 0) {
        return interaction.reply({ content: '❌ O tempo deve ser maior que 0!', ephemeral: true });
    }
    
    // Primeiro garantir que o usuário existe na tabela
    db.run(`INSERT OR IGNORE INTO voice_time (user_id, guild_id, total_time, sessions) VALUES (?, ?, 0, 0)`,
        [user.id, interaction.guild.id]);
    
    // Depois adicionar o tempo
    db.run(`UPDATE voice_time SET total_time = total_time + ? WHERE user_id = ? AND guild_id = ?`,
        [seconds, user.id, interaction.guild.id], function(err) {
            if (err) {
                return interaction.reply({ content: `❌ Erro: ${err.message}`, ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Tempo Adicionado')
                .setDescription(`Adicionado **${formatTime(seconds)}** para ${user}\n\n**Uso:** Este comando é apenas para testes e debug.`)
                .setTimestamp();
            
            interaction.reply({ embeds: [embed], ephemeral: true });
        });
}

async function checkDatabase(interaction, db) {
    await interaction.deferReply({ ephemeral: true });
    
    const tables = [
        'guild_settings',
        'voice_time', 
        'vips',
        'tickets',
        'verifications',
        'warnings',
        'message_count',
        'user_levels'
    ];
    
    let tableStatus = [];
    let completed = 0;
    
    for (const table of tables) {
        db.get(`SELECT COUNT(*) as count FROM ${table} WHERE guild_id = ?`, [interaction.guild.id], (err, result) => {
            if (err) {
                tableStatus.push(`❌ **${table}:** Erro - ${err.message}`);
            } else {
                tableStatus.push(`✅ **${table}:** ${result.count} registros`);
            }
            
            completed++;
            
            if (completed === tables.length) {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🗃️ Status do Banco de Dados')
                    .setDescription(tableStatus.join('\n'))
                    .setTimestamp();
                
                // Verificar integridade
                db.get(`PRAGMA integrity_check`, (err, integrity) => {
                    if (integrity && integrity['integrity_check'] === 'ok') {
                        embed.addFields({
                            name: '🔍 Integridade',
                            value: '✅ Banco de dados íntegro',
                            inline: false
                        });
                    } else {
                        embed.addFields({
                            name: '🔍 Integridade',
                            value: '⚠️ Possíveis problemas detectados',
                            inline: false
                        });
                    }
                    
                    interaction.editReply({ embeds: [embed] });
                });
            }
        });
    }
}

async function cleanupDatabase(interaction, db) {
    await interaction.deferReply({ ephemeral: true });
    
    let cleanupResults = [];
    
    // Limpar dados de usuários que não estão mais no servidor
    const memberIds = interaction.guild.members.cache.map(m => m.id);
    
    if (memberIds.length === 0) {
        return interaction.editReply({ content: '❌ Erro ao obter lista de membros!' });
    }
    
    const placeholders = memberIds.map(() => '?').join(',');
    
    // Limpar voice_time
    db.run(`DELETE FROM voice_time WHERE guild_id = ? AND user_id NOT IN (${placeholders})`,
        [interaction.guild.id, ...memberIds], function(err) {
            cleanupResults.push(`🎤 Voice Time: ${this.changes || 0} registros removidos`);
            
            // Limpar message_count
            db.run(`DELETE FROM message_count WHERE guild_id = ? AND user_id NOT IN (${placeholders})`,
                [interaction.guild.id, ...memberIds], function(err) {
                    cleanupResults.push(`💬 Message Count: ${this.changes || 0} registros removidos`);
                    
                    // Limpar user_levels
                    db.run(`DELETE FROM user_levels WHERE guild_id = ? AND user_id NOT IN (${placeholders})`,
                        [interaction.guild.id, ...memberIds], function(err) {
                            cleanupResults.push(`📊 User Levels: ${this.changes || 0} registros removidos`);
                            
                            // Limpar VIPs expirados
                            const now = Math.floor(Date.now() / 1000);
                            db.run(`DELETE FROM vips WHERE guild_id = ? AND expires_at IS NOT NULL AND expires_at < ?`,
                                [interaction.guild.id, now], function(err) {
                                    cleanupResults.push(`👑 VIPs Expirados: ${this.changes || 0} registros removidos`);
                                    
                                    const embed = new EmbedBuilder()
                                        .setColor('#00ff00')
                                        .setTitle('🧹 Limpeza Concluída')
                                        .setDescription(cleanupResults.join('\n'))
                                        .setFooter({ text: 'Dados órfãos removidos com sucesso' })
                                        .setTimestamp();
                                    
                                    interaction.editReply({ embeds: [embed] });
                                });
                        });
                });
        });
}

async function fixVoiceUsers(interaction, db) {
    await interaction.deferReply({ ephemeral: true });
    
    // Encontrar usuários em calls que não têm registro
    const voiceChannels = interaction.guild.channels.cache.filter(c => c.type === 2);
    let usersInVoice = [];
    let fixed = 0;
    
    voiceChannels.forEach(channel => {
        channel.members.forEach(member => {
            if (!member.user.bot) {
                usersInVoice.push(member.id);
            }
        });
    });
    
    if (usersInVoice.length === 0) {
        return interaction.editReply({ content: '✅ Nenhum usuário em calls no momento.' });
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    for (const userId of usersInVoice) {
        // Verificar se já tem registro
        db.get(`SELECT * FROM voice_time WHERE user_id = ? AND guild_id = ?`,
            [userId, interaction.guild.id], (err, existing) => {
                if (!existing) {
                    // Criar registro para usuário em call
                    db.run(`INSERT INTO voice_time (user_id, guild_id, total_time, session_start, sessions) VALUES (?, ?, 0, ?, 1)`,
                        [userId, interaction.guild.id, now]);
                    fixed++;
                } else if (!existing.session_start) {
                    // Atualizar session_start se não estiver definido
                    db.run(`UPDATE voice_time SET session_start = ?, sessions = sessions + 1 WHERE user_id = ? AND guild_id = ?`,
                        [now, userId, interaction.guild.id]);
                    fixed++;
                }
            });
    }
    
    setTimeout(() => {
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔧 Correção Aplicada')
            .setDescription(`**Usuários em calls:** ${usersInVoice.length}\n**Registros corrigidos:** ${fixed}\n\n✅ Sistema de tempo de voz sincronizado!`)
            .setTimestamp();
        
        interaction.editReply({ embeds: [embed] });
    }, 1000);
}

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