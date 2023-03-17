const { Client, IntentsBitField, Message } = require('discord.js');
const { token } = require('./config.json');
const { Server } = require('socket.io')
const { EventEmitter } = require("node:events");
const TelegramBot = require('node-telegram-bot-api')

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent]
});


(async () => {
    const { ShitBot } = await import('./src/chats.mjs');
    //const { ChatGPTAPI } = await import('chatgpt');
    // const api = new ChatGPTAPI({
    //     apiKey: openapikey,
    // });
    const et = new EventEmitter();
    const io = new Server();
    const discoBot = new ShitBot({ client, chatGptKey: process.env.OPENAI_API_KEY, io });
    const bot = new TelegramBot();

    console.log(discoBot);

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
    });
    // discord api listens for messageCreate
    // emit if client is a user.

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from bots

        if (message.mentions.has(client.user.id)) {
            et.emit('message', message);
            console.log("made it to messageCreate")
        }
    });

    // send event to shitpot api for 

    et.on('message', async (message) => {
        console.log(`made it to message:${message}`)

        let shitPro = await bot.onText(/^(?:@([^\s]+)\s)?((?:.|\n)+)$/m, async function (msg, [, username, capturedMessage]) {
            if (capturedMessage[0] === '/') return;

            await discoBot.process(msg, username, capturedMessage)
        });

        et.emit('reply', shitPro);

    });

    // send reply to discord api
    // et.on('reply', async (rep) => {
    //     console.log(`REPLY: ${rep}`)
    //     let res = await rep.reply(msg);
    //     msg.reply(`${res.text}`);
    // });

})();


client.login(token);