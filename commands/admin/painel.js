// ==================== commands/admin/painel.js - PAINEL COMPLETO ====================

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    ChannelType
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel')
        .setDescription('Painel de configuração completo do servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, db) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ Apenas administradores podem usar este comando!', 
                ephemeral: true 
            });
        }

        await showMainPanel(interaction, db);
    }
};

// ==================== PAINEL PRINCIPAL ====================

async function showMainPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('🎛️ Painel de Configuração Completo')
        .setDescription(`**Servidor:** ${interaction.guild.name}\n**Admin:** ${interaction.user}\n\n🚀 **Configure todos os sistemas do bot:**`)
        .addFields(
            {
                name: '🎫 Sistema de Tickets',
                value: 'Configure sistema completo de suporte com tickets privados',
                inline: true
            },
            {
                name: '🔨 Sistema de Moderação',
                value: 'Logs, cargos de staff e ferramentas de moderação',
                inline: true
            },
            {
                name: '👑 Sistema VIP',
                value: 'Cargos VIP, calls privadas e benefícios exclusivos',
                inline: true
            },
            {
                name: '🛡️ Sistema de Verificação',
                value: 'Verificação de membros e sistema de segurança',
                inline: true
            },
            {
                name: '📊 Estatísticas e Ranking',
                value: 'Sistema de XP, tempo de voz e rankings',
                inline: true
            },
            {
                name: '⚙️ Configurações Gerais',
                value: 'Auto-roles, logs gerais e configurações básicas',
                inline: true
            }
        )
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: 'Use os botões abaixo para configurar cada sistema' })
        .setTimestamp();

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('panel_tickets')
                .setLabel('🎫 Tickets')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('panel_moderation')
                .setLabel('🔨 Moderação')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('panel_vip')
                .setLabel('👑 VIP')
                .setStyle(ButtonStyle.Success)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('panel_verification')
                .setLabel('🛡️ Verificação')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('panel_stats')
                .setLabel('📊 Estatísticas')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('panel_general')
                .setLabel('⚙️ Geral')
                .setStyle(ButtonStyle.Secondary)
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('panel_status')
                .setLabel('📋 Ver Status Completo')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('panel_help')
                .setLabel('❓ Ajuda')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('panel_backup')
                .setLabel('💾 Backup Config')
                .setStyle(ButtonStyle.Danger)
        );

    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                embeds: [embed],
                components: [row1, row2, row3]
            });
        } else {
            await interaction.reply({
                embeds: [embed],
                components: [row1, row2, row3],
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Erro ao mostrar painel principal:', error);
    }
}

// ==================== HANDLERS DOS BOTÕES ====================

async function handlePanelButton(interaction, customId, db) {
    try {
        switch (customId) {
            case 'panel_tickets':
                await showTicketsPanel(interaction, db);
                break;
            case 'panel_moderation':
                await showModerationPanel(interaction, db);
                break;
            case 'panel_vip':
                await showVipPanel(interaction, db);
                break;
            case 'panel_verification':
                await showVerificationPanel(interaction, db);
                break;
            case 'panel_stats':
                await showStatsPanel(interaction, db);
                break;
            case 'panel_general':
                await showGeneralPanel(interaction, db);
                break;
            case 'panel_status':
                await showCompleteStatus(interaction, db);
                break;
            case 'panel_help':
                await showPanelHelp(interaction, db);
                break;
            case 'panel_backup':
                await createConfigBackup(interaction, db);
                break;
            case 'back_to_main':
                await showMainPanel(interaction, db);
                break;
        }
    } catch (error) {
        console.error('Erro no handler do painel:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erro ao processar ação!', ephemeral: true });
        }
    }
}

// ==================== PAINEL DE TICKETS ====================

async function showTicketsPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎫 Configuração de Tickets')
        .setDescription('Configure o sistema completo de tickets de suporte:')
        .addFields(
            {
                name: '⚡ Configuração Automática (Recomendado)',
                value: '• Cria categoria "🎫 Tickets" automaticamente\n• Envia painel de tickets neste canal\n• Configura permissões adequadas\n• Sistema pronto para uso',
                inline: false
            },
            {
                name: '🔧 Configuração Manual',
                value: '• Escolher canal específico para painel\n• Escolher categoria específica\n• Configurar cargos de suporte\n• Configuração detalhada',
                inline: false
            },
            {
                name: '📋 Gerenciamento',
                value: '• Ver tickets ativos\n• Estatísticas de tickets\n• Configurações avançadas',
                inline: false
            }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('tickets_auto_setup')
                .setLabel('⚡ Configuração Automática')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('tickets_manual_setup')
                .setLabel('🔧 Configuração Manual')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('tickets_manage')
                .setLabel('📋 Gerenciar')
                .setStyle(ButtonStyle.Secondary)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar ao Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    await safeUpdate(interaction, {
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// ==================== PAINEL DE MODERAÇÃO ====================

async function showModerationPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#ff6600')
        .setTitle('🔨 Configuração de Moderação')
        .setDescription('Configure todas as ferramentas de moderação:')
        .addFields(
            {
                name: '📋 Sistema de Logs',
                value: '• Canal para logs de moderação\n• Logs de entrada/saída\n• Logs de punições',
                inline: true
            },
            {
                name: '🎭 Cargos de Staff',
                value: '• Cargo de Moderadores\n• Cargo de Administradores\n• Cargo de Suporte',
                inline: true
            },
            {
                name: '⚡ Configuração Rápida',
                value: '• Configura tudo automaticamente\n• Cria canal #logs\n• Define cargos padrão',
                inline: true
            }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('mod_auto_setup')
                .setLabel('⚡ Setup Automático')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('mod_logs_setup')
                .setLabel('📋 Configurar Logs')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('mod_roles_setup')
                .setLabel('🎭 Configurar Cargos')
                .setStyle(ButtonStyle.Secondary)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar ao Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    await safeUpdate(interaction, {
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// ==================== PAINEL VIP ====================

async function showVipPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('👑 Configuração VIP')
        .setDescription('Configure o sistema VIP completo:')
        .addFields(
            {
                name: '🏗️ Setup Inicial',
                value: '• Categoria para calls VIP\n• Cargos VIP (Bronze, Prata, Ouro, Diamante)\n• Configurações automáticas',
                inline: false
            },
            {
                name: '👑 Gerenciar VIPs',
                value: '• Adicionar/remover VIPs\n• Ver lista de VIPs ativos\n• Gerenciar calls privadas',
                inline: false
            },
            {
                name: '⚙️ Configurações Avançadas',
                value: '• Benefícios personalizados\n• Tags VIP exclusivas\n• Configurações de calls',
                inline: false
            }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('vip_auto_setup')
                .setLabel('🏗️ Setup Inicial')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('vip_manage')
                .setLabel('👑 Gerenciar VIPs')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('vip_config')
                .setLabel('⚙️ Configurações')
                .setStyle(ButtonStyle.Secondary)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar ao Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    await safeUpdate(interaction, {
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// ==================== PAINEL DE VERIFICAÇÃO ====================

async function showVerificationPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('🛡️ Sistema de Verificação')
        .setDescription('Configure a segurança do servidor:')
        .addFields(
            {
                name: '🛡️ Setup Automático',
                value: '• Cria cargo "Verificado"\n• Configura painel de verificação\n• Sistema de tickets para verificação',
                inline: false
            },
            {
                name: '📋 Gerenciar Verificações',
                value: '• Ver verificações pendentes\n• Aprovar/rejeitar manualmente\n• Histórico de verificações',
                inline: false
            },
            {
                name: '⚙️ Configurações de Segurança',
                value: '• Idade mínima de conta\n• Verificação por imagem\n• Logs de segurança',
                inline: false
            }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('verify_auto_setup')
                .setLabel('🛡️ Setup Automático')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('verify_manage')
                .setLabel('📋 Gerenciar')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('verify_config')
                .setLabel('⚙️ Configurações')
                .setStyle(ButtonStyle.Secondary)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar ao Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    await safeUpdate(interaction, {
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// ==================== PAINEL DE ESTATÍSTICAS ====================

async function showStatsPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#9932cc')
        .setTitle('📊 Sistema de Estatísticas')
        .setDescription('Configure rankings e sistema de XP:')
        .addFields(
            {
                name: '🎤 Sistema de Tempo de Voz',
                value: '• Já está ativo automaticamente\n• Ranking por tempo em calls\n• XP por tempo de voz',
                inline: false
            },
            {
                name: '💬 Sistema de Mensagens',
                value: '• XP por mensagens enviadas\n• Ranking de atividade\n• Sistema de níveis',
                inline: false
            },
            {
                name: '🏆 Rankings e Leaderboards',
                value: '• Ver rankings atuais\n• Configurar recompensas\n• Sistema de conquistas',
                inline: false
            }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stats_view_voice')
                .setLabel('🎤 Ranking de Voz')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stats_view_messages')
                .setLabel('💬 Ranking de Mensagens')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stats_config')
                .setLabel('⚙️ Configurar Sistema')
                .setStyle(ButtonStyle.Success)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar ao Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    await safeUpdate(interaction, {
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// ==================== PAINEL GERAL ====================

async function showGeneralPanel(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#36393f')
        .setTitle('⚙️ Configurações Gerais')
        .setDescription('Configure aspectos básicos do servidor:')
        .addFields(
            {
                name: '🎭 Auto-Role',
                value: 'Cargo automático para novos membros',
                inline: true
            },
            {
                name: '📋 Logs Gerais',
                value: 'Canal para logs de entrada/saída',
                inline: true
            },
            {
                name: '🔧 Configurações Avançadas',
                value: 'Outras configurações do servidor',
                inline: true
            }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('general_autorole')
                .setLabel('🎭 Auto-Role')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('general_logs')
                .setLabel('📋 Logs Gerais')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('general_advanced')
                .setLabel('🔧 Avançado')
                .setStyle(ButtonStyle.Success)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar ao Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    await safeUpdate(interaction, {
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// ==================== STATUS COMPLETO ====================

async function showCompleteStatus(interaction, db) {
    try {
        if (!interaction.deferred) {
            await interaction.deferUpdate();
        }

        const guild = interaction.guild;
        
        db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [guild.id], async (err, settings) => {
            // Buscar estatísticas
            db.all(`SELECT 
                        (SELECT COUNT(*) FROM voice_time WHERE guild_id = ?) as voice_users,
                        (SELECT COUNT(*) FROM vips WHERE guild_id = ?) as vip_users,
                        (SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'open') as open_tickets,
                        (SELECT COUNT(*) FROM message_count WHERE guild_id = ?) as message_users,
                        (SELECT COUNT(*) FROM verifications WHERE guild_id = ?) as verified_users`,
                [guild.id, guild.id, guild.id, guild.id, guild.id], async (err, stats) => {
                    
                    const data = stats[0] || {};
                    
                    const embed = new EmbedBuilder()
                        .setColor('#4CAF50')
                        .setTitle('📊 Status Completo do Sistema')
                        .setThumbnail(guild.iconURL());

                    // Verificar configurações
                    const logChannel = settings?.log_channel_id ? guild.channels.cache.get(settings.log_channel_id) : null;
                    const ticketCategory = settings?.ticket_category_id ? guild.channels.cache.get(settings.ticket_category_id) : null;
                    const vipCategory = settings?.vip_category_id ? guild.channels.cache.get(settings.vip_category_id) : null;
                    const autoRole = settings?.auto_role_id ? guild.roles.cache.get(settings.auto_role_id) : null;
                    const supportRole = settings?.support_role_id ? guild.roles.cache.get(settings.support_role_id) : null;

                    // Status das configurações
                    embed.addFields({
                        name: '⚙️ Sistemas Configurados',
                        value: [
                            `🎫 **Tickets:** ${ticketCategory ? '✅ Ativo' : '❌ Inativo'}`,
                            `📋 **Logs:** ${logChannel ? '✅ Ativo' : '❌ Inativo'}`,
                            `👑 **VIP:** ${vipCategory ? '✅ Ativo' : '❌ Inativo'}`,
                            `🎭 **Auto-Role:** ${autoRole ? '✅ Ativo' : '❌ Inativo'}`,
                            `🛠️ **Suporte:** ${supportRole ? '✅ Configurado' : '❌ Não configurado'}`
                        ].join('\n'),
                        inline: false
                    });

                    // Estatísticas do servidor
                    embed.addFields({
                        name: '📈 Estatísticas do Servidor',
                        value: [
                            `👥 **Total de membros:** ${guild.memberCount}`,
                            `🎤 **Com tempo de voz:** ${data.voice_users || 0}`,
                            `💬 **Usuários ativos:** ${data.message_users || 0}`,
                            `👑 **VIPs ativos:** ${data.vip_users || 0}`,
                            `🛡️ **Verificados:** ${data.verified_users || 0}`,
                            `🎫 **Tickets abertos:** ${data.open_tickets || 0}`
                        ].join('\n'),
                        inline: true
                    });

                    // Status do bot
                    embed.addFields({
                        name: '🤖 Status do Bot',
                        value: [
                            `**Status:** 🟢 Online`,
                            `**Ping:** ${interaction.client.ws.ping}ms`,
                            `**Uptime:** ${Math.floor(interaction.client.uptime / 60000)}min`,
                            `**Comandos:** ${interaction.client.commands.size}`,
                            `**Servidores:** ${interaction.client.guilds.cache.size}`,
                            `**Usuários:** ${interaction.client.users.cache.size}`
                        ].join('\n'),
                        inline: true
                    });

                    embed.setTimestamp();
                    
                    const buttons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('status_refresh')
                                .setLabel('🔄 Atualizar')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('back_to_main')
                                .setLabel('◀️ Voltar')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    await interaction.editReply({ 
                        embeds: [embed], 
                        components: [buttons] 
                    });
                });
        });
        
    } catch (error) {
        console.error('Erro ao mostrar status:', error);
    }
}

// ==================== AJUDA DO PAINEL ====================

async function showPanelHelp(interaction, db) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('❓ Ajuda do Painel de Configuração')
        .setDescription('Guia completo para usar o painel:')
        .addFields(
            {
                name: '🎫 Sistema de Tickets',
                value: '• **Automático:** Cria categoria e painel instantaneamente\n• **Manual:** Escolha canal e categoria específicos\n• **Gerenciar:** Ver tickets ativos e estatísticas',
                inline: false
            },
            {
                name: '🔨 Sistema de Moderação',
                value: '• **Logs:** Canal para registrar ações de moderação\n• **Cargos:** Definir equipe de moderação\n• **Ferramentas:** Comandos de ban, kick, warn, etc.',
                inline: false
            },
            {
                name: '👑 Sistema VIP',
                value: '• **Setup:** Categoria para calls VIP e cargos\n• **Gerenciar:** Adicionar/remover VIPs\n• **Benefícios:** Calls privadas, tags exclusivas',
                inline: false
            },
            {
                name: '🛡️ Sistema de Verificação',
                value: '• **Segurança:** Verificação manual de membros\n• **Painel:** Interface para verificações\n• **Configurações:** Requisitos de verificação',
                inline: false
            },
            {
                name: '📊 Sistema de Estatísticas',
                value: '• **Tempo de Voz:** Ranking automático por calls\n• **Mensagens:** XP por atividade no chat\n• **Rankings:** Leaderboards interativos',
                inline: false
            },
            {
                name: '⚙️ Configurações Gerais',
                value: '• **Auto-Role:** Cargo automático para novos membros\n• **Logs Gerais:** Entrada/saída de membros\n• **Backup:** Exportar configurações',
                inline: false
            }
        )
        .setFooter({ text: 'Use /painel novamente para voltar ao menu principal' })
        .setTimestamp();

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('◀️ Voltar ao Menu')
                .setStyle(ButtonStyle.Secondary)
        );

    await safeUpdate(interaction, {
        embeds: [embed],
        components: [backButton]
    });
}

// ==================== BACKUP DE CONFIGURAÇÃO ====================

async function createConfigBackup(interaction, db) {
    try {
        await interaction.deferUpdate();
        
        const guild = interaction.guild;
        
        db.get(`SELECT * FROM guild_settings WHERE guild_id = ?`, [guild.id], async (err, settings) => {
            if (!settings) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Nenhuma Configuração')
                    .setDescription('Não há configurações para fazer backup.\n\nConfigure alguns sistemas primeiro!')
                    .setTimestamp();
                
                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('back_to_main')
                            .setLabel('◀️ Voltar')
                            .setStyle(ButtonStyle.Secondary)
                    );
                
                return interaction.editReply({ embeds: [embed], components: [backButton] });
            }
            
            const backup = {
                serverId: guild.id,
                serverName: guild.name,
                backupDate: new Date().toISOString(),
                settings: settings,
                channels: {
                    total: guild.channels.cache.size,
                    text: guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size,
                    voice: guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size
                },
                roles: {
                    total: guild.roles.cache.size,
                    members: guild.memberCount
                }
            };
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('💾 Backup de Configuração')
                .setDescription(`**Servidor:** ${guild.name}\n**Data:** ${new Date().toLocaleString()}\n\n✅ **Backup criado com sucesso!**`)
                .addFields({
                    name: '📋 Configurações Incluídas',
                    value: [
                        `🎫 Tickets: ${settings.ticket_category_id ? '✅' : '❌'}`,
                        `📋 Logs: ${settings.log_channel_id ? '✅' : '❌'}`,
                        `👑 VIP: ${settings.vip_category_id ? '✅' : '❌'}`,
                        `🎭 Auto-Role: ${settings.auto_role_id ? '✅' : '❌'}`,
                        `🛠️ Suporte: ${settings.support_role_id ? '✅' : '❌'}`
                    ].join('\n'),
                    inline: false
                })
                .setFooter({ text: 'Backup salvo em formato JSON' })
                .setTimestamp();
            
            const backupText = JSON.stringify(backup, null, 2);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_main')
                        .setLabel('◀️ Voltar')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            // Criar arquivo de backup
            const fs = require('fs');
            const path = require('path');
            
            try {
                const backupDir = path.join(__dirname, '../../data/backups');
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                
                const filename = `backup_${guild.id}_${Date.now()}.json`;
                const filepath = path.join(backupDir, filename);
                
                fs.writeFileSync(filepath, backupText);
                
                await interaction.editReply({ 
                    embeds: [embed], 
                    components: [backButton],
                    files: [{
                        attachment: filepath,
                        name: `configuracao_${guild.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`
                    }]
                });
                
                // Remover arquivo após 10 segundos
                setTimeout(() => {
                    try {
                        fs.unlinkSync(filepath);
                    } catch (e) {
                        console.error('Erro ao remover arquivo de backup:', e);
                    }
                }, 10000);
                
            } catch (fileError) {
                console.error('Erro ao criar arquivo:', fileError);
                await interaction.editReply({ embeds: [embed], components: [backButton] });
            }
        });
        
    } catch (error) {
        console.error('Erro ao criar backup:', error);
    }
}

// ==================== FUNÇÃO AUXILIAR SEGURA ====================

async function safeUpdate(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(options);
        } else {
            await interaction.update(options);
        }
    } catch (error) {
        console.error('Erro ao atualizar interação:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Erro ao atualizar interface. Use `/painel` novamente.',
                    ephemeral: true
                });
            }
        } catch (e) {
            console.error('Erro crítico ao responder:', e);
        }
    }
}

// ==================== EXPORTAR FUNÇÕES ====================

module.exports.handlePanelButton = handlePanelButton;
module.exports.showMainPanel = showMainPanel;