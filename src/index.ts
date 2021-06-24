import { Updater } from '@toughlovearena/updater';
import { Matchmaker } from './matchmaker';
import { Server, ServerEnv } from './server';
import { sleep } from './util';

const envs: ServerEnv[] = [{
  label: 'prod',
  path: '',
  casual: new Matchmaker('prod-casual'),
  ranked: new Matchmaker('prod-ranked'),
}, {
  label: 'beta',
  path: '/beta',
  casual: new Matchmaker('beta-casual'),
  ranked: new Matchmaker('beta-ranked'),
}];

(async () => {
  // start SSE server
  const updater = new Updater();
  new Server(updater, envs).listen(2999);
  updater.cron();

  // start interval to send SSE
  while (true) {
    await sleep(1000);
    envs.forEach(env => {
      env.casual.loop();
      env.ranked.loop();
    });
  }
})();
