import axios from 'axios';
import { Server, Socket } from 'socket.io';

import { AiImage, ImageGeneration, ImageResponse } from './chats.mjs';

export class AwooAi implements AiImage {
  private _sockets: Socket[] = [];

  constructor(io: Server) {
    io.of('/awoo').on('connection', (socket: Socket) => {
      this._sockets.push(socket);
      socket.on('disconnect', () => {
        this._sockets = this._sockets.filter((s) => s !== socket);
      });
    });
  }

  newImage(): ImageGeneration {
    return new AwooImage(
      this._sockets[Math.floor(Math.random() * this._sockets.length)]
    );
  }
}

class AwooImage implements ImageGeneration {
  private _lastMessageTime: number = Date.now();

  constructor(private readonly socket: Socket) { }

  get lastMessageTime(): number { return this._lastMessageTime; }

  generateImage(prompt: string): Promise<ImageResponse> {
    const requestId = Math.random().toString();
    return new Promise<ImageResponse>((resolve, reject) => {
      this.socket.once(requestId, async ({image}) => {
        resolve({image: Buffer.from(image, 'base64'), messageId: requestId});
        this._lastMessageTime = Date.now();
      });
      this.socket.emit('request', {requestId, txt2img: {prompt}});
      this._lastMessageTime = Date.now();
    });
  }
}
