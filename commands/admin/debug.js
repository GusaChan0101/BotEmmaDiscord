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
                .setName('tables')
                .setDescription('Verificar estrutura das tabelas'))
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
            case 'tables':
                await checkTables(interaction, db);
                break;
        }
    },
};

async function debugVoice(interaction, db) {
    await interaction.deferReply({ ephemeral: true });
    
    // Verificar todos os registros de voice_time
    db.all(`SELECT * FROM voice_time WHERE guild_id = ?`, [interaction.guild.id], async (err, results) => {
        if (err) {
            return interaction.editReply({ content: `Erro: ${err.message}` });
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
                const userName = user ? user.displayName : result.user_id;
                
                description += `**${userName}:**\n`;
                description += `• Total: ${result.total_time}s (${formatTime(result.total_time)})\n`;
                description += `• Sessão: ${result.session_start ? `Ativa desde <t:${result.session_start}:R>` : 'Inativa'}\n`;
                description += `• Criado: <t:${result.created_at}:R>\n\n`;
            }
            
            if (results.length > 10) {
                description += `... e mais ${results.length - 10} registros`;
            }
            
            embed.setDescription(description);
        }
        
        // Verificar usuários atualmente em calls
        const voiceChannels = interaction.guild.channels.cache.filter(c => c.type === 2); // GUILD_VOICE
        let activeUsers = [];
        
        voiceChannels.forEach(channel => {
            channel.members.forEach(member => {
                activeUsers.push({
                    user: member.displayName,
                    channel: channel.name,
                    id: member.id
                });
            });
        });
        
        if (activeUsers.length > 0) {
            embed.addFields({
                name: '🔴 Usuários atualmente em calls',
                value: activeUsers.map(u => `• ${u.user} em ${u.channel}`).join('\n'),
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
    });
}

async function addTestTime(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const seconds = interaction.options.getInteger('segundos');
    
    db.run(`INSERT OR REPLACE INTO voice_time (user_id, guild_id, total_time, session_start) 
            VALUES (?, ?, COALESCE((SELECT total_time FROM voice_time WHERE user_id = ? AND guild_id = ?), 0) + ?, NULL)`,
        [user.id, interaction.guild.id, user.id, interaction.guild.id, seconds], function(err) {
            if (err) {
                return interaction.reply({ content: `Erro: ${err.message}`, ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Tempo Adicionado')
                .setDescription(`Adicionado ${formatTime(seconds)} para ${user}`)
                .setTimestamp();
            
            interaction.reply({ embeds: [embed], ephemeral: true });
        });
}

async function checkTables(interaction, db) {
    await interaction.deferReply({ ephemeral: true });
    
    // Verificar estrutura da tabela voice_time
    db.all(`PRAGMA table_info(voice_time)`, (err, info) => {
        if (err) {
            return interaction.editReply({ content: `Erro ao verificar tabela: ${err.message}` });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📋 Estrutura das Tabelas')
            .setTimestamp();
        
        let description = '**Tabela voice_time:**\n';
        if (info && info.length > 0) {
            info.forEach(column => {
                description += `• ${column.name} (${column.type}) - ${column.notnull ? 'NOT NULL' : 'NULL'}\n`;
            });
        } else {
            description += 'Tabela não existe ou está vazia\n';
        }
        
        // Verificar quantos registros existem
        db.get(`SELECT COUNT(*) as count FROM voice_time`, (err, count) => {
            description += `\n**Total de registros:** ${count?.count || 0}\n`;
            
            embed.setDescription(description);
            interaction.editReply({ embeds: [embed] });
        });
    });
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