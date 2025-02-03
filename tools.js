import { google } from 'googleapis';
import axios from 'axios';

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
  function getCurrentISOTime() {
    const now = new Date();
  
    // Convert to ISO 8601 format, ensuring it's in UTC
    const isoTime = now.toISOString();
  
    return isoTime; // Example: "2025-02-03T02:33:00.000Z"
  }
  async function getUserLocation() {
    const ip = await getIpAddress();  // Get IP address of the client (this function needs to be defined)
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
  function getTime() {
    const now = new Date();
  
    // Manually format the date and time (24-hour format)
    const hours = now.getHours().toString().padStart(2, '0');  // 24-hour format
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const day = now.getDate();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const year = now.getFullYear();
    
    // Format for "22:04 February 3, 2025"
    const formattedTime = `${hours}:${minutes} ${month} ${day}, ${year}`;
  
    // Get ISO 8601 format
    const isoTime = now.toISOString();  // Example: "2025-02-03T02:33:00.000Z"
  
    // Return both formatted time and ISO time
    return {
      humanReadable: formattedTime,
      isoTime: isoTime,
    };
  }
  async function createEvent(startTime, endTime, title, description) {
    const calendar = google.calendar({ version: 'v3', auth: global.auth });
  
    // Fetch user's location and time zone based on IP address
    const ip = await getIpAddress();  // You need to define this function to get the user's IP
    const apiUrl = `http://ip-api.com/json/${ip}?fields=timezone`;
  
    let userLocation;
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
  
      if (data.status === 'fail') {
        console.error('Error fetching location data:', data.message);
        return;
      }
  
      userLocation = {
        timezone: data.timezone,
      };
    } catch (error) {
      console.error('Error fetching location data:', error.message);
      return;
    }
  
    if (!userLocation || !userLocation.timezone) {
      console.error('Failed to get user timezone.');
      return;
    }
  
    // Create event with dynamically retrieved time zone
    const event = {
      summary: title,
      location: 'TBD', // Location can be passed as an argument if needed
      description: description || '', // Use passed description or empty string if none provided
      start: {
        dateTime: startTime, // ISO 8601 formatted start time
        timeZone: userLocation.timezone, // Use the dynamically fetched time zone
      },
      end: {
        dateTime: endTime, // ISO 8601 formatted end time
        timeZone: userLocation.timezone, // Use the dynamically fetched time zone
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      },
    };
  
    console.log('Event object:', event); // Log the event object for debugging
  
    try {
      const res = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      console.log('Event created: %s', res.data.htmlLink);
    } catch (err) {
      console.error('Error creating event:', err.message);
    }
  }
  
  
  async function getinfo() {
    try {
      // Get the public IP address of the current machine
      const ipAddress = await publicIp.v4();
      // Fetch location information from IP-API
      const response = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,currency,isp,mobile,proxy,hosting,query`);
      // Return the full JSON response to the LLM
      return response.data;
    } catch (error) {
      console.error("Error fetching IP info:", error.message);
      return { status: 'fail', message: 'Unable to retrieve IP information.' };
    }
  }
  
  
  // Define Tools
  const createEventTool = {
    type: 'function',
    function: {
      name: 'createEvent',
      description: 'Creates a Google Calendar event. Provide the start time, end time (both in ISO 8601 format yyyy-mm-ddThh:mm:ss±hh:mm), and the title for the event.',
      parameters: {
        type: 'object',
        required: ['startTime', 'endTime', 'title'],
        properties: {
          startTime: { type: 'string', description: 'Event start time in ISO 8601 format.' },
          endTime: { type: 'string', description: 'Event end time in ISO 8601 format.' },
          title: { type: 'string', description: 'The title of the event.' },
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
      description: 'Gets the current date and time, both in a readable format, and as ISO 8601',
      parameters: {
        type: 'object',
        properties: {}, // No parameters are required for this function
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
  export { availableFunctions, tools };
  