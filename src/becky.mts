import TelegramBot, {Message} from 'node-telegram-bot-api';
import { Server as SocketIoServer, Socket } from 'socket.io';

interface BotOptions {
  bot: TelegramBot,
  io: SocketIoServer
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

export class BeckyBot {
  private readonly _bot: TelegramBot;
  private readonly _sockets: Socket[] = [];

  constructor(options: BotOptions) {
    this._bot = options.bot;
    options.io.of('/becky').on('connection', this._onSocket.bind(this));
  }

  process(msg: Message, command?: string) {
    if (!command || command === 'list') {
      this._listLocations(msg);
      return;
    }
  }

  private _onSocket(socket: Socket) {
    this._sockets.push(socket);
  }

  private _listLocations(msg: Message) {
    const requestId = _makeRequestId();
    const socket = this._pickSocket();
    let count = 0;
    socket.on(`${requestId}_location`, async (location: LocationResponse) => {
      ++count;
      await this._sendLocation(msg, location);
    });
    socket.on(`${requestId}`, async (err: any) => {
      socket.removeAllListeners(`${requestId}_location`);
      if (err) {
        await this._sendError(msg, err);
      } else if (count === 0) {
        await this._bot.sendMessage(msg.chat.id, 'No locations.', {
          reply_to_message_id: msg.message_id
        });
      }
    });
    socket.emit('listLocations', {requestId});
  }

  private _pickSocket(): Socket {
    return this._sockets[0];
  }

  private async _sendError(msg: Message, err: Error): Promise<void> {
    await this._bot.sendMessage(
      msg.chat.id,
      '```\n' + err.toString() + '\n```',
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
        message += `${location.rain.day}mm rain in last day. `;
      } else if (location.rain.week) {
        message +=
          `${location.rain.week}mm rain in last week, none in last day. `;
      } else {
        message +=
          `${location.rain.month}mm rain in last month, none in last week. `;
      }
    }
    if (location.snow) {
      if (!location.rain) message += 'No rain in last month, ';
      if (location.snow.day) {
        message += `${location.snow.day}mm snow in last day.`;
      } else if (location.snow.week) {
        message +=
          `${location.snow.week}mm snow in last week, none in last day.`;
      } else {
        message +=
          `${location.snow.month}mm snow in last month, none in last week.`;
      }
    }

    await this._bot.sendMessage(msg.chat.id, message, {
      reply_to_message_id: msg.message_id
    });
  }
}

function _makeRequestId(): string {
  return Math.random().toString();
}
