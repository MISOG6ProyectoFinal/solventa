import Geolocation from '@react-native-community/geolocation';

function loadReader() {
  let readLocation: (options?: { fresh?: boolean }) => Promise<{ address: string; gps: string }>;

  jest.isolateModules(() => {
    readLocation = require('./location').readLocation;
  });

  return readLocation!;
}

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(),
  requestAuthorization: jest.fn(),
}));

const place = {
  address: 'Carrera 7 #32-16, La Candelaria, Bogotá',
  gps: 'GPS 4.5981, -74.0760 (±12 m)',
};

function stubPosition() {
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation((success) => {
    success({
      coords: { latitude: 4.5981, longitude: -74.076, accuracy: 12 },
      timestamp: 0,
    });
  });
}

describe('readLocation', () => {
  beforeEach(() => {
    jest.mocked(Geolocation.getCurrentPosition).mockClear();
    stubPosition();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        address: {
          road: 'Carrera 7',
          house_number: '#32-16',
          suburb: 'La Candelaria',
          city: 'Bogotá',
        },
      }),
    })) as typeof fetch;
  });

  it('reuses the place already read instead of asking again', async () => {
    const readLocation = loadReader();

    await expect(readLocation()).resolves.toEqual(place);
    await expect(readLocation()).resolves.toEqual(place);

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('asks again when the previous read failed', async () => {
    const readLocation = loadReader();
    jest.mocked(Geolocation.getCurrentPosition).mockImplementationOnce((_success, error) => {
      error?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    await expect(readLocation()).rejects.toEqual(expect.objectContaining({ message: 'denied' }));
    await expect(readLocation()).resolves.toEqual(place);

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reads a new place when a fresh location is requested', async () => {
    const readLocation = loadReader();

    await expect(readLocation()).resolves.toEqual(place);

    jest.mocked(Geolocation.getCurrentPosition).mockImplementation((success) => {
      success({
        coords: { latitude: 4.711, longitude: -74.0721, accuracy: 8 },
        timestamp: 0,
      });
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        address: {
          road: 'Calle 85',
          house_number: '#12-34',
          suburb: 'Chapinero',
          city: 'Bogotá',
        },
      }),
    })) as typeof fetch;

    await expect(readLocation({ fresh: true })).resolves.toEqual({
      address: 'Calle 85 #12-34, Chapinero, Bogotá',
      gps: 'GPS 4.7110, -74.0721 (±8 m)',
    });
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
