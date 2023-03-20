const EventEmitter = require("node:events");
const { IntentsBitField, Client } = require('discord.js');

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
    constructor({ bot, id, chatId, threadId, message, replyToMessage }) {
        if (!(bot instanceof MessagingBot)) {
            throw new TypeError("should be instance of MessagingBot");
        }

        this.bot = bot;
        this.id = id;
        this.chatId = chatId;
        this.threadId = threadId;
        this.message = message;
        this.replyToMessage = ChatMessage;
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
        const channel = this.bot.channels.cache.get(chatId);

        const message = await channel.send(text, options);
        return message;
    }

    async sendPhoto(chatId, photo, options, fileOptions) {
        const channel = this.bot.channels.cache.get(chatId);

        const attachment = new client.attachment(photo, fileOptions);

        const message = await channel.send(options);
        message.channel.send(attachment);
        return message;
    }

}

module.exports = { MessageOptions, MessagingBot, ChatMessage, DiscoClient };


