const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Sistema de tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configurar sistema de tickets')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('Canal onde será enviado o painel de tickets')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('categoria')
                        .setDescription('Categoria onde os tickets serão criados')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true))
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
                .setName('close')
                .setDescription('Fechar ticket atual'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adicionar usuário ao ticket')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para adicionar')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remover usuário do ticket')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para remover')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await setupTickets(interaction, db);
                break;
            case 'close':
                await closeTicket(interaction, db);
                break;
            case 'add':
                await addUserToTicket(interaction, db);
                break;
            case 'remove':
                await removeUserFromTicket(interaction, db);
                break;
        }
    },
};

async function setupTickets(interaction, db) {
    const channel = interaction.options.getChannel('canal');
    const category = interaction.options.getChannel('categoria');
    const supportRole = interaction.options.getRole('suporte');
    const councilRole = interaction.options.getRole('conselho');
    
    // Salvar configurações
    db.run(`INSERT OR REPLACE INTO guild_settings 
            (guild_id, ticket_category_id, support_role_id, council_role_id) 
            VALUES (?, ?, ?, ?)`,
        [interaction.guild.id, category.id, supportRole?.id, councilRole?.id]);
    
    // Criar embed do painel
    const embed = new EmbedBuilder()
        .setColor('#fa32fc')
        .setTitle('🎫 Sistema de Tickets')

        // Mensagem do ticket
.setDescription(`**<:p_tdecorchat4:1385266779475017831> Atendimento Neverland .𝜗𝜚**

<:p_starrosa:1383810818868510790> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_star:1384924354067824834> <:p_starrosa:1383810818868510790>

﹒୨ Bem vinda a nossa central de atendimento!
Esse chat foi criado com o intuito de ajudar vocês dentro do servidor, retirar suas dúvidas, responder denúncias e resolver brigas de dentro do servidor.

-# - Obs: Não tragam problemas de fora do servidor, para dentro de um ticket; simplificando, problemas pessoais de vocês devem ser resolvido no privado ! Não iremos tomar providências por problemas pessoais.

<:p_star:1384924354067824834> ﹒୨ Fichinha:

﹒୨ Nome:
﹒୨ Qual o intuito da abertura do ticket ? 
﹒୨ ~~marque a equipe de atendimento.~~ 

*Aguarde a resposta da nossa equipe!*`)
.setThumbnail(interaction.guild.iconURL())

        .setFooter({ text: 'Sistema de Tickets Privados - Anime & Games' })
        .setTimestamp();
    
    // Criar botões
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket_support')
               .setLabel('🎟️ Abrir Ticket')
                .setStyle(ButtonStyle.Primary),
        );
    
    try {
        await channel.send({
            embeds: [embed],
            components: [buttons]
        });
        
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Sistema Configurado')
            .setDescription(`Painel de tickets enviado para ${channel}!\n\n**Configurações:**\n📁 Categoria: ${category}\n${supportRole ? `🛠️ Suporte: ${supportRole}\n` : ''}${councilRole ? `🏛️ Conselho: ${councilRole}` : ''}`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erro ao configurar sistema de tickets!', ephemeral: true });
    }
}

async function closeTicket(interaction, db) {
    const channel = interaction.channel;
    
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: 'Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            // Verificar permissões
            const member = interaction.member;
            const hasPermission = member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                                  ticket.user_id === member.id;
            
            if (!hasPermission) {
                return interaction.reply({ content: 'Você não tem permissão para fechar este ticket!', ephemeral: true });
            }
            
            // Atualizar banco
            db.run(`UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?`,
                [Math.floor(Date.now() / 1000), ticket.id]);
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔒 Ticket Fechado')
                .setDescription(`Ticket fechado por ${interaction.user}\n\nEste canal será deletado em 10 segundos...`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
            // Log do ticket (se canal de log configurado)
            db.get(`SELECT log_channel_id FROM guild_settings WHERE guild_id = ?`,
                [interaction.guild.id], async (err, settings) => {
                    if (settings?.log_channel_id) {
                        const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('📋 Ticket Fechado')
                                .setDescription(`**ID:** ${ticket.ticket_id}\n**Usuário:** <@${ticket.user_id}>\n**Tipo:** ${ticket.type}\n**Fechado por:** ${interaction.user}\n**Duração:** <t:${ticket.created_at}:R>`)
                                .setTimestamp();
                            
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }
                });
            
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error('Erro ao deletar canal:', error);
                }
            }, 10000);
        });
}

async function addUserToTicket(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const channel = interaction.channel;
    
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: 'Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            try {
                await channel.permissionOverwrites.create(user, {
                    ViewChannel: true,
                    SendMessages: true
                });
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Usuário Adicionado')
                    .setDescription(`${user} foi adicionado ao ticket!`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                await interaction.reply({ content: 'Erro ao adicionar usuário!', ephemeral: true });
            }
        });
}

async function removeUserFromTicket(interaction, db) {
    const user = interaction.options.getUser('usuario');
    const channel = interaction.channel;
    
    db.get(`SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'`,
        [channel.id], async (err, ticket) => {
            if (!ticket) {
                return interaction.reply({ content: 'Este comando só pode ser usado em tickets!', ephemeral: true });
            }
            
            if (user.id === ticket.user_id) {
                return interaction.reply({ content: 'Não é possível remover o criador do ticket!', ephemeral: true });
            }
            
            try {
                await channel.permissionOverwrites.delete(user);
                
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Usuário Removido')
                    .setDescription(`${user} foi removido do ticket!`)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                await interaction.reply({ content: 'Erro ao remover usuário!', ephemeral: true });
            }
        });
}