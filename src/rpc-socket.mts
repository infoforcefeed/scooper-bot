import { Socket } from 'socket.io';

interface Request {
  requestId?: string;
}

interface ResponseError {
  error: number;
}

function isResponseError(x: any): x is ResponseError {
  return x && typeof x.error === 'number' && x.error;
}

interface InvertedPromise<T> {
  promise: Promise<IteratorResult<T>>;
  resolve: (row: IteratorResult<T>) => void;
  reject: (err: ResponseError) => void;
}

class RpcSocketIterator<T> implements AsyncIterator<T>, AsyncIterable<T> {
  private readonly _nextPromises: InvertedPromise<T>[] = [];
  private readonly _eachPromises: InvertedPromise<T>[] = [];

  constructor(
    socket: Socket,
    rpc: string,
    req: Request,
    itemKey: string
  ) {
    this._addPromise();
    const itemEvent = `${req.requestId}_${itemKey}`;
    socket.on(itemEvent, this._each.bind(this));
    socket.once(req.requestId, (err?: ResponseError) => {
      socket.removeAllListeners(itemEvent);
      this._end(err);
    });
    socket.emit(rpc, req);
  }

  next(): Promise<IteratorResult<T>> {
    return this._nextPromises.shift().promise;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this;
  }

  private _each(res: T | ResponseError) {
    this._addPromise();
    if (isResponseError(res)) {
      this._eachPromises.shift().reject(res);
    } else {
      this._eachPromises.shift().resolve({value: res, done: false});
    }
  }

  private _end(err?: ResponseError) {
    if (err) {
      this._eachPromises.shift().reject(err);
    } else {
      this._eachPromises.shift().resolve({value: null, done: true});
    }
  }

  private _addPromise() {
    const prom = {
      promise: null,
      resolve: null,
      reject: null,
    } as InvertedPromise<T>;
    prom.promise = new Promise<IteratorResult<T>>((resolve, reject) => {
      prom.resolve = resolve;
      prom.reject = reject;
    });
    this._nextPromises.push(prom);
    this._eachPromises.push(prom);
  }
}

export class RpcSocket {
  private static requestCounter = 0;
  private requestPrefix = `${Math.random()}_`;

  constructor(private readonly socket: Socket) {}

  isSocket(socket: Socket): boolean {
    return this.socket === socket;
  }

  request<Res = void>(rpc: string, req: any): Promise<Res> {
    req.requestId = this.nextRequestId();
    return new Promise<Res>((resolve, reject) => {
      this.socket.once(req.requestId, (res: Res | ResponseError) => {
        if (isResponseError(res)) {
          reject(res);
        } else {
          resolve(res);
        }
      });
      this.socket.emit(rpc, req);
    });
  }

  each<
    Res,
    Req extends Request = any
  >(rpc: string, req: Req, itemKey?: string): AsyncIterable<Res> {
    if (!itemKey) itemKey = rpc;
    req.requestId = this.nextRequestId();
    return new RpcSocketIterator<Res>(this.socket, rpc, req, itemKey);
  }

  private nextRequestId(): string {
    return `${this.requestPrefix}${++RpcSocket.requestCounter}`;
  }
}
