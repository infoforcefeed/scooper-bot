const { Client, IntentsBitField, Message } = require('discord.js');
const { token } = require('./config.json');
const { Server } = require('socket.io')
const { EventEmitter } = require("node:events");
const TelegramBot = require('node-telegram-bot-api');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent]
});

const et = new EventEmitter();
const io = new Server();
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

(async () => {
    const { ShitBot } = await import('./src/chats.mjs');
    const discoBot = new ShitBot({ bot, chatGptKey: process.env.OPENAI_API_KEY, io });
    //const { ChatGPTAPI } = await import('chatgpt');
    // const api = new ChatGPTAPI({
    //     apiKey: openapikey,
    // });


    console.log(discoBot);

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
    });
    // discord api listens for messageCreate
    // emit if client is a user.

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from bots

        if (message.mentions.has(client.user.id)) {
            et.emit('msg', message, client.user.id, bot);
            console.log(`discord api emitted ${message}, ${client.user.id}`)
        }
    });

    // send event to shitpot api with message


    et.on('msg', async (message) => {
        console.log(`made it to shitbot with message:${message}`)

        const regx = /^(?:@([^\s]+)\s)?((?:.|\n)+)$/m.exec(message);
        if (regx) {
            const capturedMessage = regx[2];
            if (capturedMessage[0] === '/') return;
            console.log('OnText')

            const discoGram = {
                message_id: message.id,
                from: {
                    id: message.author.id,
                    first_name: message.author.username,
                },
                chat: {
                    id: message.channel.id,
                    type: 'group',
                },
                date: message.createdTimestamp / 1000,
                text: capturedMessage,
            };

            const processed = await discoBot.process(discoGram, client.user.id, capturedMessage);

            et.emit('result', processed, message);
        }

    });

    // send reply to discord api
    et.on('result', async (processed, message) => {
        console.log('why god', processed, message.content);


    });

})();


client.login(token);