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

    });


    // on message create

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from bots

        if (message.mentions.has(client.user.id)) {
            const msg = {
                chat: {
                    id: parseInt(message.id),
                    type: "private", // Replace this with the actual chat type, e.g. "private", "group", etc.
                },
                message_id: parseInt(message.id), // Replace this with the actual message ID
                message_thread_id: parseInt(message.id), // Replace this with the actual message thread ID, if available
                reply_to_message: {
                    message_id: parseInt(message.id), // Replace this with the actual message ID of the replied-to message, if applicable
                },
            };

            console.log(msg)
            const AtUser = "NeedleMouse"
            //needleMouse.sendMessage(chatId, cId);
            shitBot.process(msg, AtUser, message.content)
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