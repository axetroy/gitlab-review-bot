import { Promise, longStackTraces } from 'bluebird';

longStackTraces();

global.Promise = Promise as unknown as PromiseConstructor;
