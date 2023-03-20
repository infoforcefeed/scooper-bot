const { EventEmitter } = require("node:events");
const TelegramBot = require('node-telegram-bot-api');
const { IntentsBitField, Client } = require('discord.js');


(async () => {
    const { ShitBot } = await import('./src/chats.mjs');
    const { Server } = await import('socket.io')

    const chatId = '1081600367307010120'; // Replace with the ID of the Discord channel you want to send the message to
    const message = 'Hello, Discord!'; // Replace with the message you want to send

    const { DiscoClient } = await import('./disco.js');
    const shitbot = new ShitBot({ bot: client, chatGptKey: process.env.OPENAI_API_KEY, io: Server });


    const options = {
        bot: shitbot,
        chatGptKey: 'myChatGptKey',
        io: Server,
    };

    const client = new DiscoClient({ options: options, chatGptKey: process.env.OPENAI_API_KEY });

    client.sendMessage(chatId, message)
        .then((sentMessage) => {
            console.log(`Message sent: ${sentMessage.content}`);

            const chatMessage = new ChatMessage({
                bot: shitbot,
                id: sentMessage.id,
                chatId: chatId,
                threadId: null,
                message: sentMessage,
                replyToMessage: null,
            });

            console.log(`Chat message created: ${chatMessage.message.content}`);
        })
        .catch((error) => {
            console.error(`Failed to send message: ${error}`);
        });
})();
