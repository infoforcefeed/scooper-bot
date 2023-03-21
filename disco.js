const EventEmitter = require("node:events");
const { IntentsBitField, Client } = require('discord.js');

console.log('Abuse!')

class MessageOptions {
    constructor(replyToMessageId) {
        this.replyToMessageId = replyToMessageId;
    }
}

class MessagingBot {
    constructor() {
        if (new.target === MessagingBot) {
            throw new TypeError("Cannot construct MessagingBot instances directly");
        }
    }

    sendMessage(chatId, message, options) {
        throw new Error("sendMessage method must be implemented by the subclass");
    }

    sendPhoto(chatId, image, options) {
        throw new Error("sendPhoto method must be implemented by the subclass");
    }
}


class ChatMessage {
    constructor({ bot, id, chatId, threadId, message }) {
        if (!(bot instanceof MessagingBot)) {
            throw new TypeError("should be instance of MessagingBot");
        }

        this.bot = bot;
        this.id = id;
        this.chatId = chatId;
        this.threadId = threadId;
        this.message = message;
        this.replyToMessage = ChatMessage;
        console.log('ChatMessage!')

    }
}




const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});



class DiscoClient extends MessagingBot {
    constructor(options, bot) {
        super({ intents: client.options.intents });
        this.bot = bot
        this.options = options;
    }

    async sendMessage(chatId, text, options) {
        const message = await this.bot.channels.cache.get(chatId).send(text);
        return new ChatMessage({
            bot: this,
            id: message.id,
            chatId: message.channel.id,
            threadId: message.channel.id,
            message: message.content,
        });
        console.log("SendMEssage!")
    }

    async sendPhoto(chatId, photo, options, fileOptions) {

    }

}

module.exports = { MessageOptions, MessagingBot, ChatMessage, DiscoClient };


