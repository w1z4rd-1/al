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
  async function getTime() {
    const now = new Date();
    const offset = await getTimezone();  // Ensure this returns a valid number
    
    if (isNaN(offset)) {
      console.error('Invalid timezone offset');
      return 'Error: Invalid timezone offset';
    }
    
    console.log(`Current time: ${now}`);
    console.log(`Timezone offset: ${offset} hours`);
    
    // Adjust time by the offset (ensure it's added/subtracted correctly)
    now.setHours(now.getHours() + offset);  // Apply the offset to the current time
    
    console.log(`Adjusted time: ${now}`);
    
    // Make sure the date is valid after modification
    if (isNaN(now.getTime())) {
      console.error('Invalid time value after applying timezone offset');
      return 'Error: Invalid time value';
    }
  
    // Format the ISO string without milliseconds
    const isoTimeWithoutMilliseconds = now.toISOString().split('.')[0];
    
    // Calculate the timezone offset in the correct format ("-05:00" or "+03:00")
    const sign = offset < 0 ? '-' : '+';
    const formattedOffset = `${sign}${Math.abs(offset).toString().padStart(2, '0')}:00`;
    
    // Append the formatted offset to the ISO time
    const returnme = isoTimeWithoutMilliseconds + formattedOffset;
    
    return returnme;
  }
  
  async function createEvent(startTime, endTime, title, description) {
    const calendar = google.calendar({ version: 'v3', auth: global.auth });
    const ip = await getIP();
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

  async function getTimezone() {
    const now = new Date();
    const timezoneOffsetInMinutes = now.getTimezoneOffset();
    
    // Convert to hours and account for negative offsets (i.e., UTC+X or UTC-X)
    const offsetInHours = timezoneOffsetInMinutes / 60;
    const sign = offsetInHours > 0 ? '-' : '+';
    
    // Format the offset
    const formattedOffset = `${sign}${Math.abs(offsetInHours).toString().padStart(2, '0')}`;
    
    console.log(formattedOffset);
    return formattedOffset;
  }