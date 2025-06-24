const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configurações do servidor')
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
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('auto')
                        .setDescription('Cargo automático para novos membros')
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

async function configLogs(interaction, db) {
    const channel = interaction.options.getChannel('canal');
    
    if (channel.type !== 0) { // GUILD_TEXT
        return interaction.reply({ content: 'O canal deve ser um canal de texto!', ephemeral: true });
    }
    
    // Inserir ou atualizar configurações
    db.run(`INSERT INTO guild_settings (guild_id, log_channel_id) 
            VALUES (?, ?) 
            ON CONFLICT(guild_id) 
            DO UPDATE SET log_channel_id = ?, updated_at = strftime('%s', 'now')`,
        [interaction.guild.id, channel.id, channel.id], function(err) {
            if (err) {
                console.error('Erro ao configurar logs:', err);
                return interaction.reply({ content: 'Erro ao configurar canal de logs!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Canal de Logs Configurado')
                .setDescription(`Os logs de moderação serão enviados para ${channel}.\n\n**Eventos que serão logados:**\n• Entrada e saída de membros\n• Ações de moderação\n• Tickets criados/fechados\n• Verificações aprovadas/rejeitadas`)
                .setTimestamp();
            
            interaction.reply({ embeds: [embed], ephemeral: true });
        });
}

async function configRoles(interaction, db) {
    const supportRole = interaction.options.getRole('suporte');
    const councilRole = interaction.options.getRole('conselho');
    const autoRole = interaction.options.getRole('auto');
    
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
    
    if (autoRole) {
        updateFields.push('auto_role_id = ?');
        values.push(autoRole.id);
    }
    
    if (updateFields.length === 0) {
        return interaction.reply({ content: 'Você deve especificar pelo menos um cargo!', ephemeral: true });
    }
    
    values.push(interaction.guild.id);
    
    // Primeiro, inserir uma linha se não existir
    db.run(`INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)`, [interaction.guild.id]);
    
    // Depois, atualizar os campos
    db.run(`UPDATE guild_settings SET ${updateFields.join(', ')}, updated_at = strftime('%s', 'now') WHERE guild_id = ?`,
        values, function(err) {
            if (err) {
                console.error('Erro ao configurar cargos:', err);
                return interaction.reply({ content: 'Erro ao configurar cargos!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Cargos Configurados')
                .setDescription(`${supportRole ? `**🛠️ Suporte:** ${supportRole}\n` : ''}${councilRole ? `**🏛️ Conselho:** ${councilRole}\n` : ''}${autoRole ? `**🎭 Auto-role:** ${autoRole}\n` : ''}\n✅ Configurações salvas com sucesso!`)
                .setTimestamp();
            
            interaction.reply({ embeds: [embed], ephemeral: true });
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
                embed.setDescription('❌ Nenhuma configuração encontrada.\n\nUse os comandos de configuração para começar:\n• `/config logs` - Configurar logs\n• `/config roles` - Configurar cargos\n• `/ticket setup` - Configurar tickets\n• `/vip setup` - Configurar sistema VIP');
                return interaction.reply({ embeds: [embed] });
            }
            
            let description = '**📋 Configurações Atuais:**\n\n';
            
            // Canal de Logs
            if (settings.log_channel_id) {
                const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                description += `**📋 Canal de Logs:** ${logChannel || '❌ Canal não encontrado'}\n`;
            } else {
                description += '**📋 Canal de Logs:** ❌ Não configurado\n';
            }
            
            // Categoria de Tickets
            if (settings.ticket_category_id) {
                const ticketCategory = interaction.guild.channels.cache.get(settings.ticket_category_id);
                description += `**🎫 Categoria de Tickets:** ${ticketCategory || '❌ Categoria não encontrada'}\n`;
            } else {
                description += '**🎫 Categoria de Tickets:** ❌ Não configurado\n';
            }
            
            // Categoria VIP
            if (settings.vip_category_id) {
                const vipCategory = interaction.guild.channels.cache.get(settings.vip_category_id);
                description += `**👑 Categoria VIP:** ${vipCategory || '❌ Categoria não encontrada'}\n`;
            } else {
                description += '**👑 Categoria VIP:** ❌ Não configurado\n';
            }
            
            description += '\n**🎭 Cargos:**\n';
            
            // Cargo de Suporte
            if (settings.support_role_id) {
                const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
                description += `**🛠️ Suporte:** ${supportRole || '❌ Cargo não encontrado'}\n`;
            } else {
                description += '**🛠️ Suporte:** ❌ Não configurado\n';
            }
            
            // Cargo do Conselho
            if (settings.council_role_id) {
                const councilRole = interaction.guild.roles.cache.get(settings.council_role_id);
                description += `**🏛️ Conselho:** ${councilRole || '❌ Cargo não encontrado'}\n`;
            } else {
                description += '**🏛️ Conselho:** ❌ Não configurado\n';
            }
            
            // Auto-role
            if (settings.auto_role_id) {
                const autoRole = interaction.guild.roles.cache.get(settings.auto_role_id);
                description += `**🎭 Auto-role:** ${autoRole || '❌ Cargo não encontrado'}\n`;
            } else {
                description += '**🎭 Auto-role:** ❌ Não configurado\n';
            }
            
            embed.setDescription(description);
            
            // Estatísticas adicionais
            db.all(`SELECT 
                        (SELECT COUNT(*) FROM vips WHERE guild_id = ?) as total_vips,
                        (SELECT COUNT(*) FROM tickets WHERE guild_id = ?) as total_tickets,
                        (SELECT COUNT(*) FROM voice_time WHERE guild_id = ?) as voice_users`,
                [interaction.guild.id, interaction.guild.id, interaction.guild.id], (err, stats) => {
                    if (stats && stats[0]) {
                        embed.addFields({
                            name: '📊 Estatísticas',
                            value: `**VIPs Ativos:** ${stats[0].total_vips || 0}\n**Tickets Criados:** ${stats[0].total_tickets || 0}\n**Usuários com Tempo de Voz:** ${stats[0].voice_users || 0}`,
                            inline: false
                        });
                    }
                    
                    // Mostrar quando foi configurado
                    if (settings.created_at) {
                        embed.setFooter({ text: `Configurado em ${new Date(settings.created_at * 1000).toLocaleString()}` });
                    }
                    
                    interaction.reply({ embeds: [embed] });
                });
        });
}

async function resetConfig(interaction, db) {
    // Confirmar antes de resetar
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('⚠️ Confirmar Reset')
        .setDescription('**ATENÇÃO:** Esta ação irá remover TODAS as configurações do servidor!\n\n**Será removido:**\n• Canal de logs\n• Configurações de tickets\n• Configurações VIP\n• Cargos configurados\n• Todas as outras configurações\n\n**Esta ação é irreversível!**\n\nTem certeza que deseja continuar?')
        .setTimestamp();
    
    const confirmButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_reset_config')
                .setLabel('✅ Sim, Resetar')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_reset_config')
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.reply({ 
        embeds: [embed], 
        components: [confirmButton], 
        ephemeral: true 
    });
    
    // Aguardar resposta do botão
    const filter = i => i.user.id === interaction.user.id;
    
    try {
        const confirmation = await interaction.followUp({
            content: 'Aguardando confirmação...',
            ephemeral: true
        });
        
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 30000 
        });
        
        collector.on('collect', async i => {
            if (i.customId === 'confirm_reset_config') {
                // Executar reset
                db.run(`DELETE FROM guild_settings WHERE guild_id = ?`,
                    [interaction.guild.id], function(err) {
                        if (err) {
                            return i.update({ 
                                content: '❌ Erro ao resetar configurações!', 
                                embeds: [], 
                                components: [] 
                            });
                        }
                        
                        const resetEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('🔄 Configurações Resetadas')
                            .setDescription('✅ Todas as configurações do servidor foram resetadas com sucesso!\n\nUse os comandos de configuração para configurar o bot novamente:\n• `/config logs`\n• `/config roles`\n• `/ticket setup`\n• `/vip setup`')
                            .setTimestamp();
                        
                        i.update({ 
                            embeds: [resetEmbed], 
                            components: [] 
                        });
                    });
            } else if (i.customId === 'cancel_reset_config') {
                const cancelEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('❌ Reset Cancelado')
                    .setDescription('O reset das configurações foi cancelado.\n\nSuas configurações permanecem intactas.')
                    .setTimestamp();
                
                i.update({ 
                    embeds: [cancelEmbed], 
                    components: [] 
                });
            }
        });
        
        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ 
                    content: '⏰ Tempo esgotado. Reset cancelado.', 
                    embeds: [], 
                    components: [] 
                });
            }
        });
        
    } catch (error) {
        console.error('Erro no reset de configurações:', error);
        await interaction.editReply({ 
            content: '❌ Erro ao processar reset!', 
            embeds: [], 
            components: [] 
        });
    }
}