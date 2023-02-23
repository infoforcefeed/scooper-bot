import {ChatGPTAPI} from 'chatgpt';

import {Thread, Response} from './chats';

const CONVERSATION_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export class ChatGpt {
  private readonly _gptApi: ChatGPTAPI;

  constructor(apiKey: string) {
    this._gptApi = new ChatGPTAPI({apiKey});
  }

  newThread(): ChatGptThread {
    return new ChatGptThread(this._gptApi);
  }
}

class ChatGptThread implements Thread {
  private _id: number | undefined;
  private _expiration: number = Date.now() + CONVERSATION_TTL_MS;
  private readonly _messageIds: number[] = [];

  constructor(private readonly _chatGpt: ChatGPTAPI) {}

  get expired(): boolean {
    return this._expiration > Date.now();
  }

  async sendMessage(
    message: string,
    parentMessageId: string | null = null
  ): Promise<Response> {
    let opts = {
      conversationId: this._id,
      parentMessageId: parentMessageId && this._messageIds[parentMessageId]
    };
    const response = await this._chatGpt.sendMessage(message, opts);
    this._expiration = Date.now() + CONVERSATION_TTL_MS;
    if (!this._id) this._id = response.conversationId;
    return {
      text: response.text,
      messageId: parentMessageId
    };
  }
}
