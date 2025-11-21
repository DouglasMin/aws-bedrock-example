/**
 * Weather Tool - Get current weather for a city
 * Uses Open-Meteo API (free, no API key required)
 */

function getToolSpec() {
  return {
    toolSpec: {
      name: "get_weather",
      description: "Get current weather information for a specific city. Use this when user asks about weather, temperature, or climate conditions.",
      inputSchema: {
        json: JSON.stringify({
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name in English (e.g., Seoul, Tokyo, New York, Paris)"
            }
          },
          required: ["city"]
        })
      }
    }
  };
}

async function execute(params) {
  const { city } = params;
  
  try {
    // Step 1: Get coordinates from city name using Nominatim (OpenStreetMap)
    const geoResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'NovaSonicToolUse/1.0'
        }
      }
    );
    
    if (!geoResponse.ok) {
      return { error: `Failed to find location for ${city}` };
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData || geoData.length === 0) {
      return { error: `City not found: ${city}` };
    }
    
    const { lat, lon, display_name } = geoData[0];
    
    // Step 2: Get weather data using Open-Meteo API
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`
    );
    
    if (!weatherResponse.ok) {
      return { error: `Failed to get weather data for ${city}` };
    }
    
    const weatherData = await weatherResponse.json();
    const current = weatherData.current_weather;
    
    // Weather code mapping
    const weatherCodes = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };
    
    return {
      location: display_name,
      temperature: `${current.temperature}°C`,
      windSpeed: `${current.windspeed} km/h`,
      condition: weatherCodes[current.weathercode] || 'Unknown',
      time: current.time
    };
    
  } catch (error) {
    console.error('Weather tool error:', error);
    return { 
      error: `Failed to get weather information: ${error.message}` 
    };
  }
}

module.exports = { getToolSpec, execute };
