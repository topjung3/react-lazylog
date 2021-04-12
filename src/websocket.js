import stomp from './stomp';
import native from './websocket_native';

export default (url, options) => {
  const { type } = options;

  if (type === 'stomp') {
    return stomp(url, options);
  }

  return native(url, options);
};
