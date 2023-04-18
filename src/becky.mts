import TelegramBot, { Message } from 'node-telegram-bot-api';
import { Server as SocketIoServer, Socket } from 'socket.io';

import { RpcSocket } from './rpc-socket.mjs';

interface BotOptions {
  bot: TelegramBot,
  io: SocketIoServer
}

interface Request {
  requestId: string;
}

interface ResponseError {
  error: number;
}

interface Location {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lastWeatherTime?: number;
}

interface PrecipitationTotals {
  day: number;
  week: number;
  month: number;
}

interface LocationResponse {
  location: Location,
  rain?: PrecipitationTotals;
  snow?: PrecipitationTotals;
}

function isResponseError(res: any): res is ResponseError {
  return res && typeof res.error === 'number';
}

export class BeckyBot {
  private readonly _bot: TelegramBot;
  private _sockets: RpcSocket[] = [];

  constructor(options: BotOptions) {
    this._bot = options.bot;
    options.io.of('/becky').on('connection', this._onSocket.bind(this));
  }

  async process(msg: Message, command?: string) {
    if (!command || command === 'list') {
      await this._listLocations(msg);
      return;
    }
    let match = /^add\s+(.*)\s+(-?\d+\.\d+),?\s*(-?\d+\.\d+)$/.exec(command);
    if (match) {
      const [_, name, lat, lon] = match;
      await this._addLocation(msg, name, parseFloat(lat), parseFloat(lon));
      return;
    }
    await this._pickLocations(msg, command);
  }

  private _onSocket(socket: Socket) {
    this._sockets.push(new RpcSocket(socket));
    console.log('New Becky connected. Total:', this._sockets.length);
    socket.once('disconnect', () => {
      this._sockets = this._sockets.filter((s) => s.isSocket(socket));
      console.log('Becky disconnected. Remaining:', this._sockets.length);
    });
  }

  private async _listLocations(msg: Message) {
    const socket = this._pickSocket();
    let count = 0;
    try {
      for await (
        const location of socket.each<LocationResponse>('location', {})
      ) {
        ++count;
        await this._sendLocation(msg, location);
      }
      if (count === 0) {
        await this._sendReply(msg, 'No locations.');
      }
    } catch (err) {
      await this._sendError(msg, err);
    }
  }

  private async _addLocation(msg: Message, name: string, lat: number, lon: number) {
    const socket = this._pickSocket();
    try {
      await socket.request('addLocation', {name, lat, lon});
      await this._sendReply(msg, `Added location ${name}.`);
    } catch (err) {
      await this._sendError(msg, err);
    }
  }

  private async _pickLocations(msg: Message, where: string) {
    const socket = this._pickSocket();
    let count = 0;
    try {
      for await (
        const location of
        socket.each<LocationResponse>('whereToGo', {where}, 'location')
      ) {
        ++count;
        await this._sendLocation(msg, location);
      }
      if (count === 0) {
        await this._sendReply(msg, 'No locations.');
      }
    } catch (err) {
      await this._sendError(msg, err);
    }
  }

  private _pickSocket(): RpcSocket {
    return this._sockets[0];
  }

  private async _sendError(msg: Message, err: any): Promise<void> {
    await this._bot.sendMessage(
      msg.chat.id,
      '```\n' + JSON.stringify(err, null, 2) + '\n```',
      {
        reply_to_message_id: msg.message_id,
        parse_mode: 'MarkdownV2'
      }
    );
  }

  private async _sendLocation(
    msg: Message,
    location: LocationResponse
  ): Promise<void> {
    let message = location.location.name + ': ';
    if (!location.rain && !location.snow) {
      message += 'No rain or snow in last month.';
    }
    if (location.rain) {
      if (location.rain.day) {
        message += `${f(location.rain.day)}mm rain in last day. `;
      } else if (location.rain.week) {
        message +=
          `${f(location.rain.week)}mm rain in last week, none in last day. `;
      } else {
        message +=
          `${f(location.rain.month)}mm rain in last month, none in last week. `;
      }
    }
    if (location.snow) {
      if (!location.rain) message += 'No rain in last month, ';
      if (location.snow.day) {
        message += `${f(location.snow.day)}mm snow in last day.`;
      } else if (location.snow.week) {
        message +=
          `${f(location.snow.week)}mm snow in last week, none in last day.`;
      } else {
        message +=
          `${f(location.snow.month)}mm snow in last month, none in last week.`;
      }
    }

    await this._sendReply(msg, message);
  }

  private async _sendReply(msg: Message, message: string) {
    await this._bot.sendMessage(msg.chat.id, message, {
      reply_to_message_id: msg.message_id
    });
  }

  private _emit<T extends Request, R = void>(
    socket: Socket,
    event: string,
    request: T
  ): Promise<R> {
    socket.emit(event, request);
    return new Promise<R>((resolve, reject) => {
      socket.once(request.requestId, (res: R | ResponseError) => {
        if (isResponseError(res)) {
          reject(res);
        } else {
          resolve(res);
        }
      });
    });
  }
}

function f(n: number): string {
  return n % 1 ? n.toFixed(2) : n.toString();
}
