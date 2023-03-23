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

(async () => {
    const { NeedleMouseClient } = await import('./disco.js');
    const { ShitBot } = await import('./src/chats.mjs');
    const needleMouse = new NeedleMouseClient(client);
    const shitBot = new ShitBot({ bot: needleMouse, chatGptKey: process.env.OPENAI_API_KEY, io });


    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
    });


    // on message create

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from bots

        if (message.mentions.has(client.user.id)) {


            const payload = {
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


            // this is capturing the username and the message content, how necessary is this?
            const regx = /^(?:@([^\s]+)\s)?((?:.|\n)+)$/m.exec(message);
            if (regx) {
                const capturedMessage = regx[2];
                // 
                console.log(capturedMessage)
                if (capturedMessage[0] === '/') return;

                const AtUser = "NeedleMouse"
                needleMouse.sendMessage(message.id, `@${AtUser} ${capturedMessage}`, { replyTo: message.id });
            }


        }
    });


})();


client.login(token);