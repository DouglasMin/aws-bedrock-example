"""
Weather Tool - Get current weather for a city
Uses Open-Meteo API (free, no API key required)
"""
import json
import httpx
from typing import Dict, Any


def get_tool_spec() -> Dict:
    """Get the tool specification for Bedrock"""
    return {
        "toolSpec": {
            "name": "get_weather",
            "description": "Get current weather information for a specific city. Use this when user asks about weather, temperature, or climate conditions.",
            "inputSchema": {
                "json": json.dumps({
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "City name in English (e.g., Seoul, Tokyo, New York, Paris)"
                        }
                    },
                    "required": ["city"]
                })
            }
        }
    }


async def execute(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute the weather tool
    
    Args:
        params: Dictionary with 'city' key
        
    Returns:
        Weather information dictionary
    """
    city = params.get("city")
    
    if not city:
        return {"error": "City parameter is required"}
    
    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get coordinates from city name using Nominatim (OpenStreetMap)
            geo_response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": city,
                    "format": "json",
                    "limit": 1
                },
                headers={
                    "User-Agent": "NovaSonicPython/1.0"
                },
                timeout=10.0
            )
            
            if geo_response.status_code != 200:
                return {"error": f"Failed to find location for {city}"}
            
            geo_data = geo_response.json()
            
            if not geo_data or len(geo_data) == 0:
                return {"error": f"City not found: {city}"}
            
            lat = geo_data[0]["lat"]
            lon = geo_data[0]["lon"]
            display_name = geo_data[0]["display_name"]
            
            # Step 2: Get weather data using Open-Meteo API
            weather_response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current_weather": "true",
                    "temperature_unit": "celsius"
                },
                timeout=10.0
            )
            
            if weather_response.status_code != 200:
                return {"error": f"Failed to get weather data for {city}"}
            
            weather_data = weather_response.json()
            current = weather_data["current_weather"]
            
            # Weather code mapping
            weather_codes = {
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
            }
            
            return {
                "location": display_name,
                "temperature": f"{current['temperature']}°C",
                "windSpeed": f"{current['windspeed']} km/h",
                "condition": weather_codes.get(current['weathercode'], 'Unknown'),
                "time": current['time']
            }
            
    except httpx.TimeoutException:
        return {"error": f"Request timeout while fetching weather for {city}"}
    except httpx.RequestError as e:
        return {"error": f"Network error: {str(e)}"}
    except Exception as e:
        return {"error": f"Failed to get weather information: {str(e)}"}
