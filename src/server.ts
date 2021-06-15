import cors from 'cors';
import express from 'express';
import SseStream from 'ssestream';
import { GeoManager, OptionalGeoPosition } from './geo';
import { Matchmaker } from './matchmaker';

export interface ServerEnv {
  label: string;
  path: string;
  casual: Matchmaker;
  ranked: Matchmaker;
}

export class Server {
  private app = express();
  private geo = new GeoManager();

  constructor(gitHash: string, envs: ServerEnv[]) {
    const started = new Date();
    this.app.use(cors());
    this.app.use(express.json());
    this.app.set('trust proxy', true);

    this.app.get('/', (req, res) => {
      res.redirect('/health');
    });
    this.app.get('/health', (req, res) => {
      const data = {
        gitHash,
        started,
        envs: envs.map(env => ({
          label: env.label,
          path: env.path,
          casual: env.casual.simpleSnapshot(),
          ranked: env.ranked.simpleSnapshot(),
        })),
      };
      res.send(data);
    });

    this.app.get('/echo', (req, res) => {
      res.send({
        ip: req.ip,
        position: this.geo.lookupIp(req.ip),
      });
    });

    this.app.get('/details', (req, res) => {
      const data = envs.map(env => ({
        label: env.label,
        path: env.path,
        casual: env.casual.detailedSnapshot(),
        ranked: env.ranked.detailedSnapshot(),
      }))
      res.send(data);
    });

    envs.forEach(env => {
      // v3
      this.app.get(env.path + '/v3/casual/anon/:ver', (req, res) => {
        const { ver } = req.params;
        const position: OptionalGeoPosition = this.geo.lookupIp(req.ip);
        this.subscribe({
          req,
          res,
          ver,
          mm: env.casual,
          mmr: 0,
          mmrRange: 0,
          position,
        });
      });
      this.app.get(env.path + '/v3/casual/account/:ver/:aid', (req, res) => {
        const { ver, aid, blockstr } = req.params;
        const position: OptionalGeoPosition = this.geo.lookupIp(req.ip);
        this.subscribe({
          req,
          res,
          ver,
          mm: env.casual,
          mmr: 0,
          mmrRange: 0,
          position,
          account: {
            aid,
            blocklist: [],
          },
        });
      });
      this.app.get(env.path + '/v3/casual/account/:ver/:aid/:blockstr', (req, res) => {
        const { ver, aid, blockstr } = req.params;
        const blocklist = (blockstr ?? '').length ? blockstr.split(',') : [];
        const position: OptionalGeoPosition = this.geo.lookupIp(req.ip);
        this.subscribe({
          req,
          res,
          ver,
          mm: env.casual,
          mmr: 0,
          mmrRange: 0,
          position,
          account: {
            aid,
            blocklist,
          },
        });
      });
      this.app.get(env.path + '/v3/ranked/:ver/:mmr/:mmrRange', (req, res) => {
        const { ver, mmr, mmrRange } = req.params;
        const position: OptionalGeoPosition = this.geo.lookupIp(req.ip);
        this.subscribe({
          req,
          res,
          ver,
          mm: env.ranked,
          mmr: parseInt(mmr, 10),
          mmrRange: parseInt(mmrRange, 10),
          position,
        });
      });
      // v4
      this.app.get(env.path + '/v4/ranked/:ver/:aid/:mmr/:mmrRange', (req, res) => {
        const { ver, aid, mmr, mmrRange } = req.params;
        const position: OptionalGeoPosition = this.geo.lookupIp(req.ip);
        this.subscribe({
          req,
          res,
          ver,
          mm: env.ranked,
          mmr: parseInt(mmr, 10),
          mmrRange: parseInt(mmrRange, 10),
          position,
          account: {
            aid,
            blocklist: [],
          },
        });
      });
    });
  }

  listen(port: number) {
    this.app.listen(port, () => {
      // tslint:disable-next-line:no-console
      console.log(`server started at http://localhost:${port}`);
    });
  }

  private subscribe(args: {
    req: express.Request,
    res: express.Response,
    ver: string,
    mm: Matchmaker,
    mmr: number,
    mmrRange: number,
    position: OptionalGeoPosition,
    account?: {
      aid: string,
      blocklist: string[],
    },
  }): void {
    const {
      req,
      res,
      ver,
      mm,
      mmr,
      mmrRange,
      position,
      account,
    } = args;
    const sseStream = new SseStream(req);
    sseStream.pipe(res);

    const sid = mm.subscribe({
      ver,
      mmr,
      mmrRange,
      position,
      account,
      update: data => sseStream.write({
        event: 'update',
        data,
      }),
      connect: data => sseStream.write({
        event: 'message',
        data,
      }),
    });

    res.on('close', () => {
      mm.unsubscribe(sid);
      sseStream.unpipe(res);
    });
  }
}
