import * as chatgpt from 'chatgpt';

import {AiChat, Response, Thread} from './chats.mjs';


export class ChatGpt implements AiChat {
  private readonly _gptApi: chatgpt.ChatGPTAPI;

  constructor(apiKey: string) {
    this._gptApi = new chatgpt.ChatGPTAPI({apiKey});
  }

  newThread(): ChatGptThread {
    return new ChatGptThread(this._gptApi);
  }
}

class ChatGptThread implements Thread {
  private _id: string | null = null;
  private _lastMessageTime: number = Date.now();

  constructor(private readonly _chatGpt: chatgpt.ChatGPTAPI) {}

  get lastMessageTime(): number { return this._lastMessageTime; }

  async sendMessage(
    message: string,
    parentMessageId: string | null = null
  ): Promise<Response> {
    let opts = {
      conversationId: this._id,
      parentMessageId
    };
    const response = await this._chatGpt.sendMessage(message, opts);
    this._lastMessageTime = Date.now();
    if (!this._id) this._id = response.conversationId;
    return {
      text: response.text,
      messageId: response.parentMessageId
    };
  }
}
