import { distanceMeters, withinGeofence } from './geo';

describe('geo', () => {
  it('distance ~0 for same point', () => {
    expect(distanceMeters(-6.2, 106.8, -6.2, 106.8)).toBeLessThan(1);
  });

  it('within geofence 100m', () => {
    // ~50m east of origin-ish
    const lat = -6.2;
    const lon = 106.8;
    const nearLat = -6.2004;
    const nearLon = 106.8;
    expect(withinGeofence(lat, lon, 100, nearLat, nearLon)).toBe(true);
  });

  it('outside geofence', () => {
    expect(withinGeofence(-6.2, 106.8, 50, -6.21, 106.8)).toBe(false);
  });
});
