// ---------------------------------------------------------
// weatherService.js
// THIRD-PARTY API INTEGRATION: Open-Meteo (https://open-meteo.com)
//
// Gives the weather at an event's venue. Two Open-Meteo APIs
// are called, one after the other:
//   1. Geocoding API - turns a place name such as "Kuala Lumpur"
//                      into latitude and longitude
//   2. Forecast API  - returns the weather for those coordinates
//
// Open-Meteo is free for non-commercial use and needs no API key,
// so there is no secret to store. The two addresses can still be
// changed in .env without touching the code.
//
// API management feature 3: CACHING
// Results are kept in memory for 30 minutes. Opening the same
// event again within that time does not call Open-Meteo again,
// which is faster and avoids overusing a free service.
// ---------------------------------------------------------

const GEOCODING_URL =
  process.env.GEOCODING_API_URL || "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL =
  process.env.WEATHER_API_URL || "https://api.open-meteo.com/v1/forecast";

const CACHE_MINUTES = 30;
const TIMEOUT_MS = 8000;

// key -> { value, expiresAt }
const cache = new Map();

function readCache(key) {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }
  cache.delete(key);
  return null;
}

function writeCache(key, value) {
  cache.set(key, {
    value: value,
    expiresAt: Date.now() + CACHE_MINUTES * 60 * 1000
  });
}

// Open-Meteo describes the weather with a WMO code number
const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail"
};

function describe(code) {
  return WEATHER_CODES[code] || "Unknown";
}

// Calls an external address and returns its JSON.
// Gives up after 8 seconds so our own API never hangs.
async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error("Weather provider answered " + response.status);
  }

  return response.json();
}

// Step 1: place name -> coordinates
async function findCoordinates(location) {
  const key = "place:" + location.toLowerCase();
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  const base =
    GEOCODING_URL +
    "?name=" + encodeURIComponent(location) +
    "&count=1&language=en&format=json";

  // Look inside Malaysia first, then anywhere
  let data = await fetchJson(base + "&countryCode=MY");
  if (!data.results || data.results.length === 0) {
    data = await fetchJson(base);
  }

  if (!data.results || data.results.length === 0) {
    const error = new Error("Location not found: " + location);
    error.code = "LOCATION_NOT_FOUND";
    throw error;
  }

  const place = data.results[0];
  const coordinates = {
    name: place.name,
    country: place.country || "",
    latitude: place.latitude,
    longitude: place.longitude
  };

  writeCache(key, coordinates);
  return coordinates;
}

// A JavaScript Date -> "YYYY-MM-DD" in the server's own time zone
function toDateText(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return (
    date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
  );
}

// Step 2: coordinates -> weather.
// Returns the forecast for the event day when it is within
// Open-Meteo's 16-day range, otherwise the weather right now.
async function getEventWeather(location, eventDate) {
  const eventDay = toDateText(new Date(eventDate));
  const key = "weather:" + location.toLowerCase() + ":" + eventDay;

  const cached = readCache(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  const place = await findCoordinates(location);

  const url =
    FORECAST_URL +
    "?latitude=" + place.latitude +
    "&longitude=" + place.longitude +
    "&current=temperature_2m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=auto&forecast_days=16";

  const data = await fetchJson(url);

  if (!data.daily || !Array.isArray(data.daily.time) || !data.current) {
    throw new Error("Weather provider sent an unexpected response");
  }

  const index = data.daily.time.indexOf(eventDay);
  let weather;

  if (index >= 0) {
    weather = {
      type: "forecast",
      date: eventDay,
      summary: describe(data.daily.weather_code[index]),
      temperature_max: data.daily.temperature_2m_max[index],
      temperature_min: data.daily.temperature_2m_min[index],
      rain_chance: data.daily.precipitation_probability_max[index]
    };
  } else {
    weather = {
      type: "current",
      summary: describe(data.current.weather_code),
      temperature: data.current.temperature_2m,
      note: "A forecast for the event day becomes available 16 days before the event."
    };
  }

  const result = {
    place: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    weather: weather,
    source: "Open-Meteo"
  };

  writeCache(key, result);
  return { ...result, cached: false };
}

module.exports = { getEventWeather };
