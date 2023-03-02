import {ChatCompletionRequestMessage, Configuration, OpenAIApi} from 'openai';

import {AiChat, Response, Thread} from './chats.mjs';

const MODELS = new Map<string, string>([
  ['gpt-3.5-turbo', 'gpt-3.5-turbo'],
  ['gpt', 'gpt-3.5-turbo'],
  ['default', 'gpt-3.5-turbo'],
  ['text-davinci-003', 'text-davinci-003'],
  ['davinci', 'text-davinci-003'],
]);

export class OpenAi implements AiChat {
  private readonly _openai: OpenAIApi;
  private _model = MODELS.get('default');

  constructor(apiKey: string) {
    this._openai = new OpenAIApi(new Configuration({apiKey}));
  }

  setModel(model: string): string {
    const foundModel = MODELS.get(model);
    if (foundModel) this._model = foundModel;
    return this._model;
  }

  newThread(): Thread {
    return new OpenAiThread(this._openai, this._model);
  }
}

class OpenAiThread implements Thread {
  private readonly _history: ChatCompletionRequestMessage[] = [];
  private _lastMessageTime: number = Date.now();

  constructor(private readonly openai: OpenAIApi, private readonly model) {}

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
        model: this.model,
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
