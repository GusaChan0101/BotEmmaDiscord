const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Comandos de moderação')
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Expulsar um membro')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para expulsar')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo da expulsão')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Banir um membro')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para banir')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo do banimento')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('dias')
                        .setDescription('Dias de mensagens para deletar (0-7)')
                        .setMinValue(0)
                        .setMaxValue(7)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('timeout')
                .setDescription('Aplicar timeout em um membro')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para timeout')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('tempo')
                        .setDescription('Tempo em minutos (1-1440)')
                        .setMinValue(1)
                        .setMaxValue(1440)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo do timeout')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('warn')
                .setDescription('Advertir um membro')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para advertir')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo da advertência')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Limpar mensagens')
                .addIntegerOption(option =>
                    option.setName('quantidade')
                        .setDescription('Quantidade de mensagens (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Limpar apenas mensagens deste usuário')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'kick':
                await kickMember(interaction, db);
                break;
            case 'ban':
                await banMember(interaction, db);
                break;
            case 'timeout':
                await timeoutMember(interaction, db);
                break;
            case 'warn':
                await warnMember(interaction, db);
                break;
            case 'clear':
                await clearMessages(interaction);
                break;
        }
    },
};

async function kickMember(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const motivo = interaction.options.getString('motivo') || 'Sem motivo especificado';
    
    try {
        const member = await interaction.guild.members.fetch(user.id);
        
        if (!member.kickable) {
            return interaction.reply({ content: 'Não posso expulsar este membro!', ephemeral: true });
        }
        
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'Você não pode expulsar este membro!', ephemeral: true });
        }
        
        // Enviar DM antes de expulsar
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🦶 Você foi expulso!')
                .setDescription(`**Servidor:** ${interaction.guild.name}\n**Motivo:** ${motivo}\n**Moderador:** ${interaction.user.tag}`)
                .setTimestamp();
            
            await user.send({ embeds: [dmEmbed] });
        } catch (error) {
            // Usuário pode ter DMs desabilitadas
        }
        
        await member.kick(motivo);
        
        // Log da ação
        logAction(interaction, db, 'KICK', user, motivo);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🦶 Membro Expulso')
            .setDescription(`**Usuário:** ${user.tag}\n**Motivo:** ${motivo}\n**Moderador:** ${interaction.user.tag}`)
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({ content: 'Erro ao expulsar membro!', ephemeral: true });
    }
}

async function banMember(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const motivo = interaction.options.getString('motivo') || 'Sem motivo especificado';
    const dias = interaction.options.getInteger('dias') || 0;
    
    try {
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (member) {
            if (!member.bannable) {
                return interaction.reply({ content: 'Não posso banir este membro!', ephemeral: true });
            }
            
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({ content: 'Você não pode banir este membro!', ephemeral: true });
            }
            
            // Enviar DM antes de banir
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('🔨 Você foi banido!')
                    .setDescription(`**Servidor:** ${interaction.guild.name}\n**Motivo:** ${motivo}\n**Moderador:** ${interaction.user.tag}`)
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                // Usuário pode ter DMs desabilitadas
            }
        }
        
        await interaction.guild.members.ban(user, { 
            deleteMessageDays: dias, 
            reason: `${motivo} - Moderador: ${interaction.user.tag}` 
        });
        
        // Log da ação
        logAction(interaction, db, 'BAN', user, motivo);
        
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🔨 Membro Banido')
            .setDescription(`**Usuário:** ${user.tag}\n**Motivo:** ${motivo}\n**Moderador:** ${interaction.user.tag}\n**Mensagens deletadas:** ${dias} dias`)
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({ content: 'Erro ao banir usuário!', ephemeral: true });
    }
}

async function timeoutMember(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const tempo = interaction.options.getInteger('tempo');
    const motivo = interaction.options.getString('motivo') || 'Sem motivo especificado';
    
    try {
        const member = await interaction.guild.members.fetch(user.id);
        
        if (!member.moderatable) {
            return interaction.reply({ content: 'Não posso aplicar timeout neste membro!', ephemeral: true });
        }
        
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'Você não pode aplicar timeout neste membro!', ephemeral: true });
        }
        
        const timeoutDuration = tempo * 60 * 1000; // Converter minutos para milissegundos
        await member.timeout(timeoutDuration, `${motivo} - Moderador: ${interaction.user.tag}`);
        
        // Log da ação
        logAction(interaction, db, 'TIMEOUT', user, `${motivo} (${tempo} minutos)`);
        
        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⏰ Timeout Aplicado')
            .setDescription(`**Usuário:** ${user.tag}\n**Duração:** ${tempo} minutos\n**Motivo:** ${motivo}\n**Moderador:** ${interaction.user.tag}`)
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({ content: 'Erro ao aplicar timeout!', ephemeral: true });
    }
}

async function warnMember(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const motivo = interaction.options.getString('motivo');
    
    // Salvar warning no banco
    db.run(`CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    db.run(`INSERT INTO warnings (user_id, guild_id, moderator_id, reason) VALUES (?, ?, ?, ?)`,
        [user.id, interaction.guild.id, interaction.user.id, motivo]);
    
    // Contar warnings do usuário
    db.get(`SELECT COUNT(*) as count FROM warnings WHERE user_id = ? AND guild_id = ?`,
        [user.id, interaction.guild.id], async (err, row) => {
            const warnCount = row.count;
            
            // Enviar DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ Você recebeu uma advertência!')
                    .setDescription(`**Servidor:** ${interaction.guild.name}\n**Motivo:** ${motivo}\n**Moderador:** ${interaction.user.tag}\n**Total de advertências:** ${warnCount}`)
                    .setTimestamp();
                
                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                // Usuário pode ter DMs desabilitadas
            }
            
            // Log da ação
            logAction(interaction, db, 'WARN', user, motivo);
            
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Advertência Aplicada')
                .setDescription(`**Usuário:** ${user.tag}\n**Motivo:** ${motivo}\n**Moderador:** ${interaction.user.tag}\n**Total de advertências:** ${warnCount}`)
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        });
}

async function clearMessages(interaction) {
    const quantidade = interaction.options.getInteger('quantidade');
    const targetUser = interaction.options.getUser('usuario');
    
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let messagesToDelete;
        
        if (targetUser) {
            messagesToDelete = messages.filter(msg => msg.author.id === targetUser.id).first(quantidade);
        } else {
            messagesToDelete = messages.first(quantidade);
        }
        
        if (messagesToDelete.length === 0) {
            return interaction.editReply({ content: 'Nenhuma mensagem encontrada para deletar!' });
        }
        
        // Filtrar mensagens mais antigas que 14 dias (limite do Discord)
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const recentMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
        
        if (recentMessages.length === 0) {
            return interaction.editReply({ content: 'Todas as mensagens são muito antigas para serem deletadas (>14 dias)!' });
        }
        
        await interaction.channel.bulkDelete(recentMessages, true);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🗑️ Mensagens Limpas')
            .setDescription(`**Quantidade:** ${recentMessages.length} mensagens\n${targetUser ? `**Usuário:** ${targetUser.tag}\n` : ''}**Moderador:** ${interaction.user.tag}`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        // Auto-deletar a resposta após 5 segundos
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (error) {
                // Ignorar erro se a mensagem já foi deletada
            }
        }, 5000);
        
    } catch (error) {
        console.error(error);
        await interaction.editReply({ content: 'Erro ao limpar mensagens!' });
    }
}

function logAction(interaction, db, action, target, reason) {
    // Criar tabela de logs se não existir
    db.run(`CREATE TABLE IF NOT EXISTS mod_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    // Salvar log
    db.run(`INSERT INTO mod_logs (guild_id, moderator_id, target_id, action, reason) VALUES (?, ?, ?, ?, ?)`,
        [interaction.guild.id, interaction.user.id, target.id, action, reason]);
    
    // Enviar para canal de log se configurado
    db.get(`SELECT log_channel_id FROM guild_settings WHERE guild_id = ?`,
        [interaction.guild.id], async (err, settings) => {
            if (settings?.log_channel_id) {
                const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                if (logChannel) {
                    const colors = {
                        'KICK': '#ff6b6b',
                        'BAN': '#8B0000',
                        'TIMEOUT': '#ffaa00',
                        'WARN': '#ffaa00'
                    };
                    
                    const logEmbed = new EmbedBuilder()
                        .setColor(colors[action] || '#0099ff')
                        .setTitle(`📋 ${action}`)
                        .setDescription(`**Alvo:** ${target.tag} (${target.id})\n**Moderador:** ${interaction.user.tag}\n**Motivo:** ${reason}`)
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
        });
}