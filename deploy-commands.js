const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Carregar configuração do arquivo config.json
const config = require('./config.json');

const commands = [];

// Carregar todos os comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[AVISO] O comando em ${filePath} não tem a propriedade "data" ou "execute".`);
        }
    }
}

// Construir e preparar instância da API REST
const rest = new REST().setToken(config.token);

// Deploy dos comandos
(async () => {
    try {
        console.log(`Iniciando refresh de ${commands.length} comandos de aplicação (/).`);

        // Para comandos globais, use esta linha:
        // const data = await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
        
        // Para comandos de servidor específico (mais rápido durante desenvolvimento):
        const data = await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log(`${data.length} comandos de aplicação (/) recarregados com sucesso.`);
    } catch (error) {
        console.error(error);
    }
})();