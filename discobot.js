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

    async sendMessage(chatId, text, parentMessageId = null) {
        try {
            //1081600367307010120
            const sentMessage = await client.channels.cache.get('1081600367307010120').send(text)
            const messageId = parseInt(sentMessage.id);
            const response = {
                text: sentMessage.content,
                messageId: messageId,
                message_id: messageId
            };
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
        console.log(message)
        if (message.author.bot) return; // Ignore messages from bots

        const msg = {
            chat: {
                id: parseInt(message.id),
                type: "private",
            },
            ChatId: parseInt(message.id),

            message_id: parseInt(message.id),
            message_thread_id: parseInt(message.channel.id),
            reply_to_message_id: {
                message_id: parseInt(message.id),
            },
        };

        console.log(msg)
        const AtUser = "NeedleMouse"
        //needleMouse.sendMessage(chatId, cId);
        // const options = {
        //     message_thread_id: parseInt(message.channel.id),

        //     parsemode: 'MarkdownV2',
        //     reply: {
        //         messageReference: message.id | null
        //     },
        // };
        try {
            await shitBot.process(msg, AtUser, message.content)
        } catch (err) {
            console.log(err)
        }
        // await shitBot.process(msg, AtUser, message.content)
        // em.on('res', async (res) => {
        //     message.reply(res)
        // })

    });

})();


client.login(token);