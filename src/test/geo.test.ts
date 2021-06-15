import { GeoClient, GeoManager, GeoPosition, OptionalGeoPosition, UnknownGeoPosition } from "../geo";

class TestableGeo extends GeoManager {
  // expose protected methods
  public calcDistance(a: OptionalGeoPosition, b: OptionalGeoPosition): number {
    return super.calcDistance(a, b);
  }
  public weightedDistance(distance: number, age1ms: number, age2ms: number): number {
    return super.weightedDistance(distance, age1ms, age2ms);
  }
}

describe('matchmaker', () => {
  const geo = new TestableGeo();
  const nycGeo: GeoPosition = {
    latitude: 40.712776,
    longitude: -74.005974,
  };
  const nycClient: GeoClient = {
    sid: 'nyc',
    position: nycGeo,
    geoRadiusKM: geo.maxDistanceKM,
    ageMS: 0,
  };
  const laGeo: GeoPosition = {
    latitude: 34.052235,
    longitude: -118.243683,
  };
  const laClient: GeoClient = {
    sid: 'la',
    position: laGeo,
    geoRadiusKM: geo.maxDistanceKM,
    ageMS: 0,
  };
  const chicagoGeo: GeoPosition = {
    latitude: 41.878113,
    longitude: -87.629799,
  };
  const chicagoClient: GeoClient = {
    sid: 'chicago',
    position: chicagoGeo,
    geoRadiusKM: geo.maxDistanceKM,
    ageMS: 0,
  };
  const londonGeo: GeoPosition = {
    latitude: 51.507351,
    longitude: -0.127758,
  };
  const londonClient: GeoClient = {
    sid: 'london',
    position: londonGeo,
    geoRadiusKM: geo.maxDistanceKM,
    ageMS: 0,
  };
  const beijinGeo: GeoPosition = {
    latitude: 39.904202,
    longitude: 116.407394,
  };
  const beijinClient: GeoClient = {
    sid: 'beijin',
    position: beijinGeo,
    geoRadiusKM: geo.maxDistanceKM,
    ageMS: 0,
  };
  const tokyoGeo: GeoPosition = {
    latitude: 35.6828387,
    longitude: 139.7594549,
  };
  const tokyoClient: GeoClient = {
    sid: 'tokyo',
    position: tokyoGeo,
    geoRadiusKM: geo.maxDistanceKM,
    ageMS: 0,
  };
  const unknownGeo: OptionalGeoPosition = UnknownGeoPosition;
  const unknownClient: GeoClient = {
    sid: 'unknown',
    position: unknownGeo,
    geoRadiusKM: geo.maxDistanceKM,
    ageMS: 0,
  };

  describe('geo', () => {
    test('calcDistance', () => {
      expect(geo.calcDistance(nycGeo, nycGeo)).toBe(0);
      expect(geo.calcDistance(nycGeo, chicagoGeo)).toBe(1146);
      expect(geo.calcDistance(nycGeo, laGeo)).toBe(3940);
      expect(geo.calcDistance(nycGeo, londonGeo)).toBe(5576);
      expect(geo.calcDistance(nycGeo, beijinGeo)).toBe(11001);
      expect(geo.calcDistance(nycGeo, tokyoGeo)).toBe(10859);
      expect(geo.calcDistance(nycGeo, unknownGeo)).toBe(geo.maxDistanceKM);
    });

    test('weightedDistance', () => {
      expect(Math.round(geo.weightedDistance(100, 0, 0))).toBe(100);

      // max age = 30s, min age = 5s
      expect(Math.round(geo.weightedDistance(100, 0, 60))).toBe(100);
      expect(Math.round(geo.weightedDistance(100, 5000, 45000))).toBe(100);
      expect(Math.round(geo.weightedDistance(100, 30000, 30000))).toBe(100);
      expect(Math.round(geo.weightedDistance(100, 6000, 31000))).toBe(97);

      // transitive
      expect(Math.round(geo.weightedDistance(100, 10000, 45000))).toBe(50);
      expect(Math.round(geo.weightedDistance(100, 45000, 10000))).toBe(50);

      // only scales off higher age
      expect(Math.round(geo.weightedDistance(100, 20000, 45000))).toBe(50);
      expect(Math.round(geo.weightedDistance(100, 30000, 45000))).toBe(50);
      expect(Math.round(geo.weightedDistance(100, 45000, 45000))).toBe(50);

      // linear scaling
      expect(Math.round(geo.weightedDistance(100, 10000, 30000))).toBe(100);
      expect(Math.round(geo.weightedDistance(100, 10000, 33000))).toBe(90);
      expect(Math.round(geo.weightedDistance(100, 10000, 36000))).toBe(80);
      expect(Math.round(geo.weightedDistance(100, 10000, 39000))).toBe(70);
      expect(Math.round(geo.weightedDistance(100, 10000, 42000))).toBe(60);
      expect(Math.round(geo.weightedDistance(100, 10000, 45000))).toBe(50);
      expect(Math.round(geo.weightedDistance(100, 10000, 48000))).toBe(40);
      expect(Math.round(geo.weightedDistance(100, 10000, 51000))).toBe(30);
      expect(Math.round(geo.weightedDistance(100, 10000, 54000))).toBe(20);
      expect(Math.round(geo.weightedDistance(100, 10000, 57000))).toBe(10);
      expect(Math.round(geo.weightedDistance(100, 10000, 60000))).toBe(0);

      // cannot go below 0 distance
      expect(Math.round(geo.weightedDistance(100, 10000, 90000))).toBe(0);
    });

    test('sortAndFilterPairs', () => {
      expect(geo.sortAndFilterPairs([
        nycClient,
        beijinClient,
        tokyoClient,
        unknownClient,
      ])).toStrictEqual([{
        distanceKM: 2101,
        sid1: "beijin",
        sid2: "tokyo",
      }, {
        distanceKM: 10859,
        sid1: "nyc",
        sid2: "tokyo",
      }, {
        distanceKM: 11001,
        sid1: "nyc",
        sid2: "beijin",
      }, {
        distanceKM: 25600,
        sid1: "nyc",
        sid2: "unknown",
      }, {
        distanceKM: 25600,
        sid1: "beijin",
        sid2: "unknown",
      }, {
        distanceKM: 25600,
        sid1: "tokyo",
        sid2: "unknown",
      }]);
    });
  });
});
