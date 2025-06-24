const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Carregar configuração do arquivo config.json
const config = require('./config.json');

const commands = [];
const commandNames = new Set(); // Usar Set para verificar duplicatas

console.log('🔍 Coletando comandos para deploy...\n');

// Carregar todos os comandos
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
    console.error('❌ Pasta commands não encontrada!');
    console.log('💡 Execute o bot primeiro para criar a estrutura de pastas.');
    process.exit(1);
}

const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    console.log(`📁 Verificando pasta: ${folder}`);
    const folderPath = path.join(commandsPath, folder);
    
    if (!fs.statSync(folderPath).isDirectory()) {
        console.log(`   ⏭️ Pulando arquivo: ${folder}`);
        continue;
    }
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        console.log(`  📄 Carregando: ${file}`);
        
        try {
            // Limpar cache do require para evitar problemas
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                const commandName = command.data.name;
                
                // Verificar duplicatas
                if (commandNames.has(commandName)) {
                    console.log(`    ❌ COMANDO DUPLICADO: ${commandName} (ignorando)`);
                    continue;
                }
                
                commandNames.add(commandName);
                commands.push(command.data.toJSON());
                console.log(`    ✅ ${commandName} - OK`);
            } else {
                console.log(`    ⚠️ INVÁLIDO: ${file} (sem 'data' ou 'execute')`);
            }
        } catch (error) {
            console.log(`    💥 ERRO em ${file}: ${error.message}`);
        }
    }
}

console.log(`\n📊 Resumo:`);
console.log(`✅ Comandos válidos: ${commands.length}`);
console.log(`📝 Lista: ${Array.from(commandNames).join(', ')}`);

if (commands.length === 0) {
    console.error('❌ Nenhum comando válido encontrado!');
    process.exit(1);
}

// Construir e preparar instância da API REST
const rest = new REST().setToken(config.token);

// Deploy dos comandos
(async () => {
    try {
        console.log(`\n🚀 Iniciando deploy de ${commands.length} comandos...`);

        // Verificar se é deploy global ou de servidor específico
        if (config.guildId) {
            console.log(`📍 Deploy para servidor específico: ${config.guildId}`);
            
            // Para comandos de servidor específico (mais rápido durante desenvolvimento)
            const data = await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );

            console.log(`✅ ${data.length} comandos de aplicação (/) deployados com sucesso no servidor!`);
        } else {
            console.log(`🌍 Deploy global (pode levar até 1 hora para aparecer)`);
            
            // Para comandos globais
            const data = await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands }
            );

            console.log(`✅ ${data.length} comandos de aplicação (/) deployados globalmente!`);
        }

        console.log('\n🎉 Deploy concluído com sucesso!');
        console.log('💡 Se os comandos não aparecerem imediatamente, aguarde alguns minutos.');
        
    } catch (error) {
        console.error('\n❌ Erro durante o deploy:');
        
        if (error.code === 50001) {
            console.error('🔑 Erro de permissão: Verifique se o bot tem permissão de "applications.commands"');
        } else if (error.code === 50035) {
            console.error('📝 Erro de validação: Um ou mais comandos têm dados inválidos');
            console.error('Detalhes:', error.errors);
        } else if (error.rawError?.message?.includes('Invalid Form Body')) {
            console.error('📝 Erro de validação nos dados dos comandos');
            console.error('Verifique se todos os comandos têm a estrutura correta');
        } else if (error.status === 401) {
            console.error('🔑 Token inválido ou expirado');
        } else {
            console.error('Erro completo:', error);
        }
        
        process.exit(1);
    }
})();