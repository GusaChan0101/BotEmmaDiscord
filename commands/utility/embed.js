const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Criar e enviar embeds personalizados')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Criar um embed usando modal'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('quick')
                .setDescription('Criar embed rápido')
                .addStringOption(option =>
                    option.setName('titulo')
                        .setDescription('Título do embed')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('descricao')
                        .setDescription('Descrição do embed')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('cor')
                        .setDescription('Cor do embed (hex)')
                        .setRequired(false))
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('Canal para enviar (padrão: atual)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('anime')
                .setDescription('Embed temático de anime')
                .addStringOption(option =>
                    option.setName('anime')
                        .setDescription('Nome do anime')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('descricao')
                        .setDescription('Descrição sobre o anime')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('imagem')
                        .setDescription('URL da imagem')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('game')
                .setDescription('Embed temático de jogo')
                .addStringOption(option =>
                    option.setName('jogo')
                        .setDescription('Nome do jogo')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('descricao')
                        .setDescription('Descrição sobre o jogo')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('imagem')
                        .setDescription('URL da imagem')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'create':
                await createEmbedModal(interaction);
                break;
            case 'quick':
                await quickEmbed(interaction);
                break;
            case 'anime':
                await animeEmbed(interaction);
                break;
            case 'game':
                await gameEmbed(interaction);
                break;
        }
    },
};

async function createEmbedModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('embed_modal')
        .setTitle('Criador de Embed');

    const titleInput = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel('Título')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(false);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('embed_description')
        .setLabel('Descrição')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(4000)
        .setRequired(true);

    const colorInput = new TextInputBuilder()
        .setCustomId('embed_color')
        .setLabel('Cor (hex - ex: #FF0000)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(7)
        .setRequired(false)
        .setPlaceholder('#0099ff');

    const imageInput = new TextInputBuilder()
        .setCustomId('embed_image')
        .setLabel('URL da Imagem')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://exemplo.com/imagem.png');

    const footerInput = new TextInputBuilder()
        .setCustomId('embed_footer')
        .setLabel('Rodapé')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2048)
        .setRequired(false);

    const titleRow = new ActionRowBuilder().addComponents(titleInput);
    const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
    const colorRow = new ActionRowBuilder().addComponents(colorInput);
    const imageRow = new ActionRowBuilder().addComponents(imageInput);
    const footerRow = new ActionRowBuilder().addComponents(footerInput);

    modal.addComponents(titleRow, descriptionRow, colorRow, imageRow, footerRow);

    await interaction.showModal(modal);
}

async function quickEmbed(interaction) {
    const titulo = interaction.options.getString('titulo');
    const descricao = interaction.options.getString('descricao');
    const cor = interaction.options.getString('cor') || '#0099ff';
    const canal = interaction.options.getChannel('canal') || interaction.channel;

    try {
        const embed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(descricao)
            .setColor(cor)
            .setTimestamp()
            .setFooter({ text: `Criado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await canal.send({ embeds: [embed] });
        await interaction.reply({ content: `Embed enviado em ${canal}!`, ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: 'Erro ao criar embed! Verifique a cor fornecida.', ephemeral: true });
    }
}

async function animeEmbed(interaction) {
    const anime = interaction.options.getString('anime');
    const descricao = interaction.options.getString('descricao');
    const imagem = interaction.options.getString('imagem');

    const embed = new EmbedBuilder()
        .setTitle(`🎌 ${anime}`)
        .setDescription(descricao)
        .setColor('#FF69B4')
        .setTimestamp()
        .setFooter({ text: 'Anime & Games Server', iconURL: interaction.guild.iconURL() });

    if (imagem) {
        try {
            embed.setImage(imagem);
        } catch (error) {
            // Se a URL da imagem for inválida, continua sem a imagem
        }
    }

    // Adicionar campos temáticos
    embed.addFields(
        { name: '📺 Gênero', value: 'Anime', inline: true },
        { name: '⭐ Recomendação', value: 'Confira este anime!', inline: true },
        { name: '🎭 Status', value: 'Recomendado pela comunidade', inline: true }
    );

    try {
        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Embed de anime criado com sucesso!', ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: 'Erro ao criar embed!', ephemeral: true });
    }
}

async function gameEmbed(interaction) {
    const jogo = interaction.options.getString('jogo');
    const descricao = interaction.options.getString('descricao');
    const imagem = interaction.options.getString('imagem');

    const embed = new EmbedBuilder()
        .setTitle(`🎮 ${jogo}`)
        .setDescription(descricao)
        .setColor('#00FF7F')
        .setTimestamp()
        .setFooter({ text: 'Anime & Games Server', iconURL: interaction.guild.iconURL() });

    if (imagem) {
        try {
            embed.setImage(imagem);
        } catch (error) {
            // Se a URL da imagem for inválida, continua sem a imagem
        }
    }

    // Adicionar campos temáticos
    embed.addFields(
        { name: '🎯 Categoria', value: 'Game', inline: true },
        { name: '🏆 Recomendação', value: 'Vale a pena jogar!', inline: true },
        { name: '🎪 Status', value: 'Aprovado pela comunidade', inline: true }
    );

    try {
        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Embed de jogo criado com sucesso!', ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: 'Erro ao criar embed!', ephemeral: true });
    }
}