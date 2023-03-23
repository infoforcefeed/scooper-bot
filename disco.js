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
        console.log("ChatMessage: ", bot, id, chatId, threadId, message)
        this.bot = bot;
        this.id = id;
        this.chatId = chatId;
        this.threadId = threadId;
        this.message = message;
        this.replyToMessage = ChatMessage;
        console.log('ChatMessage!')

    }
}

// At what point is any of this processed by shitbot? 
class NeedleMouseClient extends MessagingBot {
    super()
    constructor({ bot }) {
        this.bot = bot
    }

    async sendMessage(chatId, text, options) {
        try {
            const messageOptions = {
                content: text,
                ...options,
            };
            console.log(this.bot)
            const channel = await this.bot.channels.fetch(chatId);
            const message = await channel.send(messageOptions);

            return message;
        } catch (err) {
            console.error("CATCH ERR: ", err);
        }
    }
}

module.exports = { NeedleMouseClient };
