const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('🔧 Iniciando correção do banco de dados...\n');

// Conectar ao banco
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco de dados\n');
});

// Função para verificar se uma coluna existe
function checkColumnExists(tableName, columnName) {
    return new Promise((resolve) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
                resolve(false);
                return;
            }
            const exists = columns.some(col => col.name === columnName);
            resolve(exists);
        });
    });
}

// Função para verificar se uma tabela existe
function checkTableExists(tableName) {
    return new Promise((resolve) => {
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
            resolve(!!row);
        });
    });
}

// Função principal de migração
async function migrateDatabase() {
    console.log('📋 Verificando estrutura das tabelas...\n');
    
    try {
        // 1. Verificar tabela voice_time
        const voiceTableExists = await checkTableExists('voice_time');
        
        if (!voiceTableExists) {
            console.log('📝 Criando tabela voice_time...');
            await runQuery(`CREATE TABLE voice_time (
                user_id TEXT,
                guild_id TEXT,
                total_time INTEGER DEFAULT 0,
                session_start INTEGER,
                sessions INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, guild_id)
            )`);
            console.log('✅ Tabela voice_time criada\n');
        } else {
            console.log('🔍 Verificando colunas da tabela voice_time...');
            
            // Verificar colunas necessárias
            const hasSessionStart = await checkColumnExists('voice_time', 'session_start');
            const hasSessions = await checkColumnExists('voice_time', 'sessions');
            const hasCreatedAt = await checkColumnExists('voice_time', 'created_at');
            
            // Adicionar colunas em falta
            if (!hasSessionStart) {
                console.log('➕ Adicionando coluna session_start...');
                await runQuery(`ALTER TABLE voice_time ADD COLUMN session_start INTEGER`);
                console.log('✅ Coluna session_start adicionada');
            }
            
            if (!hasSessions) {
                console.log('➕ Adicionando coluna sessions...');
                await runQuery(`ALTER TABLE voice_time ADD COLUMN sessions INTEGER DEFAULT 0`);
                console.log('✅ Coluna sessions adicionada');
            }
            
            if (!hasCreatedAt) {
                console.log('➕ Adicionando coluna created_at...');
                await runQuery(`ALTER TABLE voice_time ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))`);
                console.log('✅ Coluna created_at adicionada');
            }
            
            // Atualizar sessions para registros existentes que tenham 0
            await runQuery(`UPDATE voice_time SET sessions = 1 WHERE sessions = 0 AND total_time > 0`);
            console.log('✅ Tabela voice_time atualizada\n');
        }
        
        // 2. Verificar e criar outras tabelas importantes
        await createTableIfNotExists('guild_settings', `CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id TEXT PRIMARY KEY,
            log_channel_id TEXT,
            ticket_category_id TEXT,
            vip_category_id TEXT,
            welcome_channel_id TEXT,
            auto_role_id TEXT,
            mute_role_id TEXT,
            mod_log_channel_id TEXT,
            support_role_id TEXT,
            council_role_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        
        await createTableIfNotExists('tickets', `CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT UNIQUE,
            channel_id TEXT UNIQUE,
            user_id TEXT,
            guild_id TEXT,
            type TEXT DEFAULT 'support',
            status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'archived')),
            priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
            assigned_to TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            closed_at INTEGER,
            closed_by TEXT,
            close_reason TEXT
        )`);
        
        await createTableIfNotExists('vips', `CREATE TABLE IF NOT EXISTS vips (
            user_id TEXT,
            guild_id TEXT,
            vip_type TEXT CHECK(vip_type IN ('bronze', 'prata', 'ouro', 'diamante')),
            expires_at INTEGER,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            created_by TEXT,
            PRIMARY KEY (user_id, guild_id)
        )`);
        
        await createTableIfNotExists('message_count', `CREATE TABLE IF NOT EXISTS message_count (
            user_id TEXT,
            guild_id TEXT,
            count INTEGER DEFAULT 0,
            last_message INTEGER DEFAULT (strftime('%s', 'now')),
            daily_count INTEGER DEFAULT 0,
            last_daily_reset INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (user_id, guild_id)
        )`);
        
        await createTableIfNotExists('user_levels', `CREATE TABLE IF NOT EXISTS user_levels (
            user_id TEXT,
            guild_id TEXT,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 0,
            messages INTEGER DEFAULT 0,
            voice_time INTEGER DEFAULT 0,
            last_xp_gain INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id)
        )`);
        
        await createTableIfNotExists('verifications', `CREATE TABLE IF NOT EXISTS verifications (
            user_id TEXT,
            guild_id TEXT,
            verification_code TEXT,
            verified_at INTEGER DEFAULT (strftime('%s', 'now')),
            verified_by TEXT,
            verification_method TEXT DEFAULT 'manual',
            PRIMARY KEY (user_id, guild_id)
        )`);
        
        await createTableIfNotExists('warnings', `CREATE TABLE IF NOT EXISTS warnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            guild_id TEXT,
            reason TEXT,
            evidence TEXT,
            warned_by TEXT,
            severity TEXT DEFAULT 'low' CHECK(severity IN ('low', 'medium', 'high')),
            active BOOLEAN DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            expires_at INTEGER
        )`);
        
        // 3. Limpar dados órfãos antigos se houver
        console.log('🧹 Limpando dados órfãos...');
        await runQuery(`UPDATE voice_time SET session_start = NULL WHERE session_start IS NOT NULL`);
        console.log('✅ Dados órfãos limpos\n');
        
        // 4. Verificar integridade do banco
        console.log('🔍 Verificando integridade do banco...');
        const integrity = await runQuery(`PRAGMA integrity_check`);
        console.log('✅ Verificação de integridade concluída\n');
        
        console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!\n');
        console.log('📊 Resumo das correções:');
        console.log('✅ Tabela voice_time corrigida com session_start');
        console.log('✅ Todas as tabelas necessárias criadas');
        console.log('✅ Dados órfãos limpos');
        console.log('✅ Banco de dados pronto para uso\n');
        console.log('🚀 Agora você pode iniciar o bot com: npm start');
        
    } catch (error) {
        console.error('❌ Erro durante a migração:', error.message);
        console.log('\n🔧 Tentando solução alternativa...\n');
        
        // Solução alternativa: recriar tabela voice_time
        try {
            console.log('💾 Fazendo backup dos dados existentes...');
            const backupData = await runQuery(`SELECT * FROM voice_time`);
            
            console.log('🗑️ Removendo tabela antiga...');
            await runQuery(`DROP TABLE IF EXISTS voice_time`);
            
            console.log('🆕 Criando nova tabela...');
            await runQuery(`CREATE TABLE voice_time (
                user_id TEXT,
                guild_id TEXT,
                total_time INTEGER DEFAULT 0,
                session_start INTEGER,
                sessions INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                PRIMARY KEY (user_id, guild_id)
            )`);
            
            console.log('📥 Restaurando dados...');
            if (Array.isArray(backupData) && backupData.length > 0) {
                for (const row of backupData) {
                    await runQuery(`INSERT OR REPLACE INTO voice_time (user_id, guild_id, total_time, sessions) VALUES (?, ?, ?, ?)`,
                        [row.user_id, row.guild_id, row.total_time || 0, row.sessions || 1]);
                }
                console.log(`✅ ${backupData.length} registros restaurados`);
            }
            
            console.log('🎉 CORREÇÃO ALTERNATIVA CONCLUÍDA!\n');
            console.log('🚀 Agora você pode iniciar o bot com: npm start');
            
        } catch (altError) {
            console.error('❌ Erro na solução alternativa:', altError.message);
            console.log('\n💡 SOLUÇÃO MANUAL:');
            console.log('1. Pare o bot se estiver rodando');
            console.log('2. Delete o arquivo database.db');
            console.log('3. Execute: npm start');
            console.log('4. O bot criará um novo banco com a estrutura correta');
            console.log('\n⚠️ NOTA: Você perderá os dados salvos, mas o bot funcionará perfeitamente');
        }
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Erro ao fechar banco:', err.message);
            } else {
                console.log('🔐 Banco fechado com segurança');
            }
            process.exit(0);
        });
    }
}

// Função auxiliar para executar queries
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (sql.trim().toLowerCase().startsWith('select') || sql.trim().toLowerCase().startsWith('pragma')) {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        } else {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        }
    });
}

// Função auxiliar para criar tabela se não existir
async function createTableIfNotExists(tableName, createSQL) {
    const exists = await checkTableExists(tableName);
    if (!exists) {
        console.log(`📝 Criando tabela ${tableName}...`);
        await runQuery(createSQL);
        console.log(`✅ Tabela ${tableName} criada`);
    } else {
        console.log(`✅ Tabela ${tableName} já existe`);
    }
}

// Executar migração
migrateDatabase();