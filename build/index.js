#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
// OpenWeather API key - must be provided via environment variable
const API_KEY = process.env.OPENWEATHER_API_KEY;
// Check if API key is provided
const isApiKeyAvailable = !!API_KEY;
// Mock weather data for fallback
const mockWeatherData = {
    'london': {
        name: 'London',
        country: 'GB',
        temp: 12,
        feels_like: 10,
        humidity: 75,
        pressure: 1012,
        weather: 'Cloudy',
        description: 'Overcast clouds',
        icon: '04d',
        wind_speed: 4.5,
        wind_deg: 230,
        cloudiness: 90,
        sunrise: '6:45 AM',
        sunset: '7:30 PM',
    },
    'new york': {
        name: 'New York',
        country: 'US',
        temp: 18,
        feels_like: 17,
        humidity: 65,
        pressure: 1015,
        weather: 'Clear',
        description: 'Clear sky',
        icon: '01d',
        wind_speed: 3.2,
        wind_deg: 180,
        cloudiness: 5,
        sunrise: '6:30 AM',
        sunset: '7:15 PM',
    },
    'tokyo': {
        name: 'Tokyo',
        country: 'JP',
        temp: 22,
        feels_like: 23,
        humidity: 70,
        pressure: 1010,
        weather: 'Rain',
        description: 'Light rain',
        icon: '10d',
        wind_speed: 2.8,
        wind_deg: 90,
        cloudiness: 75,
        sunrise: '5:30 AM',
        sunset: '6:45 PM',
    },
    'paris': {
        name: 'Paris',
        country: 'FR',
        temp: 15,
        feels_like: 14,
        humidity: 68,
        pressure: 1013,
        weather: 'Partly Cloudy',
        description: 'Few clouds',
        icon: '02d',
        wind_speed: 3.0,
        wind_deg: 210,
        cloudiness: 30,
        sunrise: '7:00 AM',
        sunset: '8:00 PM',
    },
    'sydney': {
        name: 'Sydney',
        country: 'AU',
        temp: 25,
        feels_like: 26,
        humidity: 60,
        pressure: 1008,
        weather: 'Sunny',
        description: 'Clear sky',
        icon: '01d',
        wind_speed: 5.0,
        wind_deg: 150,
        cloudiness: 0,
        sunrise: '6:15 AM',
        sunset: '7:45 PM',
    }
};
// Default weather data for cities not in the mock data
const defaultWeatherData = {
    name: 'Unknown City',
    country: 'World',
    temp: 20,
    feels_like: 20,
    humidity: 70,
    pressure: 1013,
    weather: 'Clear',
    description: 'Clear sky',
    icon: '01d',
    wind_speed: 3.0,
    wind_deg: 180,
    cloudiness: 20,
    sunrise: '6:30 AM',
    sunset: '7:30 PM',
};
class WeatherServer {
    constructor() {
        this.server = new Server({
            name: 'weather-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.axiosInstance = axios.create({
            baseURL: 'https://api.openweathermap.org/data/2.5',
            params: {
                appid: API_KEY,
                units: 'metric', // Use metric units (Celsius)
            },
        });
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    getMockWeatherResponse(city) {
        // Get city name in lowercase for case-insensitive lookup
        const cityLower = city.toLowerCase();
        // Get weather data for the city or use default if not found
        const cityData = mockWeatherData[cityLower] || {
            ...defaultWeatherData,
            name: city
        };
        // Get current date and time
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        const formattedTime = now.toLocaleTimeString('en-US');
        const weatherReport = {
            location: `${cityData.name}, ${cityData.country}`,
            date: formattedDate,
            time: formattedTime,
            temperature: {
                current: `${Math.round(cityData.temp)}°C`,
                feelsLike: `${Math.round(cityData.feels_like)}°C`,
            },
            weather: {
                main: cityData.weather,
                description: cityData.description,
                icon: `https://openweathermap.org/img/wn/${cityData.icon}@2x.png`,
            },
            details: {
                humidity: `${cityData.humidity}%`,
                pressure: `${cityData.pressure} hPa`,
                windSpeed: `${cityData.wind_speed} m/s`,
                windDirection: `${cityData.wind_deg}°`,
                cloudiness: `${cityData.cloudiness}%`,
                sunrise: cityData.sunrise,
                sunset: cityData.sunset,
            },
            source: "Mock Data (No API key provided)"
        };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(weatherReport, null, 2),
                },
            ],
        };
    }
    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'get_current_weather',
                    description: 'Get current weather for a specified city',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            city: {
                                type: 'string',
                                description: 'City name (e.g., "London", "New York", "Tokyo")',
                            },
                        },
                        required: ['city'],
                    },
                },
            ],
        }));
        // Handle tool call requests
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === 'get_current_weather') {
                const args = request.params.arguments;
                if (typeof args.city !== 'string' || args.city.trim() === '') {
                    throw new McpError(ErrorCode.InvalidParams, 'City parameter must be a non-empty string');
                }
                // If no API key is provided, use mock data directly
                if (!isApiKeyAvailable) {
                    console.log('No API key provided, using mock data');
                    return this.getMockWeatherResponse(args.city);
                }
                try {
                    // Try to get weather data from the API
                    const response = await this.axiosInstance.get('weather', {
                        params: { q: args.city },
                    });
                    const data = response.data;
                    const weather = data.weather[0];
                    // Format date and time
                    const date = new Date(data.dt * 1000);
                    const formattedDate = date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    });
                    const formattedTime = date.toLocaleTimeString('en-US');
                    // Format sunrise and sunset times
                    const sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString('en-US');
                    const sunset = new Date(data.sys.sunset * 1000).toLocaleTimeString('en-US');
                    const weatherReport = {
                        location: `${data.name}, ${data.sys.country}`,
                        date: formattedDate,
                        time: formattedTime,
                        temperature: {
                            current: `${Math.round(data.main.temp)}°C`,
                            feelsLike: `${Math.round(data.main.feels_like)}°C`,
                        },
                        weather: {
                            main: weather.main,
                            description: weather.description,
                            icon: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`,
                        },
                        details: {
                            humidity: `${data.main.humidity}%`,
                            pressure: `${data.main.pressure} hPa`,
                            windSpeed: `${data.wind.speed} m/s`,
                            windDirection: `${data.wind.deg}°`,
                            cloudiness: `${data.clouds.all}%`,
                            sunrise,
                            sunset,
                        },
                        source: "OpenWeather API"
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(weatherReport, null, 2),
                            },
                        ],
                    };
                }
                catch (error) {
                    // If API request fails, use mock data as fallback
                    console.error('Error fetching weather data from API, using mock data instead:', error);
                    // Use the same mock data response method but with a different source message
                    const response = this.getMockWeatherResponse(args.city);
                    // Parse the weather report to modify the source message
                    const weatherReportText = response.content[0].text;
                    const weatherReport = JSON.parse(weatherReportText);
                    weatherReport.source = "Mock Data (API request failed)";
                    // Return the modified response
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(weatherReport, null, 2),
                            },
                        ],
                    };
                }
            }
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Weather MCP server running on stdio');
    }
}
const server = new WeatherServer();
server.run().catch(console.error);
