const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostrar todos os comandos disponíveis')
        .addStringOption(option =>
            option.setName('comando')
                .setDescription('Comando específico para ver detalhes')
                .setRequired(false)),

    async execute(interaction, db) {
        const comando = interaction.options.getString('comando');
        
        if (comando) {
            await showSpecificCommand(interaction, comando);
        } else {
            await showAllCommands(interaction);
        }
    },
};

async function showSpecificCommand(interaction, commandName) {
    const command = interaction.client.commands.get(commandName);
    
    if (!command) {
        return interaction.reply({ 
            content: `❌ Comando \`${commandName}\` não encontrado!`, 
            ephemeral: true 
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📖 Comando: /${command.data.name}`)
        .setDescription(command.data.description)
        .setTimestamp();
    
    // Adicionar subcomandos se houver
    if (command.data.options && command.data.options.length > 0) {
        const subcommands = command.data.options.filter(option => option.type === 1); // SUB_COMMAND
        
        if (subcommands.length > 0) {
            let subcommandList = '';
            subcommands.forEach(sub => {
                subcommandList += `• \`/${command.data.name} ${sub.name}\` - ${sub.description}\n`;
            });
            
            embed.addFields({
                name: '📋 Subcomandos',
                value: subcommandList,
                inline: false
            });
        }
    }
    
    // Adicionar permissões necessárias
    if (command.data.default_member_permissions) {
        embed.addFields({
            name: '🔒 Permissões Necessárias',
            value: 'Administrador',
            inline: true
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function showAllCommands(interaction) {
    const commands = interaction.client.commands;
    
    // Categorizar comandos
    const categories = {
        'admin': {
            name: '👑 Administração',
            emoji: '👑',
            commands: []
        },
        'moderation': {
            name: '🔨 Moderação',
            emoji: '🔨',
            commands: []
        },
        'utility': {
            name: '🛠️ Utilidade',
            emoji: '🛠️',
            commands: []
        },
        'fun': {
            name: '🎮 Diversão',
            emoji: '🎮',
            commands: []
        },
        'vip': {
            name: '💎 VIP',
            emoji: '💎',
            commands: []
        }
    };
    
    // Organizar comandos por categoria
    commands.forEach(command => {
        // Tentar determinar categoria pelo nome do arquivo/pasta
        let category = 'utility';
        
        if (['painel', 'config', 'debug', 'ticket'].includes(command.data.name)) {
            category = 'admin';
        } else if (['mod', 'ban', 'kick', 'warn'].includes(command.data.name)) {
            category = 'moderation';
        } else if (['vip'].includes(command.data.name)) {
            category = 'vip';
        }
        
        if (categories[category]) {
            categories[category].commands.push(command);
        }
    });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('📚 Central de Comandos')
        .setDescription(`**Bem-vindo ao sistema de ajuda!**\n\nEste bot possui **${commands.size} comandos** organizados em diferentes categorias.\n\n🎛️ **Use o menu abaixo para navegar pelas categorias**\n💡 **Dica:** Use \`/help comando\` para ver detalhes específicos`)
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();
    
    // Adicionar resumo das categorias
    let categorySummary = '';
    Object.entries(categories).forEach(([key, category]) => {
        if (category.commands.length > 0) {
            categorySummary += `${category.emoji} **${category.name}:** ${category.commands.length} comandos\n`;
        }
    });
    
    if (categorySummary) {
        embed.addFields({
            name: '📊 Resumo por Categoria',
            value: categorySummary,
            inline: false
        });
    }
    
    // Criar menu de seleção
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('🔍 Selecione uma categoria para ver os comandos...')
        .addOptions([
            {
                label: 'Visão Geral',
                description: 'Mostrar informações gerais do bot',
                value: 'overview',
                emoji: '📋'
            }
        ]);
    
    // Adicionar categorias com comandos ao menu
    Object.entries(categories).forEach(([key, category]) => {
        if (category.commands.length > 0) {
            selectMenu.addOptions({
                label: category.name,
                description: `${category.commands.length} comandos disponíveis`,
                value: key,
                emoji: category.emoji
            });
        }
    });
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    // Adicionar informações importantes
    embed.addFields(
        {
            name: '🚀 Links Importantes',
            value: '• **Suporte:** Abra um ticket\n• **Configuração:** Use `/painel`\n• **Status:** Use `/stats server`',
            inline: true
        },
        {
            name: '⚡ Comandos Rápidos',
            value: '• `/tempo ranking` - Ver ranking de voz\n• `/stats user` - Suas estatísticas\n• `/ticket setup` - Configurar tickets',
            inline: true
        }
    );
    
    embed.setFooter({ 
        text: `Bot criado para ${interaction.guild.name} • Versão 2.0`, 
        iconURL: interaction.client.user.displayAvatarURL() 
    });
    
    await interaction.reply({ 
        embeds: [embed], 
        components: [row],
        ephemeral: true 
    });
}

// Função para lidar com o menu de seleção (será chamada pelo interaction handler)
async function handleCategorySelect(interaction, categoryId) {
    const categories = {
        'overview': {
            name: '📋 Visão Geral do Bot',
            description: `**${interaction.client.user.username}** é um bot completo para gerenciamento de servidores!\n\n**🎯 Principais Funcionalidades:**\n\n🎤 **Sistema de Tempo de Voz**\n• Rastreamento automático de tempo em calls\n• Rankings e estatísticas detalhadas\n• Recompensas por atividade\n\n🎫 **Sistema de Tickets**\n• Tickets privados para suporte\n• Categorização automática\n• Logs detalhados\n\n👑 **Sistema VIP**\n• Múltiplos níveis de VIP\n• Calls privadas exclusivas\n• Tags personalizadas\n\n🛡️ **Sistema de Verificação**\n• Verificação manual e automática\n• Proteção contra spam\n• Logs de segurança\n\n📊 **Estatísticas Avançadas**\n• Rankings por mensagens e voz\n• Atividade do servidor\n• Dados em tempo real\n\n🔧 **Administração Completa**\n• Painel de configuração\n• Logs de moderação\n• Auto-roles e permissões`,
            commands: []
        },
        'admin': {
            name: '👑 Comandos de Administração',
            description: 'Comandos para configurar e gerenciar o servidor',
            commands: ['painel', 'config', 'debug', 'ticket']
        },
        'moderation': {
            name: '🔨 Comandos de Moderação',
            description: 'Comandos para moderar o servidor',
            commands: ['mod']
        },
        'utility': {
            name: '🛠️ Comandos de Utilidade',
            description: 'Comandos úteis para todos os usuários',
            commands: ['help', 'stats', 'tempo']
        },
        'vip': {
            name: '💎 Comandos VIP',
            description: 'Comandos relacionados ao sistema VIP',
            commands: ['vip']
        }
    };
    
    const category = categories[categoryId];
    if (!category) return;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(category.name)
        .setDescription(category.description)
        .setTimestamp();
    
    if (category.commands.length > 0) {
        let commandList = '';
        
        category.commands.forEach(commandName => {
            const command = interaction.client.commands.get(commandName);
            if (command) {
                commandList += `**/${command.data.name}**\n${command.data.description}\n\n`;
            }
        });
        
        if (commandList) {
            embed.addFields({
                name: '📋 Comandos Disponíveis',
                value: commandList,
                inline: false
            });
        }
    }
    
    embed.setFooter({ 
        text: 'Use /help [comando] para ver detalhes específicos' 
    });
    
    await interaction.update({ embeds: [embed] });
}