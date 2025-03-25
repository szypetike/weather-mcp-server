#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import pino from 'pino';
// Create directory for logs if it doesn't exist
import fs from 'fs';
import path from 'path';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
// Create a Pino logger for analytics
const logFilePath = path.join(logsDir, 'server-analytics.log');
const logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
// Get Datadog API key from environment variable
const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
// Create the logger with file transport
const logger = pino.default({
    level: process.env.LOG_LEVEL || 'info',
    base: { pid: process.pid, hostname: process.env.HOSTNAME || 'unknown' },
}, 
// If Datadog API key is available, use Datadog transport, otherwise just log to file
DATADOG_API_KEY
    ? pino.transport({
        targets: [
            // Log to file
            { target: 'pino/file', options: { destination: logFilePath } },
            // Log to Datadog
            {
                target: 'pino-datadog-transport',
                options: {
                    ddClientConf: {
                        authMethods: {
                            apiKeyAuth: DATADOG_API_KEY,
                        },
                    },
                    ddsource: 'weather-server',
                    service: 'weather-server',
                    ddtags: 'env:production',
                },
            },
        ],
    })
    : logFileStream);
// OpenWeather API key - must be provided via environment variable
// Support both OPENWEATHER_API_KEY and API_KEY for compatibility with different configurations
const API_KEY = process.env.OPENWEATHER_API_KEY || process.env.API_KEY;
// Check if mock API mode is enabled
// This can be set via environment variable MOCK_API=true|false
// Default to true if API key is not provided
const MOCK_API_ENV = process.env.MOCK_API;
const MOCK_API = MOCK_API_ENV === 'true' ||
    MOCK_API_ENV === '1' ||
    (MOCK_API_ENV !== 'false' && MOCK_API_ENV !== '0' && !API_KEY);
// Check if API key is provided
const isApiKeyAvailable = !!API_KEY && !MOCK_API;
// Log environment variables for debugging
console.error('Environment variables:');
console.error('- API_KEY:', API_KEY ? '[REDACTED]' : 'not set');
console.error('- MOCK_API:', MOCK_API_ENV);
console.error('- Using mock data:', MOCK_API ? 'yes' : 'no');
// Log server startup
logger.info({
    event: 'server_start',
    apiKeyAvailable: isApiKeyAvailable,
    mockApiEnabled: MOCK_API,
    timestamp: new Date().toISOString(),
});
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
        this.server.onerror = (error) => {
            logger.error({
                event: 'server_error',
                error: String(error),
                timestamp: new Date().toISOString(),
            });
            console.error('[MCP Error]', error);
        };
        process.on('SIGINT', async () => {
            logger.info({
                event: 'server_shutdown',
                reason: 'SIGINT',
                timestamp: new Date().toISOString(),
            });
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
            source: MOCK_API ? "Mock Data (Mock API enabled)" : "Mock Data (No API key provided)"
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
                const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
                // Log the incoming request
                logger.info({
                    event: 'weather_request',
                    requestId,
                    city: args.city,
                    timestamp: new Date().toISOString(),
                });
                if (typeof args.city !== 'string' || args.city.trim() === '') {
                    logger.warn({
                        event: 'weather_request_invalid',
                        requestId,
                        error: 'Invalid city parameter',
                        timestamp: new Date().toISOString(),
                    });
                    throw new McpError(ErrorCode.InvalidParams, 'City parameter must be a non-empty string');
                }
                // If mock API is enabled or no API key is provided, use mock data
                if (MOCK_API || !API_KEY) {
                    logger.info({
                        event: 'weather_request_mock',
                        requestId,
                        city: args.city,
                        reason: MOCK_API ? 'Mock API enabled' : 'No API key provided',
                        mockApiEnabled: MOCK_API,
                        timestamp: new Date().toISOString(),
                    });
                    console.log('Using mock data', MOCK_API ? '(Mock API enabled)' : '(No API key provided)');
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
                    // Log successful API request
                    logger.info({
                        event: 'weather_request_success',
                        requestId,
                        city: args.city,
                        country: data.sys.country,
                        temperature: Math.round(data.main.temp),
                        weather: weather.main,
                        timestamp: new Date().toISOString(),
                    });
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
                    const errorMessage = axios.isAxiosError(error)
                        ? `${error.response?.status || 'unknown'}: ${error.message}`
                        : String(error);
                    // Log API error
                    logger.error({
                        event: 'weather_request_error',
                        requestId,
                        city: args.city,
                        error: errorMessage,
                        timestamp: new Date().toISOString(),
                    });
                    console.error('Error fetching weather data from API, using mock data instead:', error);
                    // Use the same mock data response method but with a different source message
                    const response = this.getMockWeatherResponse(args.city);
                    // Parse the weather report to modify the source message
                    const weatherReportText = response.content[0].text;
                    const weatherReport = JSON.parse(weatherReportText);
                    weatherReport.source = "Mock Data (API request failed)";
                    // Log fallback to mock data
                    logger.info({
                        event: 'weather_request_mock',
                        requestId,
                        city: args.city,
                        reason: 'API request failed',
                        timestamp: new Date().toISOString(),
                    });
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
            // Log unknown tool request
            logger.warn({
                event: 'unknown_tool_request',
                tool: request.params.name,
                timestamp: new Date().toISOString(),
            });
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        // Log server connection
        logger.info({
            event: 'server_connected',
            transport: 'stdio',
            timestamp: new Date().toISOString(),
        });
        console.error('Weather MCP server running on stdio');
    }
}
const server = new WeatherServer();
server.run().catch(console.error);
