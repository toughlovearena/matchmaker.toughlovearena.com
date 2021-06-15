import { GeoManager, UnknownGeoPosition } from "../geo";
import { CheckResult, Matchmaker } from "../matchmaker";
import { TimeKeeper } from "../time";

class FakeTimeKeeper implements TimeKeeper {
  private state = 0;
  _set(state: number) { this.state = state; }
  _increment(num?: number) { this.state += Math.floor(num || 1); }
  now() { return this.state; }
}

describe('matchmaker', () => {
  let result1: CheckResult | undefined;
  let result2: CheckResult | undefined;
  let result3: CheckResult | undefined;
  let result4: CheckResult | undefined;
  const resolve1 = (result: CheckResult) => { result1 = result };
  const resolve2 = (result: CheckResult) => { result2 = result };
  const resolve3 = (result: CheckResult) => { result3 = result };
  const resolve4 = (result: CheckResult) => { result4 = result };
  let mm: Matchmaker;
  let tk: FakeTimeKeeper;
  const geo = new GeoManager();

  beforeEach(() => {
    result1 = undefined;
    result2 = undefined;
    tk = new FakeTimeKeeper();
    tk._set(946771200000); // UTC 2000-01-02
    mm = new Matchmaker('test', tk);
  });

  describe('measure queueTimes', () => {
    test('host and guest connect', () => {
      const id1 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      tk._increment(1000);
      const id2 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      tk._increment(5000);
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect([id1, id2]).toContain(result1.hostId);
      expect([id1, id2]).toContain(result2.hostId);
      expect(result1).toStrictEqual({ hostId: result2.hostId, isHost: !result2.isHost, distanceKM: geo.maxDistanceKM, });
      expect(result2).toStrictEqual({ hostId: result1.hostId, isHost: !result1.isHost, distanceKM: geo.maxDistanceKM, });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 0, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({
        "2000-01-02": { "005s": 1, "006s": 1, },
      });
    });
  });

  describe('subscribe and match', () => {
    test('host and guest connect', () => {
      const id1 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      const id2 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect([id1, id2]).toContain(result1.hostId);
      expect([id1, id2]).toContain(result2.hostId);
      expect(result1).toStrictEqual({ hostId: result2.hostId, isHost: !result2.isHost, distanceKM: geo.maxDistanceKM, });
      expect(result2).toStrictEqual({ hostId: result1.hostId, isHost: !result1.isHost, distanceKM: geo.maxDistanceKM, });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 0, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({
        "2000-01-02": { "000s": 2, },
      });
    });

    test('loop will find all possible matches when it finds a match', () => {
      const id1 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      const id2 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      const id3 = mm.subscribe({ ver: 'a', mmr: 3, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve3 });
      const id4 = mm.subscribe({ ver: 'a', mmr: 3, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve4 });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 4, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect([id1, id2]).toContain(result1.hostId);
      expect([id1, id2]).toContain(result2.hostId);
      expect(result1).toStrictEqual({ hostId: result2.hostId, isHost: !result2.isHost, distanceKM: geo.maxDistanceKM, });
      expect(result2).toStrictEqual({ hostId: result1.hostId, isHost: !result1.isHost, distanceKM: geo.maxDistanceKM, });
      expect([id3, id4]).toContain(result3.hostId);
      expect([id3, id4]).toContain(result4.hostId);
      expect(result3).toStrictEqual({ hostId: result4.hostId, isHost: !result4.isHost, distanceKM: geo.maxDistanceKM, });
      expect(result4).toStrictEqual({ hostId: result3.hostId, isHost: !result3.isHost, distanceKM: geo.maxDistanceKM, });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 0, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({
        "2000-01-02": { "000s": 4, },
      });
    });

    test('host and guest do not match ver', () => {
      mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      mm.subscribe({ ver: 'b', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});
    });

    test('host and guest do not match mmr', () => {
      mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      mm.subscribe({ ver: 'a', mmr: 1, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});
    });

    test('range works upward', () => {
      const id1 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 100, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      const id2 = mm.subscribe({ ver: 'a', mmr: 100, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect([id1, id2]).toContain(result1.hostId);
      expect([id1, id2]).toContain(result2.hostId);
      expect(result1).toStrictEqual({ hostId: result2.hostId, isHost: !result2.isHost, distanceKM: geo.maxDistanceKM, });
      expect(result2).toStrictEqual({ hostId: result1.hostId, isHost: !result1.isHost, distanceKM: geo.maxDistanceKM, });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 0, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({
        "2000-01-02": { "000s": 2, },
      });
    });

    test('range does not work downward', () => {
      mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      mm.subscribe({ ver: 'a', mmr: 100, mmrRange: 220, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});
    });

    test('unsubscribe', async () => {
      mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve1 });
      const id2 = mm.subscribe({ ver: 'a', mmr: 0, mmrRange: 0, position: UnknownGeoPosition, update: () => { }, connect: resolve2 });
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 2, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.unsubscribe(id2);
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 1, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});

      mm.loop();
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(mm.simpleSnapshot()).toStrictEqual({ searching: 1, });
      expect(mm.detailedSnapshot().queueTimes).toStrictEqual({});
    });
  });
});
