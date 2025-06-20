const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel')
        .setDescription('Painel de configuração do servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, db) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ Apenas administradores podem usar este comando!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff7f')
            .setTitle('⚙️ Painel de Configuração')
            .setDescription(`**Servidor:** ${interaction.guild.name}\n**Admin:** ${interaction.user}\n\n🎛️ **Configure todos os sistemas do bot:**`)
            .addFields(
                {
                    name: '🎫 Sistema de Tickets',
                    value: 'Configure categorias, cargos e painéis de tickets',
                    inline: true
                },
                {
                    name: '🔨 Moderação',
                    value: 'Configure canal de logs para moderação',
                    inline: true
                },
                {
                    name: '👑 Sistema VIP',
                    value: 'Configure cargos VIP e benefícios',
                    inline: true
                },
                {
                    name: '🛡️ Verificação',
                    value: 'Configure sistema de verificação',
                    inline: true
                },
                {
                    name: '📋 Painéis',
                    value: 'Criar painéis interativos',
                    inline: true
                },
                {
                    name: '📊 Status',
                    value: 'Ver estatísticas completas',
                    inline: true
                }
            )
            .setThumbnail(interaction.guild.iconURL())
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('config_tickets')
                    .setLabel('🎫 Tickets')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('config_moderation')
                    .setLabel('🔨 Moderação')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('config_vip')
                    .setLabel('👑 VIP')
                    .setStyle(ButtonStyle.Success)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('config_verification')
                    .setLabel('🛡️ Verificação')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('config_panels')
                    .setLabel('📋 Painéis')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('config_status')
                    .setLabel('📊 Status')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            ephemeral: true
        });
    }
};