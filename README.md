# Weather MCP Server
[![smithery badge](https://smithery.ai/badge/@szypetike/weather-mcp-server)](https://smithery.ai/server/@szypetike/weather-mcp-server)

[![smithery badge](https://smithery.ai/badge/@szypetike/weather-mcp-server)](https://smithery.ai/server/@szypetike/weather-mcp-server)

A Model Context Protocol (MCP) server that provides weather information for cities around the world.

## Features

- Get current weather for any city
- Provides temperature, weather conditions, humidity, wind information, and more
- Fallback to mock data if API request fails

## Requirements

- Node.js (v14 or higher)
- npm or yarn
- OpenWeather API key (optional - will use mock data if not provided)

## Installation

### Installing via Smithery

To install weather-mcp-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@szypetike/weather-mcp-server):

```bash
npx -y @smithery/cli install @szypetike/weather-mcp-server --client claude
```

### Manual Installation
1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the server:
   ```
   npm run build
   ```

## Usage

### Running locally

```
npm start
```

### Using with Claude or other MCP-compatible AI assistants

Add the following configuration to your MCP settings:

```json
{
  "mcpServers": {
    "weather-server": {
      "command": "node",
      "args": ["path/to/weather-server/build/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "your-api-key-here" // Optional - will use mock data if not provided
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### API Key and Mock Data

This server can operate in two modes:

1. **With API Key**: When an OpenWeather API key is provided via the `OPENWEATHER_API_KEY` environment variable, the server will fetch real-time weather data from the OpenWeather API.

2. **Without API Key**: If no API key is provided, the server will automatically use mock data for a set of predefined cities (London, New York, Tokyo, Paris, Sydney). For other cities, it will use default mock data.

To get an OpenWeather API key:
1. Sign up at [OpenWeather](https://openweathermap.org/)
2. Navigate to your account's "API keys" section
3. Generate a new API key or use an existing one

The mock data mode is useful for development, testing, or when you don't need real-time weather data.

## Available Tools

### get_current_weather

Get current weather information for a specified city.

**Input Schema:**
```json
{
  "city": "string" // City name (e.g., "London", "New York", "Tokyo")
}
```

**Example Response:**
```json
{
  "location": "London, GB",
  "date": "Monday, March 24, 2025",
  "time": "7:30:00 PM",
  "temperature": {
    "current": "12°C",
    "feelsLike": "10°C"
  },
  "weather": {
    "main": "Cloudy",
    "description": "Overcast clouds",
    "icon": "https://openweathermap.org/img/wn/04d@2x.png"
  },
  "details": {
    "humidity": "75%",
    "pressure": "1012 hPa",
    "windSpeed": "4.5 m/s",
    "windDirection": "230°",
    "cloudiness": "90%",
    "sunrise": "6:45 AM",
    "sunset": "7:30 PM"
  },
  "source": "OpenWeather API" // or "Mock Data (No API key provided)" or "Mock Data (API request failed)"
}
```

The `source` field in the response indicates where the data came from:
- `"OpenWeather API"`: Real-time data from the OpenWeather API
- `"Mock Data (No API key provided)"`: Mock data used because no API key was provided
- `"Mock Data (API request failed)"`: Mock data used because the API request failed

## License

MIT
