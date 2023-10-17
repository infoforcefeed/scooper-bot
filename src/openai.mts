import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';

import {
  AiChat, AiImage, ImageGeneration, ImageResponse, Response, Thread
} from './chats.mjs';

const MODELS = new Map<string, string>([
  ['gpt-3.5-turbo', 'gpt-3.5-turbo'],
  ['gpt3', 'gpt-3.5-turbo'],
  ['gpt4', 'gpt-4'],
  ['default', 'gpt-3.5-turbo'],
  ['text-davinci-003', 'text-davinci-003'],
  ['davinci', 'text-davinci-003'],
]);

export class OpenAi implements AiChat, AiImage {
  private readonly _openai: OpenAIApi;
  private _model = MODELS.get('default');

  constructor(apiKey: string) {
    this._openai = new OpenAIApi(new Configuration({ apiKey }));
  }

  setModel(model: string): string {
    const foundModel = MODELS.get(model);
    if (foundModel) this._model = foundModel;
    return this._model;
  }

  newThread(): Thread {
    return new OpenAiThread(this._openai, this._model);
  }

  newImage(): ImageGeneration {
    return new OpenAiImageGeneration(this._openai);
  }
  updateEmbedding(embeddingName, image, ext): Promise<void> {
    throw new Error('Embeddings not implemented with OpenAI.');
  }
}

class OpenAiThread implements Thread {
  private readonly _history: ChatCompletionRequestMessage[] = [];
  private _lastMessageTime: number = Date.now();

  constructor(private readonly openai: OpenAIApi, private readonly model) { }

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

    const { data: { usage, choices } } =
      await this.openai.createChatCompletion({
        model: this.model,
        messages,
        n: 1
      });
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

class OpenAiImageGeneration implements ImageGeneration {
  private _lastMessageTime: number = Date.now();

  constructor(private readonly openai: OpenAIApi) { }

  get lastMessageTime(): number { return this._lastMessageTime; }

  async generateImage(prompt: string): Promise<ImageResponse> {
    // TODO: Add multi generation to allow for parallel iteration.
    // TODO: Add size selection.
    const { data: { data } } = await this.openai.createImage({
      prompt,
      n: 1,
      size: '512x512',
      response_format: 'url'
    });

    // TODO: Add history to enable reply to iterate.
    return { image: data[0].url, messageId: 'nope' };
  }
}
