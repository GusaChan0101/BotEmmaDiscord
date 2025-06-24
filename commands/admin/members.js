// ==================== commands/admin/members.js ====================

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('members')
        .setDescription('Gerenciar membros do servidor')
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('Limpar dados de um usuário específico')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para limpar dados')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Ver estatísticas de entrada/saída'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('recent')
                .setDescription('Ver membros recentes')
                .addIntegerOption(option =>
                    option.setName('limite')
                        .setDescription('Quantos mostrar (1-20)')
                        .setMinValue(1)
                        .setMaxValue(20)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'cleanup':
                await manualCleanup(interaction, db);
                break;
            case 'stats':
                await memberStats(interaction, db);
                break;
            case 'recent':
                await recentMembers(interaction, db);
                break;
        }
    }
};

// Função para limpeza manual
async function manualCleanup(interaction, db) {
    const user = interaction.options.getUser('usuario');
    
    await interaction.deferReply({ ephemeral: true });
    
    // Verificar se o usuário ainda está no servidor
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) {
        return interaction.editReply({ 
            content: '❌ O usuário ainda está no servidor! Use apenas para usuários que já saíram.' 
        });
    }
    
    // Limpar dados usando a função que já existe
    const results = await cleanUserDataOnLeave(user.id, interaction.guild.id, db);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🗑️ Limpeza Manual Realizada')
        .setDescription(`**Usuário:** ${user.tag}\n**ID:** ${user.id}\n\n✅ Dados limpos com sucesso!`)
        .addFields({
            name: '📋 Itens Processados',
            value: [
                results.voiceTime ? '✅ Ranking de voz' : '⏭️ Ranking de voz',
                results.vips ? '✅ Status VIP' : '⏭️ Status VIP',
                results.tickets ? '✅ Tickets' : '⏭️ Tickets',
                results.verifications ? '✅ Verificações' : '⏭️ Verificações',
                results.warnings ? '✅ Advertências' : '⏭️ Advertências',
                results.vipCalls ? '✅ Calls VIP' : '⏭️ Calls VIP',
                results.messages ? '✅ Mensagens' : '⏭️ Mensagens'
            ].join('\n'),
            inline: false
        })
        .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
}

// Função para estatísticas
async function memberStats(interaction, db) {
    await interaction.deferReply();
    
    const guild = interaction.guild;
    const totalMembers = guild.memberCount;
    const bots = guild.members.cache.filter(member => member.user.bot).size;
    const humans = totalMembers - bots;
    
    // Estatísticas de dados armazenados
    db.all(`SELECT 
                (SELECT COUNT(*) FROM voice_time WHERE guild_id = ?) as voice_users,
                (SELECT COUNT(*) FROM vips WHERE guild_id = ?) as vip_users,
                (SELECT COUNT(*) FROM message_count WHERE guild_id = ?) as message_users,
                (SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'open') as open_tickets`,
        [guild.id, guild.id, guild.id, guild.id], async (err, stats) => {
            
            if (err) {
                console.error('Erro ao buscar estatísticas:', err);
                return interaction.editReply({ content: '❌ Erro ao buscar estatísticas.' });
            }
            
            const data = stats[0] || {};
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Estatísticas de Membros')
                .addFields(
                    {
                        name: '👥 Membros do Servidor',
                        value: `**Total:** ${totalMembers.toLocaleString()}\n**Humanos:** ${humans.toLocaleString()}\n**Bots:** ${bots.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '💾 Dados Armazenados',
                        value: `**Com tempo de voz:** ${data.voice_users || 0}\n**VIPs ativos:** ${data.vip_users || 0}\n**Com mensagens:** ${data.message_users || 0}`,
                        inline: true
                    },
                    {
                        name: '🎫 Atividade',
                        value: `**Tickets abertos:** ${data.open_tickets || 0}\n**Sistema:** ✅ Ativo\n**Limpeza:** ✅ Automática`,
                        inline: true
                    }
                )
                .setThumbnail(guild.iconURL())
                .setFooter({ text: 'Sistema de limpeza automática ativo' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        });
}

// Função para membros recentes
async function recentMembers(interaction, db) {
    const limite = interaction.options.getInteger('limite') || 10;
    
    await interaction.deferReply();
    
    const members = interaction.guild.members.cache
        .filter(member => !member.user.bot)
        .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
        .first(limite);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('👋 Membros Recentes')
        .setTimestamp();
    
    let description = '';
    members.forEach((member, index) => {
        const joinedTime = member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Desconhecido';
        description += `**${index + 1}.** ${member.user} - ${joinedTime}\n`;
    });
    
    embed.setDescription(description || 'Nenhum membro encontrado');
    embed.setFooter({ text: `Mostrando últimos ${members.size} membros` });
    
    await interaction.editReply({ embeds: [embed] });
}

// Função de limpeza (reutiliza a do index.js)
async function cleanUserDataOnLeave(userId, guildId, db) {
    const results = {
        voiceTime: false,
        vips: false,
        tickets: false,
        verifications: false,
        warnings: false,
        vipCalls: false,
        messages: false
    };
    
    try {
        console.log(`🗑️ Limpeza manual para usuário ${userId} no servidor ${guildId}`);
        
        // 1. Remover do ranking de tempo de voz
        await new Promise((resolve) => {
            db.run(`DELETE FROM voice_time WHERE user_id = ? AND guild_id = ?`, 
                [userId, guildId], function(err) {
                    if (!err && this.changes > 0) results.voiceTime = true;
                    resolve();
                });
        });
        
        // 2. Remover VIP
        await new Promise((resolve) => {
            db.run(`DELETE FROM vips WHERE user_id = ? AND guild_id = ?`, 
                [userId, guildId], function(err) {
                    if (!err && this.changes > 0) results.vips = true;
                    resolve();
                });
        });
        
        // 3. Fechar tickets
        await new Promise((resolve) => {
            db.run(`UPDATE tickets SET status = 'closed' WHERE user_id = ? AND guild_id = ? AND status = 'open'`,
                [userId, guildId], function(err) {
                    if (!err && this.changes > 0) results.tickets = true;
                    resolve();
                });
        });
        
        // 4. Remover verificações
        await new Promise((resolve) => {
            db.run(`DELETE FROM verifications WHERE user_id = ? AND guild_id = ?`, 
                [userId, guildId], function(err) {
                    if (!err && this.changes > 0) results.verifications = true;
                    resolve();
                });
        });
        
        // 5. Remover warnings
        await new Promise((resolve) => {
            db.run(`DELETE FROM warnings WHERE user_id = ? AND guild_id = ?`, 
                [userId, guildId], function(err) {
                    if (!err && this.changes > 0) results.warnings = true;
                    resolve();
                });
        });
        
        // 6. Limpar contador de mensagens
        await new Promise((resolve) => {
            db.run(`DELETE FROM message_count WHERE user_id = ? AND guild_id = ?`, 
                [userId, guildId], function(err) {
                    if (!err && this.changes > 0) results.messages = true;
                    resolve();
                });
        });
        
        return results;
        
    } catch (error) {
        console.error('Erro na limpeza manual:', error);
        return results;
    }
}