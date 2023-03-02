import {ChatCompletionRequestMessage, Configuration, OpenAIApi} from 'openai';

import {AiChat, Response, Thread} from './chats.mjs';

const DEFAULT_MODEL = 'gpt-3.5-turbo';

export class OpenAi implements AiChat {
  private readonly _openai: OpenAIApi;

  constructor(apiKey: string) {
    this._openai = new OpenAIApi(new Configuration({apiKey}));
  }

  newThread(): Thread {
    return new OpenAiThread(this._openai);
  }
}

class OpenAiThread implements Thread {
  private readonly _history: ChatCompletionRequestMessage[] = [];
  private _lastMessageTime: number = Date.now();

  constructor(private readonly openai: OpenAIApi) {}

  get lastMessageTime(): number { return this._lastMessageTime; }

  async sendMessage(
    message: string,
    parentMessageId: string | null
  ): Promise<Response> {
    const messages =
      parentMessageId ? this._getMessages(parseInt(parentMessageId, 16)) : [];
    const finalMessage: ChatCompletionRequestMessage = {
      role: 'user',
      content: message
      // TODO Add user name on here.
    };
    this._history.push(finalMessage);
    messages.push(finalMessage);
    console.log(messages); // TODO Remove this debugging line.

    const {status, data: {usage, choices}} =
      await this.openai.createChatCompletion({
        model: DEFAULT_MODEL,
        messages,
        n: 1
      });
    if (status !== 200) {
      throw new Error(`Open AI chat failure: ${status}`);
    }
    console.log(usage);

    this._history.push(choices[0].message);
    return {
      text: choices[0].message.content,
      messageId: this._history.length.toString(16)
    };
  }

  _getMessages(parentIdx: number): ChatCompletionRequestMessage[] {
    return this._history.slice(0, parentIdx + 1);
  }
}
