const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configurações do servidor')
        .addSubcommand(subcommand =>
            subcommand
                .setName('vip')
                .setDescription('Configurar cargo VIP')
                .addRoleOption(option =>
                    option.setName('cargo')
                        .setDescription('Cargo que será dado aos VIPs')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('Configurar canal de logs')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('Canal para enviar logs de moderação')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('roles')
                .setDescription('Configurar cargos de equipe')
                .addRoleOption(option =>
                    option.setName('suporte')
                        .setDescription('Cargo de suporte')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('conselho')
                        .setDescription('Cargo do conselho')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Ver configurações atuais'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Resetar todas as configurações'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'vip':
                await configVip(interaction, db);
                break;
            case 'logs':
                await configLogs(interaction, db);
                break;
            case 'roles':
                await configRoles(interaction, db);
                break;
            case 'view':
                await viewConfig(interaction, db);
                break;
            case 'reset':
                await resetConfig(interaction, db);
                break;
        }
    },
};

async function configVip(interaction, db) {
    const role = interaction.options.getRole('cargo');
    
    db.run(`INSERT OR REPLACE INTO guild_settings 
            (guild_id, vip_role_id) 
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET vip_role_id = ?`,
        [interaction.guild.id, role.id, role.id], function(err) {
            if (err) {
                return interaction.reply({ content: 'Erro ao configurar cargo VIP!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Cargo VIP Configurado')
                .setDescription(`O cargo ${role} será dado automaticamente aos usuários VIP.`)
                .setTimestamp();
            
            interaction.reply({ embeds: [embed] });
        });
}

async function configLogs(interaction, db) {
    const channel = interaction.options.getChannel('canal');
    
    if (channel.type !== 0) { // GUILD_TEXT
        return interaction.reply({ content: 'O canal deve ser um canal de texto!', ephemeral: true });
    }
    
    db.run(`INSERT OR REPLACE INTO guild_settings 
            (guild_id, log_channel_id) 
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = ?`,
        [interaction.guild.id, channel.id, channel.id], function(err) {
            if (err) {
                return interaction.reply({ content: 'Erro ao configurar canal de logs!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Canal de Logs Configurado')
                .setDescription(`Os logs de moderação serão enviados para ${channel}.`)
                .setTimestamp();
            
            interaction.reply({ embeds: [embed] });
        });
}

async function configRoles(interaction, db) {
    const supportRole = interaction.options.getRole('suporte');
    const councilRole = interaction.options.getRole('conselho');
    
    let updateFields = [];
    let values = [];
    
    if (supportRole) {
        updateFields.push('support_role_id = ?');
        values.push(supportRole.id);
    }
    
    if (councilRole) {
        updateFields.push('council_role_id = ?');
        values.push(councilRole.id);
    }
    
    if (updateFields.length === 0) {
        return interaction.reply({ content: 'Você deve especificar pelo menos um cargo!', ephemeral: true });
    }
    
    values.push(interaction.guild.id);
    
    // Primeiro, inserir uma linha se não existir
    db.run(`INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)`, [interaction.guild.id]);
    
    // Depois, atualizar os campos
    db.run(`UPDATE guild_settings SET ${updateFields.join(', ')} WHERE guild_id = ?`,
        values, function(err) {
            if (err) {
                return interaction.reply({ content: 'Erro ao configurar cargos!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Cargos Configurados')
                .setDescription(`${supportRole ? `**Suporte:** ${supportRole}\n` : ''}${councilRole ? `**Conselho:** ${councilRole}` : ''}`)
                .setTimestamp();
            
            interaction.reply({ embeds: [embed] });
        });
}

async function viewConfig(interaction, db) {
    db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`,
        [interaction.guild.id], async (err, settings) => {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚙️ Configurações do Servidor')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            if (!settings) {
                embed.setDescription('Nenhuma configuração encontrada. Use os comandos de configuração para começar!');
                return interaction.reply({ embeds: [embed] });
            }
            
            let description = '';
            
            // Cargo VIP
            if (settings.vip_role_id) {
                const vipRole = interaction.guild.roles.cache.get(settings.vip_role_id);
                description += `**👑 Cargo VIP:** ${vipRole || 'Cargo não encontrado'}\n`;
            } else {
                description += '**👑 Cargo VIP:** Não configurado\n';
            }
            
            // Canal de Logs
            if (settings.log_channel_id) {
                const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                description += `**📋 Canal de Logs:** ${logChannel || 'Canal não encontrado'}\n`;
            } else {
                description += '**📋 Canal de Logs:** Não configurado\n';
            }
            
            // Categoria de Tickets
            if (settings.ticket_category_id) {
                const ticketCategory = interaction.guild.channels.cache.get(settings.ticket_category_id);
                description += `**🎫 Categoria de Tickets:** ${ticketCategory || 'Categoria não encontrada'}\n`;
            } else {
                description += '**🎫 Categoria de Tickets:** Não configurado\n';
            }
            
            // Cargo de Suporte
            if (settings.support_role_id) {
                const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
                description += `**🛠️ Cargo de Suporte:** ${supportRole || 'Cargo não encontrado'}\n`;
            } else {
                description += '**🛠️ Cargo de Suporte:** Não configurado\n';
            }
            
            // Cargo do Conselho
            if (settings.council_role_id) {
                const councilRole = interaction.guild.roles.cache.get(settings.council_role_id);
                description += `**🏛️ Cargo do Conselho:** ${councilRole || 'Cargo não encontrado'}\n`;
            } else {
                description += '**🏛️ Cargo do Conselho:** Não configurado\n';
            }
            
            embed.setDescription(description);
            
            // Estatísticas adicionais
            db.all(`SELECT 
                        (SELECT COUNT(*) FROM vips WHERE guild_id = ?) as total_vips,
                        (SELECT COUNT(*) FROM tickets WHERE guild_id = ?) as total_tickets,
                        (SELECT COUNT(*) FROM message_count WHERE guild_id = ?) as active_users`,
                [interaction.guild.id, interaction.guild.id, interaction.guild.id], (err, stats) => {
                    if (stats && stats[0]) {
                        embed.addFields({
                            name: '📊 Estatísticas',
                            value: `**VIPs Ativos:** ${stats[0].total_vips}\n**Tickets Criados:** ${stats[0].total_tickets}\n**Usuários Ativos:** ${stats[0].active_users}`,
                            inline: false
                        });
                    }
                    
                    interaction.reply({ embeds: [embed] });
                });
        });
}

async function resetConfig(interaction, db) {
    db.run(`DELETE FROM guild_settings WHERE guild_id = ?`,
        [interaction.guild.id], function(err) {
            if (err) {
                return interaction.reply({ content: 'Erro ao resetar configurações!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔄 Configurações Resetadas')
                .setDescription('Todas as configurações do servidor foram resetadas.\n\nUse os comandos de configuração para configurar o bot novamente.')
                .setTimestamp();
            
            interaction.reply({ embeds: [embed] });
        });
}