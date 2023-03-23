const { Client, IntentsBitField } = require('discord.js');
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

const io = new Server();

class NeedleMouseClient {
    constructor({ client }) {
        this.client = client;
    }

    async payload(message) {
        return {
            message_id: message.id,
            message_thread_id: message.id,
            from: {
                id: message.author.id,
                first_name: message.author.username,
                user_name: message.author.username,
                is_bot: message.author.bot,
            },
            chat: {
                id: message.channel.id,
                type: 'group',
            },
            date: message.createdTimestamp / 1000,
            text: message.content,
        };
    }

    // shitbot processes payload
    async sendMessage(chatId, text) {
        return client.channels.cache.get(chatId).send(text);
    }

}

(async () => {
    //const { NeedleMouseClient } = await import('./disco.js');
    const { ShitBot } = await import('./src/chats.mjs');
    const needleMouse = new NeedleMouseClient({ client });
    const shitBot = new ShitBot({ bot: needleMouse, chatGptKey: process.env.OPENAI_API_KEY, io });


    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);

        console.log(shitBot)
    });


    // on message create

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from bots

        if (message.mentions.has(client.user.id)) {
            const resp = needleMouse.payload(message);
            console.log(resp)
            const chatId = (await resp).chat.id;
            console.log(chatId)
            const cId = (await resp).text;
            console.log(cId)
            needleMouse.sendMessage(chatId, cId);
            //shitBot.process(await needleMouse.sendMessage(message))
            console.log(shitBot)
        }
    });


    // const payload = {
    //     message_id: message.id,
    //     message_thread_id: message.id,
    //     from: {
    //         id: message.author.id,
    //         first_name: message.author.username,
    //         user_name: message.author.username,
    //         is_bot: message.author.bot,
    //     },
    //     chat: {
    //         id: message.channel.id,
    //         type: 'group',
    //     },
    //     date: message.createdTimestamp / 1000,
    //     text: message.content,
    // };



})();


client.login(token);