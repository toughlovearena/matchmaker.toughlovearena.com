import geoip from 'geoip-lite';
import haversine from 'haversine-distance';
import { sortArrayOfObjects } from './util';

export interface GeoPosition {
  latitude: number;
  longitude: number;
}
export const UnknownGeoPosition = 'n/a';
export type OptionalGeoPosition = GeoPosition | typeof UnknownGeoPosition;
export interface GeoClient {
  sid: string;
  position: OptionalGeoPosition;
  geoRadiusKM: number;
  ageMS: number;
}
export interface GeoEdge {
  host: GeoClient;
  guest: GeoClient;
  distanceKM: number;
  weightedDistanceKM: number;
}
export interface GeoPair {
  sid1: string;
  sid2: string;
  distanceKM: number;
}

export class GeoManager {
  readonly maxDistanceKM = 25600;
  readonly minAgeWeightMS = 5 * 1000;
  readonly maxAgeWeightMS = 30 * 1000;

  lookupIp(ip: string): OptionalGeoPosition {
    const geoLookup = geoip.lookup(ip);
    if (geoLookup && geoLookup.ll && geoLookup.ll.length === 2) {
      return {
        latitude: geoLookup.ll[0],
        longitude: geoLookup.ll[1],
      };
    }
    return UnknownGeoPosition;
  }

  // return in whole kms
  protected calcDistance(a: OptionalGeoPosition, b: OptionalGeoPosition): number {
    if (a === UnknownGeoPosition || b === UnknownGeoPosition) {
      return this.maxDistanceKM;
    }
    const meters = haversine(a, b);
    if (isNaN(meters)) {
      return this.maxDistanceKM;
    }
    return Math.round(meters / 1000);
  }

  protected weightedDistance(distance: number, age1ms: number, age2ms: number): number {
    const minAge = Math.min(age1ms, age2ms);
    const maxAge = Math.max(age1ms, age2ms);
    // if either is too fresh (less than 5 seconds), return normal distance
    if (minAge <= this.minAgeWeightMS) { return distance; }
    // if either isn't old enough (less than 30 seconds), return normal distance
    if (maxAge <= this.maxAgeWeightMS) { return distance; }
    // if both are at least 5 seconds old, and at least one if VERY old, then start weighting based on the older one
    // start linear decaying at 30s, decay = 0%. at 60s, decay = 100%
    const agePastCutoff = maxAge - this.maxAgeWeightMS;
    const percentDecay = Math.min(1, agePastCutoff / this.maxAgeWeightMS);
    const percentRetain = Math.max(0, 1 - percentDecay);
    return distance * percentRetain;
  }

  sortAndFilterPairs(clients: GeoClient[]): GeoPair[] {
    const allEdges: GeoEdge[] = [];
    for (let a = 0; a < clients.length - 1; a++) {
      for (let b = a + 1; b < clients.length; b++) {
        const host = clients[a];
        const guest = clients[b];
        const distanceKM = this.calcDistance(host.position, guest.position);
        const weightedDistanceKM = this.weightedDistance(distanceKM, host.ageMS, guest.ageMS);
        allEdges.push({ host, guest, distanceKM, weightedDistanceKM });
      }
    }
    const legalEdges = allEdges.filter(e => (
      e.weightedDistanceKM <= e.host.geoRadiusKM &&
      e.weightedDistanceKM <= e.guest.geoRadiusKM
    ));
    const sortedEdges = sortArrayOfObjects(legalEdges.concat(), e => e.weightedDistanceKM);
    return sortedEdges.map(edge => ({
      sid1: edge.host.sid,
      sid2: edge.guest.sid,
      distanceKM: edge.distanceKM,
    }));
  }
}
