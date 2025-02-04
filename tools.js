import { google } from 'googleapis';
import axios from 'axios';
export { availableFunctions, tools };

/**
 * Adds two numbers together.
 * @param {object|string} args - An object or a JSON string containing properties 'a' and 'b'.
 * @returns {number} The sum of a and b.
 */
function addTwoNumbers(args) {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    const { a, b } = parsedArgs;
    console.log('function running');
    return a + b;
  }
  async function getUserLocation() {
    const ip = await getIP()
    const apiUrl = `http://ip-api.com/json/${ip}?fields=lat,lon,timezone`;
  
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
  
      if (data.status === 'fail') {
        console.error('Error fetching location data:', data.message);
        return null;
      }
  
      return {
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone,
      };
    } catch (error) {
      console.error('Error fetching location data:', error.message);
      return null;
    }
  }
  async function getIP() {
    return "146.70.165.92"; //this is a random vpn in new york, ill make it lookup its own ip later
  }

  function getTime() {
    const now = new Date();
    
    // Fetch the user's timezone offset (as a number) synchronously
    const offset = getTimezone(); // Assumes getTimezone() returns a number, e.g., -5
    
    // Adjust time by the offset (this adds the offset hours to the current time)
    now.setHours(now.getHours() + offset);
    
    // Format the ISO string without milliseconds
    const isoTimeWithoutMilliseconds = now.toISOString().split('.')[0];
    
    // Calculate the timezone offset in the correct format ("-05:00" or "+03:00")
    const sign = offset < 0 ? '-' : '+';
    const formattedOffset = `${sign}${Math.abs(offset).toString().padStart(2, '0')}:00`;
    
    // Append the formatted offset to the ISO time
    const isoWithOffset = isoTimeWithoutMilliseconds + formattedOffset;
    
    // Get the day of the week in full textual format (e.g., "Monday")
    const dayOfWeek = now.toLocaleString('en-US', { weekday: 'long' });
    
    // Return both the ISO formatted time and the day of the week
    return isoWithOffset;
  }
  
  async function createEvent(args) {
    // If args is a JSON string, parse it; otherwise assume it's an object
    const { startTime, endTime, title, description } =
      typeof args === 'string' ? JSON.parse(args) : args;
    
    // Convert startTime to a Date object and get the current time
    const eventStart = new Date(startTime);
    const now = new Date();
    
    // Check if the event's start time is in the past
    if (eventStart < now) {
      // Assume getTime() is an async function that returns a string with the current time
      const currentTime = await getTime();
      return `The date and time entered is in the past, the current time is: ${currentTime}`;
    }
    
    // Create a Google Calendar client using the globally available auth object
    const calendar = google.calendar({ version: 'v3', auth: global.auth });
    
    // Construct the event object
    const event = {
      summary: title,
      location: 'TBD',
      description: description || '',
      start: {
        dateTime: startTime,  // Must be an ISO 8601 string with timezone (e.g., "2025-02-03T10:00:00-05:00")
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime,    // Must be an ISO 8601 string with timezone
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      },
    };
    
    console.log('Event object:', event); // Debug output
    
    try {
      const res = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      return `Event titled "${title}" created starting at "${startTime}" and ending at "${endTime}". View it here: ${res.data.htmlLink}`;
    } catch (err) {
      console.error('Error creating event:', err.message);
      throw err;
    }
  }
  
  async function getinfo() {
    try {
      // Get the public IP address of the current machine
      const ipAddress = getIP;
      // Fetch location information from IP-API
      const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,currency,isp,mobile,proxy,hosting,query`);
      // Return the full JSON response to the LLM
      return response.data;
    } catch (error) {
      console.error("Error fetching IP info:", error.message);
      return { status: 'fail', message: 'Unable to retrieve IP information.' };
    }
  }

  const createEventTool = {
    type: 'function',
    function: {
      name: 'createEvent',
      description: 'Creates a new event in Google Calendar. must be ISO 8601 format with timezone (e.g., "2025-02-03T10:00:00-05:00").',
      parameters: {
        type: 'object',
        required: ['startTime', 'endTime', 'title', 'description'],
        properties: {
          startTime: {
            type: 'string',
            description: 'The start time of the event in ISO 8601 format with timezone offset.'
          },
          endTime: {
            type: 'string',
            description: 'The end time of the event in ISO 8601 format with timezone offset.'
          },
          title: {
            type: 'string',
            description: 'The title (summary) of the event.'
          },
          description: {
            type: 'string',
            description: 'A description of the event.'
          },
        },
      },
    },
  };
  
  const addTwoNumbersTool = {
    type: 'function',
    function: {
      name: 'addTwoNumbers',
      description: 'Adds two numbers together.',
      parameters: {
        type: 'object',
        required: ['a', 'b'],
        properties: {
          a: { type: 'number', description: 'The first number' },
          b: { type: 'number', description: 'The second number' },
        },
      },
    },
  };
  const getinfoTool = {
    type: 'function',
    function: {
      name: 'getinfo',
      description: 'Fetches useful information from the users ip',
      parameters: {
        type: 'object',
        required: [],
        properties: {},
      },
    },
  };
  const getTimeTool = {
    type: 'function',
    function: {
      name: 'getTime',
      description: 'Gets the current date and time, as ISO 8601, as well as the day of the week, recomended before running createevent',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  };
  const getUserLocationTool = {
    type: 'function',
    function: {
      name: 'getUserLocation',
      description: 'Fetches the user\'s GPS coordinates (latitude, longitude) and timezone',
      parameters: {
        type: 'object',
        required: [],
        properties: {},
      },
    },
  };
  
  // Global array of tools – add additional tools here as needed
  const tools = [ addTwoNumbersTool, getTimeTool, createEventTool, getinfoTool ];
  
  // Mapping of available functions for runtime invocation
  const availableFunctions = {
    getinfo,
    addTwoNumbers,
    getTime,
    createEvent,
    getUserLocation,
  };
  
  // Export the functions, tool definition, available functions mapping, and tools array

  function getTimezone() {
    const now = new Date();
    const timezoneOffsetInMinutes = now.getTimezoneOffset();
    const offsetInHours = timezoneOffsetInMinutes / 60;
    return -offsetInHours;
  }