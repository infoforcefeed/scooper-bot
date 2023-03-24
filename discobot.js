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
    constructor({ bot }) {
        this.bot = bot;
    }

    async sendMessage(chatId, text) {

        em.emit('res', text);
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

        if (message.mentions.has(client.user.id)) {
            const msg = {
                chat: {
                    id: parseInt(message.id),
                    type: "private",
                },
                message_id: parseInt(message.id),
                message_thread_id: parseInt(message.channelId),
                reply_to_message: {
                    message_id: parseInt(message.id),
                },
            };

            console.log(msg)
            const AtUser = "NeedleMouse"
            //needleMouse.sendMessage(chatId, cId);
            await shitBot.process(msg, AtUser, message.content)
            em.on('res', async (res) => {
                message.reply(res)
            })

        }
    });

})();


client.login(token);