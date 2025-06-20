const fs = require('fs');
const path = require('path');

const commands = [];
const commandNames = [];

// Carregar todos os comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

console.log('🔍 Verificando comandos...\n');

for (const folder of commandFolders) {
    console.log(`📁 Pasta: ${folder}`);
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        console.log(`  📄 Arquivo: ${file}`);
        
        try {
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                const commandName = command.data.name;
                console.log(`    ✅ Comando: ${commandName}`);
                
                if (commandNames.includes(commandName)) {
                    console.log(`    ❌ DUPLICADO: ${commandName}`);
                } else {
                    commandNames.push(commandName);
                    commands.push(command.data.toJSON());
                }
            } else {
                console.log(`    ⚠️  INVÁLIDO: Sem 'data' ou 'execute'`);
            }
        } catch (error) {
            console.log(`    💥 ERRO: ${error.message}`);
        }
    }
    console.log('');
}

console.log(`📊 Total de comandos válidos: ${commands.length}`);
console.log(`📊 Nomes encontrados: ${commandNames.join(', ')}`);

// Verificar duplicatas
const duplicates = commandNames.filter((name, index) => commandNames.indexOf(name) !== index);
if (duplicates.length > 0) {
    console.log(`❌ COMANDOS DUPLICADOS: ${duplicates.join(', ')}`);
} else {
    console.log('✅ Nenhum comando duplicado encontrado!');
}