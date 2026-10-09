import { createServer } from 'http';
import '../src/index';
import { initSocket } from '../src/utils/socket';

const server = createServer();
initSocket(server);

export default server;
