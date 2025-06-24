const { Client } = require("discord.js");
const config = require("./config.json");
const client = new Client({ intents: ["Guilds"] });
client.login(config.token).then(() => console.log("Token válido!")).catch(err => console.log("Token inválido:", err));
