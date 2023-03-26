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

class NeedleMouseClient {
    constructor({ client }) {
        this.client = client;
    }

    async sendMessage(chatId, text, parentMessageId) {
        try {
            //1081600367307010120
            // why is this here to start?
            const sentMessage = await client.channels.cache.get('1081600367307010120').send(text)
            const messageId = parseInt(chatId);
            const response = {
                text: text,
                messageId: messageId,
                message_id: messageId,
                conversation_id: messageId,
                parent_id: messageId
            };
            console.log(response)
            if (parentMessageId) {
                response.parentMessageId = parentMessageId;
                console.log("parentMessageId", parentMessageId)
            }
            return response;

        } catch (err) {
            console.log(err)
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
                id: parseInt(message.channel.id),
                type: 'group',
            },
            from: {
                id: parseInt(message.author.id),
            },
            date: Math.floor(message.createdAt.getTime() / 1000),
            text: message.content,
        };

        console.log(msg)
        const AtUser = "scooper_bot"



        if (message.mentions.has(client.user.id)) {
            try {
                console.log("///////NO REFERENCE///////////")
                console.log(message)
                await shitBot.process(msg, AtUser, message.content)
            } catch (err) {
                console.log(err)
            }
            // check if message is a reply
            if (message.reference) {
                try {
                    console.log("////////HAS REFERENCE////////")
                    console.log(message)
                    await shitBot.process(msg, AtUser, message.content)
                }
                catch (err) {
                    console.log(err)
                }
            }
        }
    });

})();


client.login(token);