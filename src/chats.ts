import {ChatGpt} from "./chat-gpt";
import crypto from 'crypto';

export interface Response {
  text: string;
  messageId: string;
}

export interface Thread {
  expired: boolean;
  sendMessage(
    message: string,
    parentMessageId: string | null
  ): Promise<Response>;
}

interface BotOptions {
  bot: TelegramBot,
  chatGptKey: string;
}

const PRIVATE_TYPE = 'private';
const BOT_NAME = 'scooper_bot';
const PRETRAIN_BAR = 0.9;
const EXPIRATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

class Conversation {
  public readonly messageIds = new Map<string, string>();
  constructor(public readonly thread: Thread) {}
}

export class ShitBot {
  private readonly _bot: TelegramBot;
  private readonly _chatGpt: ChatGpt;
  private readonly _conversations = new Map<string, Conversation>();
  private readonly _expiring: number;

  constructor(options: BotOptions) {
    this._bot = options.bot;
    this._chatGpt = new ChatGpt(options.chatGptKey);
    this._expiring = setInterval(
      () => { this._expireConversations(); },
      EXPIRATION_INTERVAL_MS
    );
  }

  async process(
    msg: Telegram.Message,
    atUser: string | null,
    capturedMessage: string
  ): Promise<void> {
    const msgKey = isPrivateMessage(msg)
      ? (msg.reply_to_message && msg.reply_to_message.message_id)
      : msg.message_thread_id
    const mt = `${msg.chat.id}.${msgKey}`
    let conv = this._conversations.get(mt)
    if (!conv && !isPrivateMessage(msg) && atUser !== BOT_NAME) return;

    let parentMessageId: string | null = null;
    if (!conv) {
      conv = new Conversation(this._chatGpt.newThread());
      this._conversations.set(`${msg.chat.id}.${msg.message_id}`, conv);
      if (this._shouldPretrain()) {
        parentMessageId = await this._pretrain(conv, msg);
      }
    } else {
      parentMessageId =
        conv.messageIds.get(msg.reply_to_message.message_id) || null;
    }

    const res = await conv.thread.sendMessage(capturedMessage, parentMessageId);
    const sent = await this._bot.sendMessage(msg.chat.id, res.text, {
      reply_to_message_id: msg.message_id
    });

    conv.messageIds.set(sent.message_id, res.messageId);

    // Private chats don't have threads so we must manually maintain the
    // sequence.
    if (isPrivateMessage(msg)) {
      this._conversations.set(`${msg.chat.id}.${sent.message_id}`, conv);
    }
  }

  private _shouldPretrain(): boolean {
    return Math.random() > PRETRAIN_BAR;
  }

  private async _pretrain(
    conv: Conversation,
    msg: Telegram.Message,
  ): Promise<string> {
    await secretPretraining(conv, msg.chat.id.toString());
  }

  private _expireConversations() {
    for (const key of this._conversations.keys()) {
      if (this._conversations.get(key)?.thread.expired) {
        this._conversations.delete(key);
      }
    }
  }
}

function isPrivateMessage(msg: Telegram.Message): boolean {
  return msg.chat.type === PRIVATE_TYPE;
}

function encrypt(key, str) {
  const k = crypto.createHash('md5').update(key).digest('base64').substr(0, 16)
  const cipher = crypto.createCipheriv('aes128', k, k)
  return Buffer.from(cipher.update(str, 'utf8', 'hex') + cipher.final('hex'), 'hex').toString('base64')
}

function decrypt(keyStr: string, message: string) {
  const encKey =
    crypto.createHash('md5').update(keyStr).digest('base64').substr(0, 16);
  const decipher = crypto.createDecipheriv('aes128', encKey, encKey);
  return (
    decipher.update(message, 'base64').toString('utf8') +
    decipher.final('utf8')
  );
}

function encode(key, msg) {
  // -1001170475214 -- Info forcefeed
  // -1001816383023 -- Gumbies
  return encrypt(key.toString(), JSON.stringify(msg))
}

async function secretPretraining(
  conv: Conversation,
  key: string
): Promise<string> {
  const secret = selectSecret(key);
  if (!secret) return;

  const {messageId} =
    await conv.thread.sendMessage(secret, /*parentMessageId=*/null);
}

function selectSecret(key: string): string | null {
  const secrets = [
    'V1xOBGixonCndx4p+8AwIcCa+e/dX7PE26RYdtT5S5z5UIBDvw1HDn/8kcXUCrNem9ADCtfT35q801KQi5lyx53uPdBW9uU4KoNEv0wCEmpmv3tpHIOkU1nlA1kP+l7M',
    'uGPfFI8V2clmOjSBKopDRDN3r+tlDehkT80XmPOJ0fJy6ajfpRo9G6WbA7HKcaY7HjCG7kG8+pao/3kp/JiAW2UA8j1yylt86BG5LyuO5ElpbGeTv4Ulg2hAjRdkNKmf5DAfCyIh5RpWf3RkvQ9YbHMuhnd0Xd+c5Td29SiIjR2wUULZImmlLOKNCmsGxgZeq2I9QuxEi4FCBoGbxfTrsuHNDDcxTcVep/AiTTdQYRvsHFPf2Wuk/QhnPM4AKEqys4k+eJRC53ZWnsttHFEgLZuY34A1JYxBmPCTcDhRsRjDux/q+VN4E/ZKSICB5UoNMs4JuEqX0gM30WapSwz3aU3NGK2sUpudNOQqT7AwKaOVkzSKDOKfQwDMBCoh0oQJ2A8cqK9KMLtia+kbV7V6gxYM37NnIn0i9Q98/KX2XP+f9NIV+z+c+WsScLOFTSNJM1bzF/yf3wi8JO5LLlQ6Gd41Vyvxe5REVyzuFnsElIa1BSkQDwktEZoRhi/XMuE/tG5IjoxaSVsUeWcZpZXAi44tHyIP13RIHjbw3D1XNgJKPGI5NT5h6EJHY6rZd2HS',
    'rXt8cEkneylSBsw3fm/WHL/Qoy7FK6zX6+Gzxz0hQIOVAmGWAo5V61psMcTv+2E3OVXdyc4RHJG/JSmngM3PosFH6p88qN3lhYc3cpzC0mMrZ8fjQnNNq2dz3Zdbr9EMkX+1Uf8X5jK5MHGuqnMQqhbA+9TAblC2pqm3xTr8/4I+u3BEVfC39zEOric60cq15HdZbhFRS+T7ZtXhaFhTYUVqc+HR5gchUPr2q3GOgVuelyTzUcf7NbpSacJr6T0/PGG3rXNKXq48ZrVXzqXBcT56CTAbm+qQwVOLZIqrfSu0ffZaWbay022bbUDQfAM2bSkBsP0cMOcZjPjVvkXM5y1OYaph9hEWoGc1JfNmWTiMIFfkjXPUzkCeNQ0L/TPY',
  ];
  const secret = secrets[Math.floor(Math.random() * secrets.length)];
  try {
    return JSON.parse(decrypt(key, secret));
  } catch (e) {
    return null;
  }
}
