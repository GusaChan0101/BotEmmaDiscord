const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vip')
        .setDescription('Gerenciar sistema VIP')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adicionar VIP a um usuário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para receber VIP')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de VIP')
                        .setRequired(true)
                        .addChoices(
                            { name: 'VIP Bronze', value: 'bronze' },
                            { name: 'VIP Prata', value: 'prata' },
                            { name: 'VIP Ouro', value: 'ouro' },
                            { name: 'VIP Diamante', value: 'diamante' }
                        ))
                .addIntegerOption(option =>
                    option.setName('dias')
                        .setDescription('Duração em dias (0 = permanente)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remover VIP de um usuário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para remover VIP')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Listar todos os VIPs ativos'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Verificar status VIP de um usuário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para verificar')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configurar cargos VIP')
                .addRoleOption(option =>
                    option.setName('bronze')
                        .setDescription('Cargo para VIP Bronze')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('prata')
                        .setDescription('Cargo para VIP Prata')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('ouro')
                        .setDescription('Cargo para VIP Ouro')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('diamante')
                        .setDescription('Cargo para VIP Diamante')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configurar sistema VIP completo')
                .addChannelOption(option =>
                    option.setName('categoria')
                        .setDescription('Categoria para calls VIP')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('call')
                .setDescription('Criar call privada VIP')
                .addStringOption(option =>
                    option.setName('nome')
                        .setDescription('Nome da call privada')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('convidar')
                        .setDescription('Convidar outro usuário')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('tag')
                .setDescription('Definir tag VIP personalizada')
                .addStringOption(option =>
                    option.setName('tag')
                        .setDescription('Sua tag exclusiva (máx 20 caracteres)')
                        .setMaxLength(20)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Verificar e corrigir VIPs expirados'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('settings')
                .setDescription('Ver configurações atuais do sistema VIP'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, db) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await addVip(interaction, db);
                break;
            case 'remove':
                await removeVip(interaction, db);
                break;
            case 'list':
                await listVips(interaction, db);
                break;
            case 'check':
                await checkVip(interaction, db);
                break;
            case 'config':
                await configVipRoles(interaction, db);
                break;
            case 'setup':
                await setupVipSystem(interaction, db);
                break;
            case 'call':
                await createVipCall(interaction, db);
                break;
            case 'tag':
                await setVipTag(interaction, db);
                break;
            case 'verify':
                await verifyVips(interaction, db);
                break;
            case 'settings':
                await showVipSettings(interaction, db);
                break;
        }
    },
};

// Criar tabelas necessárias
function initVipTables(db) {
    db.run(`CREATE TABLE IF NOT EXISTS vip_roles (
        guild_id TEXT NOT NULL,
        vip_type TEXT NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY(guild_id, vip_type)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS vip_settings (
        guild_id TEXT PRIMARY KEY,
        vip_category_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS vip_tags (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY(user_id, guild_id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS vip_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`);
}

async function addVip(interaction, db) {
    initVipTables(db);
    
    const user = interaction.options.getUser('usuario');
    const tipo = interaction.options.getString('tipo');
    const dias = interaction.options.getInteger('dias');
    
    const expiresAt = dias > 0 ? Math.floor(Date.now() / 1000) + (dias * 24 * 60 * 60) : null;
    
    // Remover VIP anterior se existir
    db.run(`DELETE FROM vips WHERE user_id = ? AND guild_id = ?`, [user.id, interaction.guild.id]);
    
    // Adicionar novo VIP
    db.run(`INSERT INTO vips (user_id, guild_id, vip_type, expires_at) VALUES (?, ?, ?, ?)`,
        [user.id, interaction.guild.id, tipo, expiresAt], async function(err) {
            if (err) {
                return interaction.reply({ content: 'Erro ao adicionar VIP!', ephemeral: true });
            }
            
            // Buscar cargo configurado para este tipo de VIP
            db.get(`SELECT role_id FROM vip_roles WHERE guild_id = ? AND vip_type = ?`,
                [interaction.guild.id, tipo], async (err, roleConfig) => {
                    
                    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                    
                    if (member && roleConfig?.role_id) {
                        const vipRole = interaction.guild.roles.cache.get(roleConfig.role_id);
                        if (vipRole) {
                            // Remover outros cargos VIP primeiro
                            await removeAllVipRoles(member, interaction.guild.id, db);
                            // Adicionar novo cargo VIP
                            await member.roles.add(vipRole);
                        }
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor(getVipColor(tipo))
                        .setTitle('✅ VIP Adicionado')
                        .setDescription(`**Usuário:** ${user}\n**Tipo:** ${getVipEmoji(tipo)} ${tipo.toUpperCase()}\n**Duração:** ${dias > 0 ? `${dias} dias` : 'Permanente'}\n**Cargo:** ${roleConfig?.role_id ? `<@&${roleConfig.role_id}>` : 'Não configurado'}\n\n🎉 **Benefícios desbloqueados:**\n🔊 Criar calls privadas\n🏷️ Tag personalizada\n👑 Acesso VIP exclusivo`)
                        .setThumbnail(user.displayAvatarURL())
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed] });
                });
        });
}

async function setupVipSystem(interaction, db) {
    initVipTables(db);
    
    const category = interaction.options.getChannel('categoria');
    
    // Salvar configurações
    db.run(`INSERT OR REPLACE INTO vip_settings (guild_id, vip_category_id) VALUES (?, ?)`,
        [interaction.guild.id, category.id], async function(err) {
            if (err) {
                return interaction.reply({ content: 'Erro ao configurar sistema VIP!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('⚙️ Sistema VIP Configurado')
                .setDescription(`**Categoria VIP:** ${category}\n\n✅ VIPs agora podem:\n🔊 Criar calls privadas\n🏷️ Definir tags personalizadas\n👑 Acessar recursos exclusivos`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        });
}

async function createVipCall(interaction, db) {
    // Verificar se o usuário é VIP
    db.get(`SELECT * FROM vips WHERE user_id = ? AND guild_id = ?`,
        [interaction.user.id, interaction.guild.id], async (err, vip) => {
            if (!vip) {
                return interaction.reply({ content: '❌ Apenas VIPs podem criar calls privadas!', ephemeral: true });
            }
            
            const isExpired = vip.expires_at && vip.expires_at < Math.floor(Date.now() / 1000);
            if (isExpired) {
                return interaction.reply({ content: '❌ Seu VIP expirou! Renove para usar este recurso.', ephemeral: true });
            }
            
            const nome = interaction.options.getString('nome');
            const convidado = interaction.options.getUser('convidar');
            
            // Verificar se já tem call VIP
            db.get(`SELECT * FROM vip_calls WHERE owner_id = ? AND guild_id = ?`,
                [interaction.user.id, interaction.guild.id], async (err, existingCall) => {
                    if (existingCall) {
                        const existingChannel = interaction.guild.channels.cache.get(existingCall.channel_id);
                        if (existingChannel) {
                            return interaction.reply({ 
                                content: `❌ Você já tem uma call VIP ativa: ${existingChannel}\n\nUse \`/vipcall rename\` para renomear ou \`/vipcall delete\` para deletar.`, 
                                ephemeral: true 
                            });
                        } else {
                            // Canal não existe mais, remover do banco
                            db.run(`DELETE FROM vip_calls WHERE id = ?`, [existingCall.id]);
                        }
                    }
                    
                    // Buscar categoria VIP
                    db.get(`SELECT vip_category_id FROM vip_settings WHERE guild_id = ?`,
                        [interaction.guild.id], async (err, settings) => {
                            if (!settings?.vip_category_id) {
                                return interaction.reply({ content: '❌ Sistema VIP não configurado! Use `/vip setup` primeiro.', ephemeral: true });
                            }
                            
                            try {
                                // Permissões da call privada PERMANENTE
                                const permissionOverwrites = [
                                    {
                                        id: interaction.guild.id, // @everyone
                                        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                                    },
                                    {
                                        id: interaction.user.id, // Criador
                                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],
                                    }
                                ];
                                
                                // Adicionar convidado se especificado
                                if (convidado) {
                                    permissionOverwrites.push({
                                        id: convidado.id,
                                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                                    });
                                }
                                
                                // Criar canal de voz PERMANENTE
                                const voiceChannel = await interaction.guild.channels.create({
                                    name: `🔊${getVipEmoji(vip.vip_type)} ${nome}`,
                                    type: ChannelType.GuildVoice,
                                    parent: settings.vip_category_id,
                                    permissionOverwrites: permissionOverwrites,
                                    userLimit: 0 // Sem limite de usuários
                                });
                                
                                // Salvar no banco
                                db.run(`INSERT INTO vip_calls (channel_id, owner_id, guild_id, name) VALUES (?, ?, ?, ?)`,
                                    [voiceChannel.id, interaction.user.id, interaction.guild.id, nome]);
                                
                                const embed = new EmbedBuilder()
                                    .setColor(getVipColor(vip.vip_type))
                                    .setTitle('🔊 Call VIP Permanente Criada')
                                    .setDescription(`**Nome:** ${nome}\n**Canal:** ${voiceChannel}\n**Criador:** ${interaction.user}\n${convidado ? `**Convidado:** ${convidado}\n` : ''}**Tipo VIP:** ${getVipEmoji(vip.vip_type)} ${vip.vip_type.toUpperCase()}\n\n🔒 **Call completamente privada e permanente!**\n♾️ Esta call ficará ativa enquanto você for VIP.\n\n**Comandos disponíveis:**\n• \`/vipcall invite\` - Convidar usuários\n• \`/vipcall kick\` - Remover usuários\n• \`/vipcall rename\` - Renomear call\n• \`/vipcall delete\` - Deletar call (se desejar)`)
                                    .setTimestamp();
                                
                                await interaction.reply({ embeds: [embed] });
                                
                            } catch (error) {
                                console.error(error);
                                await interaction.reply({ content: 'Erro ao criar call VIP!', ephemeral: true });
                            }
                        });
                });
        });
}

async function setVipTag(interaction, db) {
    // Verificar se o usuário é VIP
    db.get(`SELECT * FROM vips WHERE user_id = ? AND guild_id = ?`,
        [interaction.user.id, interaction.guild.id], async (err, vip) => {
            if (!vip) {
                return interaction.reply({ content: '❌ Apenas VIPs podem definir tags personalizadas!', ephemeral: true });
            }
            
            const isExpired = vip.expires_at && vip.expires_at < Math.floor(Date.now() / 1000);
            if (isExpired) {
                return interaction.reply({ content: '❌ Seu VIP expirou! Renove para usar este recurso.', ephemeral: true });
            }
            
            const tag = interaction.options.getString('tag');
            
            // Verificar se a tag já existe
            db.get(`SELECT * FROM vip_tags WHERE tag = ? AND guild_id = ? AND user_id != ?`,
                [tag, interaction.guild.id, interaction.user.id], async (err, existingTag) => {
                    if (existingTag) {
                        return interaction.reply({ content: '❌ Esta tag já está sendo usada por outro VIP!', ephemeral: true });
                    }
                    
                    // Salvar/atualizar tag
                    db.run(`INSERT OR REPLACE INTO vip_tags (user_id, guild_id, tag) VALUES (?, ?, ?)`,
                        [interaction.user.id, interaction.guild.id, tag], async function(err) {
                            if (err) {
                                return interaction.reply({ content: 'Erro ao definir tag!', ephemeral: true });
                            }
                            
                            const embed = new EmbedBuilder()
                                .setColor(getVipColor(vip.vip_type))
                                .setTitle('🏷️ Tag VIP Definida')
                                .setDescription(`**Usuário:** ${interaction.user}\n**Tag:** \`${tag}\`\n**Tipo VIP:** ${getVipEmoji(vip.vip_type)} ${vip.vip_type.toUpperCase()}\n\n✨ Sua tag exclusiva foi definida!`)
                                .setThumbnail(interaction.user.displayAvatarURL())
                                .setTimestamp();
                            
                            await interaction.reply({ embeds: [embed] });
                        });
                });
        });
}

async function removeVip(interaction, db) {
    const user = interaction.options.getUser('usuario');
    
    db.run(`DELETE FROM vips WHERE user_id = ? AND guild_id = ?`,
        [user.id, interaction.guild.id], async function(err) {
            if (err || this.changes === 0) {
                return interaction.reply({ content: 'Usuário não possui VIP ativo!', ephemeral: true });
            }
            
            // Remover todos os cargos VIP
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (member) {
                await removeAllVipRoles(member, interaction.guild.id, db);
            }
            
            // Remover tag VIP
            db.run(`DELETE FROM vip_tags WHERE user_id = ? AND guild_id = ?`, [user.id, interaction.guild.id]);
            
            // Manter calls VIP mas remover permissões de administração
            db.all(`SELECT channel_id FROM vip_calls WHERE owner_id = ? AND guild_id = ?`,
                [user.id, interaction.guild.id], async (err, calls) => {
                    if (calls) {
                        for (const call of calls) {
                            const channel = interaction.guild.channels.cache.get(call.channel_id);
                            if (channel) {
                                try {
                                    // Remover permissões de administração, mas manter acesso básico
                                    await channel.permissionOverwrites.edit(user.id, {
                                        ViewChannel: true,
                                        Connect: true,
                                        ManageChannels: false,
                                        MoveMembers: false
                                    });
                                    
                                    // Renomear canal para indicar que não é mais VIP
                                    const currentName = channel.name;
                                    const newName = currentName.replace(/🔊[🥉🥈🥇💎]/g, '🔊❌');
                                    await channel.setName(newName);
                                } catch (error) {
                                    console.error('Erro ao atualizar call:', error);
                                }
                            }
                        }
                    }
                });
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ VIP Removido')
                .setDescription(`VIP removido de ${user}\n\n🏷️ Tag personalizada removida\n🔊 Calls mantidas mas sem privilégios VIP\n⚠️ Calls marcadas como ex-VIP`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        });
}

async function listVips(interaction, db) {
    db.all(`SELECT v.*, t.tag FROM vips v LEFT JOIN vip_tags t ON v.user_id = t.user_id AND v.guild_id = t.guild_id WHERE v.guild_id = ? ORDER BY v.created_at DESC`,
        [interaction.guild.id], async (err, vips) => {
            if (err || vips.length === 0) {
                return interaction.reply({ content: 'Nenhum VIP ativo encontrado!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('👑 Lista de VIPs Ativos')
                .setTimestamp();
            
            let description = '';
            for (const vip of vips.slice(0, 10)) {
                const user = await interaction.guild.members.fetch(vip.user_id).catch(() => null);
                const userName = user ? user.displayName : 'Usuário não encontrado';
                const expiration = vip.expires_at ? 
                    `<t:${vip.expires_at}:R>` : 'Permanente';
                const tag = vip.tag ? ` \`${vip.tag}\`` : '';
                
                description += `${getVipEmoji(vip.vip_type)} **${userName}**${tag} - ${vip.vip_type.toUpperCase()}\nExpira: ${expiration}\n\n`;
            }
            
            embed.setDescription(description);
            if (vips.length > 10) {
                embed.setFooter({ text: `Mostrando 10 de ${vips.length} VIPs` });
            }
            
            await interaction.reply({ embeds: [embed] });
        });
}

async function checkVip(interaction, db) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    
    db.get(`SELECT v.*, t.tag FROM vips v LEFT JOIN vip_tags t ON v.user_id = t.user_id AND v.guild_id = t.guild_id WHERE v.user_id = ? AND v.guild_id = ?`,
        [user.id, interaction.guild.id], async (err, vip) => {
            const embed = new EmbedBuilder()
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();
            
            if (!vip) {
                embed.setColor('#ff0000')
                    .setTitle('❌ Sem VIP')
                    .setDescription(`${user} não possui VIP ativo.`);
            } else {
                const isExpired = vip.expires_at && vip.expires_at < Math.floor(Date.now() / 1000);
                
                embed.setColor(isExpired ? '#ff0000' : getVipColor(vip.vip_type))
                    .setTitle(isExpired ? '⏰ VIP Expirado' : `✅ VIP ${vip.vip_type.toUpperCase()}`)
                    .setDescription(`**Usuário:** ${user}\n**Tipo:** ${getVipEmoji(vip.vip_type)} ${vip.vip_type.toUpperCase()}\n**Status:** ${isExpired ? 'Expirado' : 'Ativo'}\n**Expira:** ${vip.expires_at ? `<t:${vip.expires_at}:R>` : 'Permanente'}\n${vip.tag ? `**Tag:** \`${vip.tag}\`` : '**Tag:** Não definida'}\n\n🎉 **Benefícios VIP:**\n🔊 Criar calls privadas\n🏷️ Tag personalizada\n👑 Acesso exclusivo`);
                
                if (isExpired) {
                    // Remover VIP expirado
                    db.run(`DELETE FROM vips WHERE id = ?`, [vip.id]);
                    db.run(`DELETE FROM vip_tags WHERE user_id = ? AND guild_id = ?`, [user.id, interaction.guild.id]);
                    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                    if (member) {
                        await removeAllVipRoles(member, interaction.guild.id, db);
                    }
                }
            }
            
            await interaction.reply({ embeds: [embed] });
        });
}

async function configVipRoles(interaction, db) {
    initVipTables(db);
    
    const bronzeRole = interaction.options.getRole('bronze');
    const prataRole = interaction.options.getRole('prata');
    const ouroRole = interaction.options.getRole('ouro');
    const diamanteRole = interaction.options.getRole('diamante');
    
    const roles = [
        { type: 'bronze', role: bronzeRole },
        { type: 'prata', role: prataRole },
        { type: 'ouro', role: ouroRole },
        { type: 'diamante', role: diamanteRole }
    ];
    
    let configured = [];
    
    for (const { type, role } of roles) {
        if (role) {
            db.run(`INSERT OR REPLACE INTO vip_roles (guild_id, vip_type, role_id) VALUES (?, ?, ?)`,
                [interaction.guild.id, type, role.id]);
            configured.push(`${getVipEmoji(type)} **${type.toUpperCase()}:** ${role}`);
        }
    }
    
    if (configured.length === 0) {
        return interaction.reply({ content: 'Você deve especificar pelo menos um cargo!', ephemeral: true });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('⚙️ Cargos VIP Configurados')
        .setDescription(configured.join('\n'))
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function verifyVips(interaction, db) {
    await interaction.deferReply();
    
    const now = Math.floor(Date.now() / 1000);
    
    // Buscar VIPs expirados
    db.all(`SELECT * FROM vips WHERE guild_id = ? AND expires_at IS NOT NULL AND expires_at < ?`,
        [interaction.guild.id, now], async (err, expiredVips) => {
            
            let removed = 0;
            let callsUpdated = 0;
            
            for (const vip of expiredVips) {
                // Remover do banco
                db.run(`DELETE FROM vips WHERE id = ?`, [vip.id]);
                db.run(`DELETE FROM vip_tags WHERE user_id = ? AND guild_id = ?`, [vip.user_id, interaction.guild.id]);
                
                // Remover cargos
                const member = await interaction.guild.members.fetch(vip.user_id).catch(() => null);
                if (member) {
                    await removeAllVipRoles(member, interaction.guild.id, db);
                }
                
                // Atualizar calls VIP (manter mas remover privilégios)
                db.all(`SELECT channel_id FROM vip_calls WHERE owner_id = ? AND guild_id = ?`,
                    [vip.user_id, interaction.guild.id], async (err, calls) => {
                        if (calls) {
                            for (const call of calls) {
                                const channel = interaction.guild.channels.cache.get(call.channel_id);
                                if (channel) {
                                    try {
                                        // Remover permissões de administração
                                        await channel.permissionOverwrites.edit(vip.user_id, {
                                            ViewChannel: true,
                                            Connect: true,
                                            ManageChannels: false,
                                            MoveMembers: false
                                        });
                                        
                                        // Marcar como ex-VIP
                                        const currentName = channel.name;
                                        const newName = currentName.replace(/🔊[🥉🥈🥇💎]/g, '🔊❌');
                                        await channel.setName(newName);
                                        
                                        callsUpdated++;
                                    } catch (error) {
                                        console.error('Erro ao atualizar call:', error);
                                    }
                                }
                            }
                        }
                    });
                
                removed++;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('🔍 Verificação de VIPs')
                .setDescription(`**VIPs expirados removidos:** ${removed}\n**VIPs ativos verificados:** ✅\n**Calls atualizadas:** ${callsUpdated}\n**Tags removidas:** ${removed}\n\n♾️ **Calls mantidas permanentemente**\n❌ **Calls marcadas como ex-VIP**`)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        });
}

async function showVipSettings(interaction, db) {
    initVipTables(db);
    
    db.all(`SELECT * FROM vip_roles WHERE guild_id = ?`, [interaction.guild.id], async (err, roles) => {
        db.get(`SELECT * FROM vip_settings WHERE guild_id = ?`, [interaction.guild.id], async (err, settings) => {
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚙️ Configurações do Sistema VIP')
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp();
            
            let description = '';
            
            // Categoria VIP
            if (settings?.vip_category_id) {
                const category = interaction.guild.channels.cache.get(settings.vip_category_id);
                description += `**📁 Categoria VIP:** ${category || 'Não encontrada'}\n\n`;
            } else {
                description += '**📁 Categoria VIP:** ❌ Não configurada\n\n';
            }
            
            // Cargos configurados
            if (!roles || roles.length === 0) {
                description += '**🎭 Cargos VIP:** ❌ Nenhum configurado\n\n';
            } else {
                description += '**🎭 Cargos configurados:**\n';
                for (const roleConfig of roles) {
                    const role = interaction.guild.roles.cache.get(roleConfig.role_id);
                    description += `${getVipEmoji(roleConfig.vip_type)} **${roleConfig.vip_type.toUpperCase()}:** ${role || 'Cargo não encontrado'}\n`;
                }
                description += '\n';
            }
            
            // Estatísticas
            db.all(`SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN expires_at IS NULL THEN 1 END) as permanent,
                        COUNT(CASE WHEN expires_at IS NOT NULL THEN 1 END) as temporary
                    FROM vips WHERE guild_id = ?`, [interaction.guild.id], (err, stats) => {
                
                db.get(`SELECT COUNT(*) as tags FROM vip_tags WHERE guild_id = ?`, [interaction.guild.id], (err, tagStats) => {
                    db.get(`SELECT COUNT(*) as calls FROM vip_calls WHERE guild_id = ?`, [interaction.guild.id], (err, callStats) => {
                        
                        description += `**📊 Estatísticas:**\n👑 Total de VIPs: ${stats[0]?.total || 0}\n⏰ Temporários: ${stats[0]?.temporary || 0}\n♾️ Permanentes: ${stats[0]?.permanent || 0}\n🏷️ Tags ativas: ${tagStats?.tags || 0}\n🔊 Calls ativas: ${callStats?.calls || 0}`;
                        
                        embed.setDescription(description);
                        interaction.reply({ embeds: [embed] });
                    });
                });
            });
        });
    });
}

// Funções auxiliares
async function removeAllVipRoles(member, guildId, db) {
    db.all(`SELECT role_id FROM vip_roles WHERE guild_id = ?`, [guildId], async (err, roles) => {
        if (roles) {
            for (const roleConfig of roles) {
                const role = member.guild.roles.cache.get(roleConfig.role_id);
                if (role && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role).catch(() => {});
                }
            }
        }
    });
}

function getVipColor(type) {
    const colors = {
        'bronze': '#CD7F32',
        'prata': '#C0C0C0',
        'ouro': '#FFD700',
        'diamante': '#B9F2FF'
    };
    return colors[type] || '#ffd700';
}

function getVipEmoji(type) {
    const emojis = {
        'bronze': '🥉',
        'prata': '🥈',
        'ouro': '🥇',
        'diamante': '💎'
    };
    return emojis[type] || '👑';
}