import mitt from 'mitt';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs/esm6/compatibility/stomp';
import { List } from 'immutable';
import { encode } from './encoding';
import { bufferConcat, convertBufferToLines } from './utils';

export default (url, options) => {
  const { topic, formatMessage } = options;
  const emitter = mitt();
  let encodedLog = new Uint8Array();
  let overage = null;

  emitter.on('data', data => {
    encodedLog = bufferConcat(encodedLog, encode(data));

    const { lines, remaining } = convertBufferToLines(encode(data), overage);

    overage = remaining;

    emitter.emit('update', { lines, encodedLog });
  });

  emitter.on('done', () => {
    if (overage) {
      emitter.emit('update', { lines: List.of(overage), encodedLog });
    }

    emitter.emit('end', encodedLog);
  });

  emitter.on('start', () => {
    try {
      const socket = new SockJS(url);
      const ws = Stomp.over(socket);
      const onConnect = () => {
        ws.subscribe(topic, payload => {
          let msg = formatMessage ? formatMessage(payload.body) : payload.body;

          if (typeof msg !== 'string') return;
          // add a new line character between each message if one doesn't exist.
          // this allows our search index to properly distinguish new lines.
          msg = msg.endsWith('\n') ? msg : `${msg}\n`;

          emitter.emit('data', msg);
        });
      };

      const onError = () => {};
      const onClose = () => {};

      ws.connect({}, onConnect, onError, onClose);

      emitter.on('abort', () => ws.disconnect(() => {}));
    } catch (err) {
      emitter.emit('error', err);
    }
  });

  return emitter;
};
