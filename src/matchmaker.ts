import { GeoManager, OptionalGeoPosition, UnknownGeoPosition } from "./geo";
import { TimeKeeper } from "./time";
import { sortArrayOfObjects } from "./util";

interface PendingRecord {
  sid: string;
  ver: string;
  mmr: number;
  mmrRange: number;
  position: OptionalGeoPosition;
  geoRadiusKM: number;
  geoUpdated: number;
  account?: {
    aid: string,
    blocklist: string[],
  },
  created: number;
  update(result: SearchResult): void;
  connect(result: CheckResult): void;
}
export interface SearchResult {
  position: OptionalGeoPosition;
  radiusKM: number;
  radiusMaxed: boolean;
}
export interface CheckResult {
  hostId: string;
  isHost: boolean;
  distanceKM: number;
}

export class Matchmaker {
  private readonly envLabel: string;
  private readonly searching: {
    [mmid: string]: PendingRecord;
  } = {};
  private readonly queueTimes: {
    [date: string]: {
      [seconds: string]: number;
    };
  } = {};
  private counter = 0;
  private readonly tk: TimeKeeper;
  private readonly geo: GeoManager = new GeoManager();
  private readonly geoCooldownMs = 3000;
  private readonly geoStartingRadiusKM = 200;
  private readonly geoMultiplier = 2;

  constructor(envLabel: string, tk?: TimeKeeper) {
    this.envLabel = envLabel;
    this.tk = tk || {
      now: () => new Date().getTime(),
    };
  }
  private getNext() {
    return `mm-${this.envLabel}-${this.counter++}`;
  }
  private isMatch(me: PendingRecord, other: PendingRecord): boolean {
    if (me.sid === other.sid) { return false; }
    if (me.ver !== other.ver) { return false; }
    if (me.account && other.account) {
      if (me.account.aid === other.account.aid) { return false; }
      if (me.account.blocklist.includes(other.account.aid)) { return false; }
      if (other.account.blocklist.includes(me.account.aid)) { return false; }
    }
    const me1 = me.mmr;
    const me2 = me.mmr + me.mmrRange;
    const other1 = other.mmr;
    const other2 = other.mmr + other.mmrRange;
    return (me1 <= other2 && other1 <= me2);
  }
  simpleSnapshot() {
    return {
      searching: Object.keys(this.searching).length,
    }
  }
  detailedSnapshot() {
    return {
      counter: this.counter,
      searching: Object.values(this.searching).map(record => ({
        sid: record.sid,
        ver: record.ver,
        mmr: record.mmr,
        range: record.mmrRange,
        created: record.created,
      })),
      queueTimes: this.queueTimes,
    }
  }

  subscribe(args: {
    ver: string,
    mmr: number,
    mmrRange: number,
    position: OptionalGeoPosition,
    account?: {
      aid: string,
      blocklist: string[],
    },
    update: (result: SearchResult) => void,
    connect: (result: CheckResult) => void,
  }) {
    const {
      ver,
      mmr,
      mmrRange,
      position,
      account,
      update,
      connect,
    } = args;
    const sid = this.getNext();
    const now = this.tk.now();
    const client: PendingRecord = {
      sid,
      ver,
      mmr,
      mmrRange,
      position,
      geoRadiusKM: position === UnknownGeoPosition ? this.geo.maxDistanceKM : this.geoStartingRadiusKM,
      geoUpdated: now,
      account,
      update,
      connect,
      created: now,
    };
    this.searching[sid] = client;
    client.update({
      position,
      radiusKM: client.geoRadiusKM,
      radiusMaxed: client.geoRadiusKM === this.geo.maxDistanceKM,
    });
    return sid;
  }
  unsubscribe(sid: string): void {
    delete this.searching[sid];
  }
  loop() {
    const found = this.findMatch();
    if (found) {
      this.recordQueueTimes(found);
      delete this.searching[found.host.sid];
      delete this.searching[found.guest.sid];
      found.host.connect({
        hostId: found.host.sid,
        isHost: true,
        distanceKM: found.distanceKM,
      });
      found.guest.connect({
        hostId: found.host.sid,
        isHost: false,
        distanceKM: found.distanceKM,
      });
      this.loop();
    } else {
      this.increaseRadius();
    }
  }
  private increaseRadius() {
    const now = this.tk.now();
    const clients = Object.values(this.searching);
    clients.forEach(c => {
      if (c.position !== undefined) {
        const age = now - c.geoUpdated;
        if (age > this.geoCooldownMs && c.geoRadiusKM < this.geo.maxDistanceKM) {
          c.geoUpdated = now;
          c.geoRadiusKM = Math.min(this.geo.maxDistanceKM, c.geoRadiusKM * this.geoMultiplier);
          c.update({
            position: c.position,
            radiusKM: c.geoRadiusKM,
            radiusMaxed: c.geoRadiusKM === this.geo.maxDistanceKM,
          });
        }
      }
    })
  }
  private findMatch(): { host: PendingRecord, guest: PendingRecord, distanceKM: number } | undefined {
    const now = this.tk.now();
    const clients = Object.values(this.searching);
    const closePairs = this.geo.sortAndFilterPairs(clients.map(c => ({
      sid: c.sid,
      position: c.position,
      geoRadiusKM: c.geoRadiusKM,
      ageMS: now - c.created,
    })));
    for (const pair of closePairs) {
      const host = this.searching[pair.sid1];
      const guest = this.searching[pair.sid2];
      if (host && guest && this.isMatch(host, guest)) {
        return { host, guest, distanceKM: pair.distanceKM, };
      }
    }
  }
  private formatNowAsDate(now: number) {
    const d = new Date(now);
    const year = d.getUTCFullYear();
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    return [year, month, day].join('-');
  }
  private recordQueueTimes(match: { host: PendingRecord, guest: PendingRecord }): void {
    const now = this.tk.now();
    const date = this.formatNowAsDate(now);
    const queueDate = this.queueTimes[date] || {};
    [match.host, match.guest].map(pr => {
      const waitSeconds = Math.round((now - pr.created) / 1000);
      const secondsKey = (waitSeconds + 's').padStart(4, '0');
      queueDate[secondsKey] = (queueDate[secondsKey] || 0) + 1;
    });
    this.queueTimes[date] = queueDate;

    // purge old day counts
    const queueTimeKeys = Object.keys(this.queueTimes);
    if (queueTimeKeys.length > 3) {
      const sorted = sortArrayOfObjects(queueTimeKeys, s => s);
      delete this.queueTimes[sorted[0]];
    }
  }
}
