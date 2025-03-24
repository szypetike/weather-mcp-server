# Weather MCP Server

A Model Context Protocol (MCP) server that provides weather information for cities around the world.

## Features

- Get current weather for any city
- Provides temperature, weather conditions, humidity, wind information, and more
- Fallback to mock data if API request fails

## Requirements

- Node.js (v14 or higher)
- npm or yarn

## Installation

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
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

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
  }
}
```

## License

MIT
