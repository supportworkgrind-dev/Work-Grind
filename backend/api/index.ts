import { createServer } from 'http';
import app from '../src/index';
import { initSocket } from '../src/utils/socket';

initSocket(createServer());

export default app;
