const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verification')
        .setDescription('Sistema de verificação de membros')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configurar sistema de verificação')
                .addRoleOption(option =>
                    option.setName('cargo')
                        .setDescription('Cargo para membros verificados')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('Canal para painel de verificação')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('logs')
                        .setDescription('Canal para logs de verificação')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('approve')
                .setDescription('Aprovar verificação (usar em ticket)')
                .addAttachmentOption(option =>
                    option.setName('imagem')
                        .setDescription('Imagem da verificação')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('observacao')
                        .setDescription('Observação sobre a verificação')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reject')
                .setDescription('Rejeitar verificação (usar em ticket)')
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Motivo da rejeição')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Ver status de verificação de um usuário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para verificar')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Listar verificações pendentes'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('Ver configurações do sistema'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await setupVerification(interaction, db);
                break;
            case 'approve':
                await approveVerification(interaction, db);
                break;
            case 'reject':
                await rejectVerification(interaction, db);
                break;
            case 'status':
                await checkVerificationStatus(interaction, db);
                break;
            case 'list':
                await listPendingVerifications(interaction, db);
                break;
            case 'settings':
                await showVerificationSettings(interaction, db);
                break;
        }
    },
};

// Inicializar tabelas
function initVerificationTables(db) {
    db.run(`CREATE TABLE IF NOT EXISTS verification_settings (
        guild_id TEXT PRIMARY KEY,
        verified_role_id TEXT NOT NULL,
        verification_channel_id TEXT NOT NULL,
        log_channel_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        ticket_id TEXT,
        status TEXT DEFAULT 'pending',
        image_url TEXT,
        approved_by TEXT,
        rejected_by TEXT,
        rejection_reason TEXT,
        notes TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
}

async function setupVerification(interaction, db) {
    initVerificationTables(db);
    
    const verifiedRole = interaction.options.getRole('cargo');
    const verificationChannel = interaction.options.getChannel('canal');
    const logChannel = interaction.options.getChannel('logs');
    
    // Verificar se o bot pode gerenciar o cargo
    if (verifiedRole.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ 
            content: '❌ O cargo de verificação deve estar abaixo do meu cargo mais alto na hierarquia!', 
            ephemeral: true 
        });
    }
    
    // Salvar configurações
    db.run(`INSERT OR REPLACE INTO verification_settings 
            (guild_id, verified_role_id, verification_channel_id, log_channel_id) 
            VALUES (?, ?, ?, ?)`,
        [interaction.guild.id, verifiedRole.id, verificationChannel.id, logChannel?.id], 
        async function(err) {
            if (err) {
                console.error(err);
                return interaction.reply({ content: 'Erro ao configurar sistema de verificação!', ephemeral: true });
            }
            
            // Criar painel de verificação
            const embed = new EmbedBuilder()
                .setColor('#00ff7f')
                .setTitle('🛡️ Sistema de Verificação')
                .setDescription(`**Bem-vindo ao sistema de verificação!**\n\nPara ter acesso completo ao servidor, você precisa se verificar.\n\n**Como funciona:**\n1️⃣ Clique no botão abaixo\n2️⃣ Um ticket de verificação será criado\n3️⃣ Nossa equipe irá te ajudar no processo\n4️⃣ Após aprovação, você receberá o cargo ${verifiedRole}\n\n🔒 **Processo seguro e privado**`)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'Sistema de Verificação - Seguro e Confiável' })
                .setTimestamp();
            
            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('start_verification')
                        .setLabel('🛡️ Iniciar Verificação')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🛡️')
                );
            
            try {
                await verificationChannel.send({
                    embeds: [embed],
                    components: [button]
                });
                
                const successEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Sistema de Verificação Configurado')
                    .setDescription(`**Painel enviado para:** ${verificationChannel}\n**Cargo de verificado:** ${verifiedRole}\n${logChannel ? `**Canal de logs:** ${logChannel}` : '**Logs:** Desabilitados'}\n\n🎉 Sistema ativo e funcionando!`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [successEmbed] });
                
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Erro ao enviar painel de verificação!', ephemeral: true });
            }
        });
}

async function approveVerification(interaction, db) {
    const attachment = interaction.options.getAttachment('imagem');
    const observacao = interaction.options.getString('observacao') || '';
    
    // Verificar se está em um ticket
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [interaction.channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ 
                    content: '❌ Este comando só pode ser usado em tickets de verificação!', 
                    ephemeral: true 
                });
            }
            
            // Verificar se existe verificação pendente para este usuário
            db.get(`SELECT * FROM verifications WHERE user_id = ? AND guild_id = ? AND status = 'pending'`,
                [ticket.user_id, interaction.guild.id], async (err, verification) => {
                    if (!verification) {
                        return interaction.reply({ 
                            content: '❌ Não há verificação pendente para este usuário!', 
                            ephemeral: true 
                        });
                    }
                    
                    // Verificar se a imagem é válida
                    if (!attachment.contentType?.startsWith('image/')) {
                        return interaction.reply({ 
                            content: '❌ Por favor, envie uma imagem válida!', 
                            ephemeral: true 
                        });
                    }
                    
                    await interaction.deferReply();
                    
                    try {
                        // Salvar imagem
                        const imageDir = path.join(__dirname, '../../data/verifications');
                        if (!fs.existsSync(imageDir)) {
                            fs.mkdirSync(imageDir, { recursive: true });
                        }
                        
                        const imageExtension = attachment.name.split('.').pop();
                        const imageName = `${verification.id}_${Date.now()}.${imageExtension}`;
                        const imagePath = path.join(imageDir, imageName);
                        
                        // Baixar e salvar imagem
                        const response = await fetch(attachment.url);
                        const buffer = await response.arrayBuffer();
                        fs.writeFileSync(imagePath, Buffer.from(buffer));
                        
                        // Atualizar verificação
                        db.run(`UPDATE verifications 
                                SET status = 'approved', 
                                    image_url = ?, 
                                    approved_by = ?, 
                                    notes = ?,
                                    updated_at = ?
                                WHERE id = ?`,
                            [imagePath, interaction.user.id, observacao, Math.floor(Date.now() / 1000), verification.id]);
                        
                        // Dar cargo ao usuário
                        db.get(`SELECT verified_role_id FROM verification_settings WHERE guild_id = ?`,
                            [interaction.guild.id], async (err, settings) => {
                                if (settings?.verified_role_id) {
                                    const member = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
                                    const verifiedRole = interaction.guild.roles.cache.get(settings.verified_role_id);
                                    
                                    if (member && verifiedRole) {
                                        await member.roles.add(verifiedRole);
                                    }
                                    
                                    // Embed de aprovação
                                    const approvalEmbed = new EmbedBuilder()
                                        .setColor('#00ff00')
                                        .setTitle('✅ Verificação Aprovada')
                                        .setDescription(`**Usuário:** <@${ticket.user_id}>\n**Aprovado por:** ${interaction.user}\n**Cargo concedido:** ${verifiedRole}\n${observacao ? `**Observação:** ${observacao}` : ''}\n\n🎉 Usuário verificado com sucesso!`)
                                        .setImage(attachment.url)
                                        .setTimestamp();
                                    
                                    await interaction.editReply({ embeds: [approvalEmbed] });
                                    
                                    // Notificar usuário
                                    try {
                                        const userEmbed = new EmbedBuilder()
                                            .setColor('#00ff00')
                                            .setTitle('🎉 Verificação Aprovada!')
                                            .setDescription(`Parabéns! Sua verificação foi aprovada em **${interaction.guild.name}**.\n\nVocê agora tem acesso completo ao servidor!\n\n✅ Cargo concedido: ${verifiedRole}`)
                                            .setThumbnail(interaction.guild.iconURL())
                                            .setTimestamp();
                                        
                                        const user = await interaction.client.users.fetch(ticket.user_id);
                                        await user.send({ embeds: [userEmbed] });
                                    } catch (error) {
                                        // Usuário pode ter DMs desabilitadas
                                    }
                                    
                                    // Log da verificação
                                    await logVerification(interaction, ticket.user_id, 'approved', observacao, db);
                                    
                                    // Fechar ticket após 30 segundos
                                    setTimeout(async () => {
                                        try {
                                            await interaction.channel.delete();
                                            db.run(`UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?`,
                                                [Math.floor(Date.now() / 1000), ticket.id]);
                                        } catch (error) {
                                            console.error('Erro ao fechar ticket:', error);
                                        }
                                    }, 30000);
                                }
                            });
                        
                    } catch (error) {
                        console.error(error);
                        await interaction.editReply({ content: 'Erro ao processar verificação!' });
                    }
                });
        });
}

async function rejectVerification(interaction, db) {
    const motivo = interaction.options.getString('motivo');
    
    // Verificar se está em um ticket
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [interaction.channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ 
                    content: '❌ Este comando só pode ser usado em tickets de verificação!', 
                    ephemeral: true 
                });
            }
            
            // Verificar se existe verificação pendente
            db.get(`SELECT * FROM verifications WHERE user_id = ? AND guild_id = ? AND status = 'pending'`,
                [ticket.user_id, interaction.guild.id], async (err, verification) => {
                    if (!verification) {
                        return interaction.reply({ 
                            content: '❌ Não há verificação pendente para este usuário!', 
                            ephemeral: true 
                        });
                    }
                    
                    // Atualizar verificação
                    db.run(`UPDATE verifications 
                            SET status = 'rejected', 
                                rejected_by = ?, 
                                rejection_reason = ?,
                                updated_at = ?
                            WHERE id = ?`,
                        [interaction.user.id, motivo, Math.floor(Date.now() / 1000), verification.id]);
                    
                    // Embed de rejeição
                    const rejectionEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ Verificação Rejeitada')
                        .setDescription(`**Usuário:** <@${ticket.user_id}>\n**Rejeitado por:** ${interaction.user}\n**Motivo:** ${motivo}\n\n⚠️ O usuário pode tentar novamente.`)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [rejectionEmbed] });
                    
                    // Notificar usuário
                    try {
                        const userEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('❌ Verificação Rejeitada')
                            .setDescription(`Sua verificação em **${interaction.guild.name}** foi rejeitada.\n\n**Motivo:** ${motivo}\n\n🔄 Você pode tentar novamente quando estiver pronto.`)
                            .setThumbnail(interaction.guild.iconURL())
                            .setTimestamp();
                        
                        const user = await interaction.client.users.fetch(ticket.user_id);
                        await user.send({ embeds: [userEmbed] });
                    } catch (error) {
                        // Usuário pode ter DMs desabilitadas
                    }
                    
                    // Log da verificação
                    await logVerification(interaction, ticket.user_id, 'rejected', motivo, db);
                    
                    // Fechar ticket após 30 segundos
                    setTimeout(async () => {
                        try {
                            await interaction.channel.delete();
                            db.run(`UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?`,
                                [Math.floor(Date.now() / 1000), ticket.id]);
                        } catch (error) {
                            console.error('Erro ao fechar ticket:', error);
                        }
                    }, 30000);
                });
        });
}

async function checkVerificationStatus(interaction, db) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    
    db.get(`SELECT * FROM verifications WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 1`,
        [user.id, interaction.guild.id], async (err, verification) => {
            
            const embed = new EmbedBuilder()
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();
            
            if (!verification) {
                embed.setColor('#ffff00')
                    .setTitle('⚠️ Sem Verificação')
                    .setDescription(`${user} ainda não iniciou o processo de verificação.`);
            } else {
                const statusEmojis = {
                    'pending': '🕐',
                    'approved': '✅',
                    'rejected': '❌'
                };
                
                const statusColors = {
                    'pending': '#ffff00',
                    'approved': '#00ff00',
                    'rejected': '#ff0000'
                };
                
                embed.setColor(statusColors[verification.status])
                    .setTitle(`${statusEmojis[verification.status]} Status: ${verification.status.toUpperCase()}`)
                    .setDescription(`**Usuário:** ${user}\n**Status:** ${verification.status.toUpperCase()}\n**Criado:** <t:${verification.created_at}:R>\n**Atualizado:** <t:${verification.updated_at}:R>`);
                
                if (verification.status === 'approved') {
                    const approver = await interaction.client.users.fetch(verification.approved_by).catch(() => null);
                    embed.addFields({
                        name: '✅ Aprovação',
                        value: `**Por:** ${approver || 'Usuário não encontrado'}\n${verification.notes ? `**Observação:** ${verification.notes}` : ''}`,
                        inline: false
                    });
                } else if (verification.status === 'rejected') {
                    const rejector = await interaction.client.users.fetch(verification.rejected_by).catch(() => null);
                    embed.addFields({
                        name: '❌ Rejeição',
                        value: `**Por:** ${rejector || 'Usuário não encontrado'}\n**Motivo:** ${verification.rejection_reason}`,
                        inline: false
                    });
                }
            }
            
            await interaction.reply({ embeds: [embed] });
        });
}

async function listPendingVerifications(interaction, db) {
    db.all(`SELECT * FROM verifications WHERE guild_id = ? AND status = 'pending' ORDER BY created_at ASC`,
        [interaction.guild.id], async (err, verifications) => {
            
            const embed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🕐 Verificações Pendentes')
                .setTimestamp();
            
            if (!verifications || verifications.length === 0) {
                embed.setDescription('✅ Nenhuma verificação pendente!');
            } else {
                let description = '';
                for (const verification of verifications.slice(0, 10)) {
                    const user = await interaction.guild.members.fetch(verification.user_id).catch(() => null);
                    const userName = user ? user.displayName : 'Usuário não encontrado';
                    description += `**${userName}** - <t:${verification.created_at}:R>\n`;
                }
                
                embed.setDescription(description);
                if (verifications.length > 10) {
                    embed.setFooter({ text: `Mostrando 10 de ${verifications.length} verificações pendentes` });
                }
            }
            
            await interaction.reply({ embeds: [embed] });
        });
}

async function showVerificationSettings(interaction, db) {
    db.get(`SELECT * FROM verification_settings WHERE guild_id = ?`, [interaction.guild.id], (err, settings) => {
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('⚙️ Configurações de Verificação')
            .setThumbnail(interaction.guild.iconURL())
            .setTimestamp();
        
        if (!settings) {
            embed.setDescription('❌ Sistema de verificação não configurado!\n\nUse `/verification setup` para configurar.');
        } else {
            const verifiedRole = interaction.guild.roles.cache.get(settings.verified_role_id);
            const verificationChannel = interaction.guild.channels.cache.get(settings.verification_channel_id);
            const logChannel = settings.log_channel_id ? interaction.guild.channels.cache.get(settings.log_channel_id) : null;
            
            embed.setDescription(`**🎭 Cargo de verificado:** ${verifiedRole || 'Cargo não encontrado'}\n**📍 Canal de verificação:** ${verificationChannel || 'Canal não encontrado'}\n**📋 Canal de logs:** ${logChannel || 'Não configurado'}\n\n✅ Sistema ativo e funcionando!`);
            
            // Estatísticas
            db.all(`SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
                    FROM verifications WHERE guild_id = ?`, [interaction.guild.id], (err, stats) => {
                
                if (stats && stats[0]) {
                    embed.addFields({
                        name: '📊 Estatísticas',
                        value: `**Total:** ${stats[0].total}\n**Pendentes:** ${stats[0].pending}\n**Aprovadas:** ${stats[0].approved}\n**Rejeitadas:** ${stats[0].rejected}`,
                        inline: true
                    });
                }
                
                interaction.reply({ embeds: [embed] });
            });
        }
    });
}

async function logVerification(interaction, userId, action, details, db) {
    db.get(`SELECT log_channel_id FROM verification_settings WHERE guild_id = ?`,
        [interaction.guild.id], async (err, settings) => {
            if (settings?.log_channel_id) {
                const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(action === 'approved' ? '#00ff00' : '#ff0000')
                        .setTitle(`📋 Verificação ${action === 'approved' ? 'Aprovada' : 'Rejeitada'}`)
                        .setDescription(`**Usuário:** <@${userId}>\n**${action === 'approved' ? 'Aprovado' : 'Rejeitado'} por:** ${interaction.user}\n**${action === 'approved' ? 'Observação' : 'Motivo'}:** ${details}\n**Data:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
        });
}