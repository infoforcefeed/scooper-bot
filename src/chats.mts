import axios from 'axios';
import { createCipheriv, createDecipheriv, createHash } from 'crypto';
import * as TelegramBot from 'node-telegram-bot-api';
import {
  Message as TelegramMessage,
  User as TelegramUser
} from 'node-telegram-bot-api';
import { extname } from 'path';
import { Server as SocketIoServer } from 'socket.io';

import { AwooAi } from './awoo.mjs';
import { ChatGpt } from './chat-gpt.mjs';
import { OpenAi } from './openai.mjs';
import { RandomSelector } from './selectors.mjs';

export interface AiChat {
  setModel(model: string): string;
  newThread(): Thread;
}

export interface AiImage {
  newImage(): ImageGeneration;
  updateEmbedding(
    embeddingName: string,
    image: Buffer,
    ext: string
  ): Promise<void>;
}

export interface Response {
  text: string;
  messageId: string;
}

export interface Thread {
  lastMessageTime: number;
  sendMessage(
    message: string,
    parentMessageId: string | null
  ): Promise<Response>;
}

export interface ImageResponse {
  image: string | Buffer;
  messageId: string;
}

export interface ImageGeneration {
  lastMessageTime: number;
  generateImage(prompt: string): Promise<ImageResponse>;
}

interface BotOptions {
  bot: TelegramBot,
  chatGptKey: string;
  io: SocketIoServer;
}

enum User {
  CONNECT_SPD = 754240355,
  dman757 = 973855424,
  leCalcifer = 942174493,
  NotAWolfe = 628450872,
  Prestoon = 717750553,
  qdiffer = 953128114,
  Rabutt = 572912381,
}

enum Group {
  Gumbies = -1001816383023,
  InfoForcefeed = -1001170475214,
}

const PRIVATE_TYPE = 'private';
const BOT_NAME = 'scooper_bot';
const TROLL_BAR = 0.95;
const CONVERSATION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const EXPIRATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const USER_ALIASES = new Map<string, User>([
  ['alaina', User.NotAWolfe],
  ['bryan', User.CONNECT_SPD],
  ['connor', User.Rabutt],
  ['dman', User.dman757],
  ['natalie', User.NotAWolfe],
  ['paige', User.leCalcifer],
  ['preston', User.Prestoon],
  ['quinlan', User.qdiffer],
  ['rabbit', User.Rabutt],
  ['reblink', User.Rabutt],
]);

interface ChatConversation {
  messageIds: Map<string, string>;
  thread: Thread;
}

interface ImageConversation {
  messageIds: Map<string, string>;
  thread: ImageGeneration;
}

class Conversation {
  public readonly messageIds = new Map<string, string>();
  constructor(public readonly thread: Thread | ImageGeneration) { }
}

function isImageConversation(conv: any): conv is ImageConversation {
  return conv?.messageIds instanceof Map && conv.thread?.generateImage;
}

export class ShitBot {
  private readonly _bot: TelegramBot;
  private readonly _chatGpt: ChatGpt;
  private readonly _openai: OpenAi;
  private readonly _awoo: AwooAi;
  private readonly _conversations = new Map<string, Conversation>();
  private readonly _expiring: NodeJS.Timer;
  private _aiChat: AiChat;
  private _aiImage: AiImage;

  constructor(options: BotOptions) {
    this._bot = options.bot;
    this._aiChat = this._chatGpt = new ChatGpt(options.chatGptKey);
    this._openai = new OpenAi(options.chatGptKey)
    this._aiImage = this._awoo = new AwooAi(options.io);
    this._expiring = setInterval(
      () => { this._expireConversations(); },
      EXPIRATION_INTERVAL_MS
    );
  }

  setAiBackend(backend: string, model?: string): [string, string] {
    let aiName = 'Unknown';
    if (/chat.?gpt/i.test(backend)) {
      this._aiChat = this._chatGpt;
      aiName = 'Chat GPT';
    } else if (/openai/i.test(backend)) {
      this._aiChat = this._openai;
      aiName = 'OpenAI';
    }
    let chosenModel = 'Unknown';
    if (model) chosenModel = this._aiChat.setModel(model)
    return [aiName, chosenModel];
  }

  async process(
    msg: TelegramMessage,
    atUser: string | null,
    text: string
  ): Promise<void> {
    const mt = this._getMessageKey(msg);
    let conv = this._conversations.get(mt) || null;
    if (conv || isPrivateMessage(msg) || atUser === BOT_NAME) {
      if (isImageConversation(conv)) {
        await this._processImage(conv, msg, text);
      } else {
        await this._processDirectMessage(conv as ChatConversation, msg, text);
      }
      return;
    }

    if (!this._dickAround()) return;

    const user = (atUser && toUser(atUser)) || findUser(text);
    if (user) {
      console.log(`Interjecting about ${User[user]} (${user})`);
      await this._interject(selectUserSecret(user), msg, text);
      return;
    }

    if (/[A2ufm]{5,}/i.test(text)) {
      await this._interject(decode('fmuf2', AAAAAA), msg, text);
    }
  }

  async processImage(msg: TelegramMessage, prompt: string): Promise<void> {
    if (msg.reply_to_message) {
      console.log(msg.reply_to_message);
    }

    const mt = this._getMessageKey(msg);
    let conv = this._conversations.get(mt) || null;
    if (!isImageConversation(conv)) {
      conv = this._newImageConverstaion(msg);
    }

    await this._processImage(conv as ImageConversation, msg, prompt);
  }

  async processSticker(msg: TelegramMessage): Promise<void> {
    if (msg.reply_to_message?.photo?.length) {
      let photo = msg.reply_to_message.photo[0];
      for (const p of msg.reply_to_message.photo) {
        if (p.width > photo.width) photo = p; // Girthy.
      }
      await this._updateEmbedding(
        this._getEmbeddingName(msg.chat.id, msg.sticker.emoji),
        photo.file_id
      );
      await this._bot.sendMessage(msg.chat.id, msg.sticker.emoji, {
        reply_to_message_id: msg.message_id
      });
      return;
    }
  }

  private _getMessageKey(msg: TelegramMessage): string {
    const msgKey = isPrivateMessage(msg)
      ? (msg.reply_to_message?.message_id)
      : msg.message_thread_id;
    return `${msg.chat.id}.${msgKey}`
  }

  private async _processDirectMessage(
    conv: ChatConversation | null,
    msg: TelegramMessage,
    text: string
  ): Promise<void> {
    let parentMessageId: string | null = null;
    if (!conv) {
      conv = this._newChatConversation(msg);
      if (this._dickAround()) {
        parentMessageId = await this._pretrain(conv, msg);
      }
    } else if (msg.reply_to_message) {
      parentMessageId =
        conv.messageIds.get(msg.reply_to_message.message_id.toString()) || null;
    }
    await this._replyToMessage(conv, msg, text, parentMessageId);
  }

  private async _processImage(
    conv: ImageConversation,
    msg: TelegramMessage,
    prompt: string
  ): Promise<void> {
    if (msg.reply_to_message?.text) {
      prompt = `${msg.reply_to_message.text}\n\n${prompt || ''}`;
    }

    const generator = this._aiImage.newImage();
    try {
      const { messageId, image } = await generator.generateImage(prompt);
      const sent = await this._bot.sendPhoto(msg.chat.id, image, {
        reply_to_message_id: msg.message_id
      });

      this._updateThreading(conv, msg, messageId, sent.message_id);
    } catch (e) {
      if (e.config?.headers) delete e.config.headers;
      await this._bot.sendMessage(
        msg.chat.id,
        '```\n' + JSON.stringify(e, null, 2) + '\n```',
        { reply_to_message_id: msg.message_id, parse_mode: 'MarkdownV2' }
      );
    }
  }

  private _dickAround(): boolean {
    return Math.random() > TROLL_BAR;
  }

  private async _pretrain(
    conv: ChatConversation,
    msg: TelegramMessage,
  ): Promise<string | null> {
    return await secretPretraining(conv, msg.chat.id.toString());
  }

  private _expireConversations() {
    const expirationTime = Date.now() - CONVERSATION_TTL_MS;
    for (const [key, conv] of this._conversations.entries()) {
      if (conv.thread.lastMessageTime < expirationTime) {
        this._conversations.delete(key);
      }
    }
  }

  private async _interject(
    training: string | null,
    msg: TelegramMessage,
    text: string
  ): Promise<void> {
    if (training) {
      const conv = this._newChatConversation(msg);
      await this._replyToMessage(conv, msg, training, /*parentMessageId=*/null);
    }
  }

  private _newChatConversation(msg: TelegramMessage): ChatConversation {
    const conv = new Conversation(this._aiChat.newThread());
    this._conversations.set(this._conversationKey(msg), conv);
    return conv as ChatConversation;
  }

  private _newImageConverstaion(msg: TelegramMessage): ImageConversation {
    const conv = new Conversation(this._aiImage.newImage());
    this._conversations.set(this._conversationKey(msg), conv);
    return conv as ImageConversation;
  }

  private _conversationKey(msg: TelegramMessage): string {
    return `${msg.chat.id}.${msg.message_id}`;
  }

  private async _replyToMessage(
    conv: ChatConversation,
    msg: TelegramMessage,
    text: string,
    parentMessageId: string | null
  ): Promise<void> {
    const res = await conv.thread.sendMessage(text, parentMessageId);
    const sent = await this._bot.sendMessage(msg.chat.id, res.text, {
      reply_to_message_id: msg.message_id
    });

    this._updateThreading(conv, msg, res.messageId, sent.message_id);
  }

  private _updateThreading(
    conv: Conversation,
    msg: TelegramMessage,
    aiMessageId: string,
    tgMessageId: number
  ) {
    conv.messageIds.set(tgMessageId.toString(), aiMessageId);

    // Private chats don't have threads so we must manually maintain the
    // sequence.
    if (isPrivateMessage(msg)) {
      this._conversations.set(`${msg.chat.id}.${tgMessageId}`, conv);
    }
  }

  private _getEmbeddingName(chatId: number, emoji: string): string {
    return `shitbot-embedding-${chatId}-${emoji}`;
  }

  private async _updateEmbedding(embeddingName: string, fileId: string) {
    const imageLink = await this._bot.getFileLink(fileId);
    const {data} = await axios.default.get<ArrayBuffer>(
      imageLink,
      {responseType: 'arraybuffer'}
    );
    await this._aiImage.updateEmbedding(
      embeddingName,
      Buffer.from(data),
      extname(imageLink)
    );
  }
}

function isTelegramUser(x: any): x is TelegramUser {
  return (
    typeof x === 'object' &&
    typeof x.id === 'number' &&
    typeof x.username === 'string'
  );
}

function toUser(user: string | number | TelegramUser): User | null {
  if (isTelegramUser(user)) {
    user = user.id;
  }
  if (typeof user === 'string') {
    return User[user] || USER_ALIASES.get(user.toLowerCase()) || null;
  } else if (user in User) {
    return user;
  }
  return null;
}

function findUser(text: string): User | null {
  const foundUsers = new Set<User>();
  text = text.toLowerCase();
  for (const user in Object.keys(User)) {
    if (typeof user === 'string' && text.includes(user.toLowerCase())) {
      foundUsers.add(toUser(user));
    }
  }
  for (const [name, user] of USER_ALIASES) {
    if (text.includes(name)) {
      foundUsers.add(user);
    }
  }

  if (foundUsers.size === 1) {
    return foundUsers.values().next().value;
  } else if (foundUsers.size > 1) {
    return new RandomSelector(foundUsers).select();
  }
  return null;
}

function isPrivateMessage(msg: TelegramMessage): boolean {
  return msg.chat.type === PRIVATE_TYPE;
}

function encrypt(key, str) {
  const k = createHash('md5').update(key).digest('base64').substr(0, 16)
  const cipher = createCipheriv('aes128', k, k)
  return Buffer.from(cipher.update(str, 'utf8', 'hex') + cipher.final('hex'), 'hex').toString('base64')
}

function decrypt(keyStr: string, message: string) {
  const encKey =
    createHash('md5').update(keyStr).digest('base64').substr(0, 16);
  const decipher = createDecipheriv('aes128', encKey, encKey);
  return (
    decipher.update(message, 'base64').toString('utf8') +
    decipher.final('utf8')
  );
}

export function encode(key: any, msg: any) {
  return encrypt(key.toString(), JSON.stringify(msg))
}

function decode(key: any, msg: string): any | null {
  try {
    return JSON.parse(decrypt(key.toString(), msg));
  } catch (e) {
    return null;
  }
}

async function secretPretraining(
  conv: ChatConversation,
  key: string
): Promise<string | null> {
  const secret = selectSecret(key);
  if (!secret) return null;

  const { messageId } =
    await conv.thread.sendMessage(secret, /*parentMessageId=*/null);
  return messageId;
}

const secrets = new RandomSelector([
  'V1xOBGixonCndx4p+8AwIcCa+e/dX7PE26RYdtT5S5z5UIBDvw1HDn/8kcXUCrNem9ADCtfT35q801KQi5lyx53uPdBW9uU4KoNEv0wCEmpmv3tpHIOkU1nlA1kP+l7M',
  'uGPfFI8V2clmOjSBKopDRDN3r+tlDehkT80XmPOJ0fJy6ajfpRo9G6WbA7HKcaY7HjCG7kG8+pao/3kp/JiAW2UA8j1yylt86BG5LyuO5ElpbGeTv4Ulg2hAjRdkNKmf5DAfCyIh5RpWf3RkvQ9YbHMuhnd0Xd+c5Td29SiIjR2wUULZImmlLOKNCmsGxgZeq2I9QuxEi4FCBoGbxfTrsuHNDDcxTcVep/AiTTdQYRvsHFPf2Wuk/QhnPM4AKEqys4k+eJRC53ZWnsttHFEgLZuY34A1JYxBmPCTcDhRsRjDux/q+VN4E/ZKSICB5UoNMs4JuEqX0gM30WapSwz3aU3NGK2sUpudNOQqT7AwKaOVkzSKDOKfQwDMBCoh0oQJ2A8cqK9KMLtia+kbV7V6gxYM37NnIn0i9Q98/KX2XP+f9NIV+z+c+WsScLOFTSNJM1bzF/yf3wi8JO5LLlQ6Gd41Vyvxe5REVyzuFnsElIa1BSkQDwktEZoRhi/XMuE/tG5IjoxaSVsUeWcZpZXAi44tHyIP13RIHjbw3D1XNgJKPGI5NT5h6EJHY6rZd2HS',
  'rXt8cEkneylSBsw3fm/WHL/Qoy7FK6zX6+Gzxz0hQIOVAmGWAo5V61psMcTv+2E3OVXdyc4RHJG/JSmngM3PosFH6p88qN3lhYc3cpzC0mMrZ8fjQnNNq2dz3Zdbr9EMkX+1Uf8X5jK5MHGuqnMQqhbA+9TAblC2pqm3xTr8/4I+u3BEVfC39zEOric60cq15HdZbhFRS+T7ZtXhaFhTYUVqc+HR5gchUPr2q3GOgVuelyTzUcf7NbpSacJr6T0/PGG3rXNKXq48ZrVXzqXBcT56CTAbm+qQwVOLZIqrfSu0ffZaWbay022bbUDQfAM2bSkBsP0cMOcZjPjVvkXM5y1OYaph9hEWoGc1JfNmWTiMIFfkjXPUzkCeNQ0L/TPY',
]);
function selectSecret(key: string): string | null {
  try {
    return JSON.parse(decrypt(key, secrets.select()));
  } catch (e) {
    return null;
  }
}

const userSecrets = new Map([
  [User.NotAWolfe, new RandomSelector(['4wHuhmfA5KA+lGOwA+tyM5QLHlfVKfJLnMW0oYxpKvRLHTfLWNY3LWERk0v4mO+9PxpRb9h9x1Ki93+bQBdmNX1oovEUte4JzqMr2imQCm3XE/exdOQzVFJiGY1s0uJScObyjJGc32hXto1YhwVC9Mo+yaZKEJNssRrVj+awRKicYkcV5hp7qKLEOH7E2UlyRAn6ZiJ7Zc+3uKp1OSkRVSnWCsD0n8hEIfcl7JFh/863NiMofdMBggCKcF1EaiSsVuHTUkNNbg6t25FDgNmYelE+6Fkt3UnJP65rwrKrKvQR1eOxdGzS+cVfYP10OzzhVQ/07K5WwzKE4YPs+i2YvQTEBjvcrNPBx+zZgL77v2sQovvOK1WmkKwE6eiwGCkEmCeabuNFkBh9H32QTbAeTbFnHL5IGqCPicz65Ull32T6hfh1q28uGLBTsA3O5giXQXJMUJBY4IecCOMadjSaKj07hmnied+7SWq/Vx6rT2rmDhAFZLYjYSnpS91ObgXlZsiwXvQDUPf4Lmw+bOlC8t4q9sXJ9IHLOAiu/jj4TJeGNNG7efDyDPm8n2yGZ/syj1PmJBWZb581pWC1zz9oo8AU1vAmz2KwdJDTiVN/yngUj7K4Lm4t+cAeII7B9Y5IxmXLQEnoqLK3SRy+NY5sXE422D7MvFvwkNWeeKLCLyXiFlgnTI0uOj0wSYUcF1V+Im6ib9O2kzPkmi1+iQy6Rsy6gDUXTfpzYOFD4DJ339n55TlIzyrbL6geiy9bfvcj4rVABne1YpJ6Pd9BfVoTUw=='])],
  [User.Prestoon, new RandomSelector(['InMJkgEFS3mBfL3jeJqyKS+4e1s8ikv2c+mqgvroljEFgZqNelL8zUac97/0fRW7KJ+RnX7AAZbDz87kBCdle+RQirJbR87wD/n2wJjkvx2hEuWLFIcQsIjOV8oJRYVuNP+kQffTd31CfnV6D2QXKhuPoFE5qNxZuWE4e7EBRO1zsw4uw8uuUr0D5dtLx1wiq4JVrlMtPTc8ufzKycF0QObmd+Lslbwvpvc/T0eeUa3QlsWmODMyUImbgGFlVlzelC4AF4k79diWSZ3mAJfillwaHP4MGIqMUuZ9xHE19w5bKebB9HwGH03MFKLjOm02MvZCvmHDPPdXk9KCLVFWc4hL3pZYDny6mPEdNxyqLSXmAZYgLmX/F0ilWBf7TzEDZ5UeiO23O4NpIK8Y9mwF4+rDGxFw21WSUi+dEFX53j4='])],
  [User.qdiffer, new RandomSelector(['Xcpjosi58nMnYxurW6e7EaVDam/cHk3q3V60/j8955+/75SkZzq0NHBLqh7j09EfeQn4kmz5plltYynamPh7M213HGQh3yQ4TuCSVYfH30BTYtzZ5YrerMEyZ3agltjurqvqlutDTbH3qQA/pwYIHe9RmvmBmTqobwJ3d6ZkSs5Za+P9V0Yun3PUGtYGf6xwwRnyQpnEINNqEIrXKd6bvdn2ZYS6kx9fk5x8pbbFrozrsYiVQomfoeXOmoc1q0Cak5Onpmf8u3R5Bo2zTRQ7wmEH6KgHspl9LufbHwpXsykwxOqZ6B+7DfDE25LKSLz1qNKhgKg/6Bv6mKd6TEXJ0A=='])],
  [User.Rabutt, new RandomSelector(['w3z372KHI7X8Kd1mNQLEuVP5BGxlY6trBS1Qb/op1jXM/ZHkDTksFn9DgtiR9Q9g3IicdwAvRc8YwAeApjX67NaXRDJrndkQD8bkEoVOKTdoT/FeNWzPeEG1QNRhDS24QfmHTkj4jA8Q+akhGF7EHEz0zeUJKDgM3aX2uj5Zt0JrUz7CD67i1rnB08Z0TKwMFKYia8Bioq/YuqNQn9HMAAT9ATAUNVHEADRCAugOvw7lgBT3eBeyiZb0Z4PETg2eEH/7GiFE8gD787x1nlCH6SCNw8SlW4o5K3aCJpkee3/pWIESDaf56wFC/4JZcI3p6l0/2nrn92FrhzJppUZe226Uvu2fB50jbcXvHmTVd5NNSlhBvs0Z2n5wElwHmwpDBttpD9lZvWW7X1x2WvOCMj0ovyzcvf6Nb+bilNk5aLGZ113qPPSjGYFmyVmsMWlr563oJBLFAzqlDWeGso+Thoojf7B/1UNvGbe1AdXWcWj7ITUeIdv5MCo9+hqMY+8lTrBLOV/geusoVIk8EkQQYQcTgiC6V8fj/WosORLT3h0Y38D3TimdKGGlW4fLhztBT2+ov6q9Ow/O99ztd9ZWdHKbdhw5DMMnNj3mp31WTaWhKsRg4Lug9ufCMAE6brxJ'])]
]);
function selectUserSecret(user): string | null {
  const secret = userSecrets.get(user)?.select();
  if (!secret) return null;
  try {
    return JSON.parse(decrypt(user.toString(), secret));
  } catch (e) {
    return null;
  }
}

const AAAAAA = 'm1yOf2EGn3TY2WtxfIwI7OeNO0BVdFLvF5ffWvNAfao39EEqLU/qOmjoqTkxgFJb';
