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
em = new EventEmitter();
const io = new Server();


// calling a needlemouse client class, define an interface, given a object, this interface can tell you what to expect in this object.
// needlemouse client is using and passing it as if it is implementing that telegram bot interface. Chat.MTS is expecting us to give it a telegram bot.
// we might be able to get  by with just send message,
class NeedleMouseClient {
    constructor({ client }) {
        this.client = client;
    }

    // hey discord, this is my message
    async sendMessage(chat, text, res) {
        try {
            const sentMessage = await client.channels.cache.get(chat.channel).send(text);
            const messageId = parseInt(chat.messageId);
            const response = {
                message_id: sentMessage.id,
            };
            return response;
        } catch (err) {
            console.log(err);
        }
    }
}

(async () => {
    em = new EventEmitter();
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

        // const msg = {
        //     chat: {
        //         id: parseInt(message.id),
        //         type: 'group'
        //     },
        //     ChatId: parseInt(message.id),

        //     message_id: parseInt(message.id),
        //     message_thread_id: parseInt(message.channel.id),
        //     reply_to_message_id: {
        //         message_id: parseInt(message.id),
        //     },
        // };

        const msg = {
            chat: {
                id: {
                    messageId: message.id,
                    channel: message.channel.id,
                },
                type: 'group',
            },
            ChatId: parseInt(message.id),
            message_id: parseInt(message.id),
            message_thread_id: parseInt(message.channel.id),
            reply_to_message_id: {
                message_id: parseInt(message.id),
            },
        };

        console.log(msg)
        const AtUser = "scooper_bot"



        if (message.mentions.has(client.user.id)) {
            try {
                console.log(message)
                await shitBot.process(msg, AtUser, message.content)
            } catch (err) {
                console.log(err)
            }
        }
    });

})();


client.login(token);