export const DEFAULT_COUNTRY = 'Pakistan';

export type LocationCatalog = Record<string, string[]>;

export const LOCATION_CATALOG: LocationCatalog = {
  Pakistan: [
    'Karachi',
    'Lahore',
    'Islamabad',
    'Rawalpindi',
    'Faisalabad',
    'Multan',
    'Peshawar',
    'Quetta',
    'Sialkot',
    'Hyderabad',
  ],
};

export function getSupportedCountries(catalog: LocationCatalog = LOCATION_CATALOG): string[] {
  return Object.keys(catalog);
}

export function getCitiesForCountry(country: string, catalog: LocationCatalog = LOCATION_CATALOG): string[] {
  return catalog[country] ?? [];
}

function titleCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readCityName(entry: unknown): string | null {
  if (typeof entry === 'string') return asNonEmptyString(entry);
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;
  return asNonEmptyString(obj.name) ?? asNonEmptyString(obj.city);
}

function readCountryName(entry: unknown): string | null {
  if (typeof entry === 'string') return asNonEmptyString(entry);
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;
  const nestedCountry = obj.country;
  if (nestedCountry && typeof nestedCountry === 'object') {
    const nested = nestedCountry as Record<string, unknown>;
    return asNonEmptyString(obj.name) ?? asNonEmptyString(nested.name) ?? asNonEmptyString(nested.country);
  }
  return asNonEmptyString(obj.name) ?? asNonEmptyString(obj.country);
}

function readCountryCities(entry: unknown): unknown[] {
  if (!entry || typeof entry !== 'object') return [];
  const obj = entry as Record<string, unknown>;
  if (Array.isArray(obj.cities)) return obj.cities;
  if (Array.isArray(obj.cityOptions)) return obj.cityOptions;
  return [];
}

export function normalizeLocationCatalog(payload: unknown): LocationCatalog {
  const map: Record<string, Set<string>> = {};

  const add = (countryRaw: string, cityRaw: string) => {
    const country = titleCase(countryRaw);
    const city = titleCase(cityRaw);
    if (!country || !city) return;
    if (!map[country]) map[country] = new Set<string>();
    map[country].add(city);
  };

  if (Array.isArray(payload)) {
    payload.forEach((entry) => {
      const country = readCountryName(entry);
      if (!country) return;
      readCountryCities(entry).forEach((cityEntry) => {
        const city = readCityName(cityEntry);
        if (city) add(country, city);
      });
    });
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.catalog)) {
      obj.catalog.forEach((entry) => {
        const country = readCountryName(entry);
        if (!country) return;
        readCountryCities(entry).forEach((cityEntry) => {
          const city = readCityName(cityEntry);
          if (city) add(country, city);
        });
      });
    } else if (Array.isArray(obj.countries)) {
      obj.countries.forEach((entry) => {
        const country = readCountryName(entry);
        if (!country) return;
        readCountryCities(entry).forEach((cityEntry) => {
          const city = readCityName(cityEntry);
          if (city) add(country, city);
        });
      });
    } else {
      Object.entries(obj).forEach(([countryKey, rawCities]) => {
        if (!Array.isArray(rawCities)) return;
        rawCities.forEach((cityEntry) => {
          const city = readCityName(cityEntry);
          if (city) add(countryKey, city);
        });
      });
    }
  }

  const normalized: LocationCatalog = {};
  Object.entries(map).forEach(([country, citiesSet]) => {
    normalized[country] = Array.from(citiesSet).sort((a, b) => a.localeCompare(b));
  });
  return normalized;
}

export function withFallbackCatalog(primary: LocationCatalog): LocationCatalog {
  if (Object.keys(primary).length > 0) return primary;
  return LOCATION_CATALOG;
}
