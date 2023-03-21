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

const et = new EventEmitter();
const io = new Server();

(async () => {
    const { DiscoClient } = await import('./disco.js');
    const { ShitBot } = await import('./src/chats.mjs');
    const discoBot = new DiscoClient({ bot: client, chatGptKey: process.env.OPENAI_API_KEY, io });
    const shitBot = new ShitBot({ bot: DiscoClient, chatGptKey: process.env.OPENAI_API_KEY, io });

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
    });
    // discord api listens for messageCreate
    // emit if client is a user.

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from bots

        if (message.mentions.has(client.user.id)) {

            const regx = /^(?:@([^\s]+)\s)?((?:.|\n)+)$/m.exec(message);
            if (regx) {
                const capturedMessage = regx[2];
                if (capturedMessage[0] === '/') return;
                message.reply("Oops, I didn't make it home!")


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

                let x = shitBot.process(discoGram);
                console.log(x)

            }

        }
    });

})();


client.login(token);