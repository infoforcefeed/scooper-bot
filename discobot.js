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

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
    });
    // discord api listens for messageCreate
    // emit if client is a user.

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from bots

        if (message.mentions.has(client.user.id)) {
            et.emit('msg', message);
            console.log(`discord api emitted ${message}, ${client.user.id}`)
            await et.on('result', (message) => {
                client.on('messageCreate', async (msg) => {
                    msg.reply(`${message.text}`);
                });

            })
        }
    });

    // send event to shitbot api with message
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

            // const processed = await discoBot.process(discoGram, client.user.id, capturedMessage);
            const conv = discoBot._newChatConversation(discoGram);
            let parentMessageId;
            if (!conv) {
                conv = discoBot._newChatConversation(discoGram);
            } else if (discoBot.reply_to_message) {
                parentMessageId = conv.messageIds.get(discoGram.reply_to_message.message_id.toString()) || null;
            }
            let res = await discoBot._replyToMessage(conv, discoGram, capturedMessage, parentMessageId);

            et.emit('result', res);

        }

    });

    // // send reply to discord api
    // et.on('result', async (message) => {
    //     const message = await client.channels.cache.get(reply.chat.id).messages.fetch(reply.message_id);
    //     message.reply(`${message.text}`);


    // });

})();


client.login(token);