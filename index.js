import axios from 'axios';
import readline from 'readline';
import path from 'path';
import process from 'process';
import { google } from 'googleapis';
import * as localAuth from '@google-cloud/local-auth';
import fs from 'fs';
import { promises as fsp } from 'fs';
import say from 'say'; // Import say.js




console.log(say.getInstalledVoices())

// Difine global vars so we can fuck with them later
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = 'C:\\Users\\Terac\\ALFRED\\creds.json';
const TOKEN_PATH = 'C:\\Users\\Terac\\ALFRED\\token.json';
const DEFAULT_MODEL = 'deepseek-r1:7b';
const DEFAULT_PORT = 11434;
const DEFAULT_URL = 'http://localhost';
const MAX_USER_INPUT_LENGTH = 10000;  
const MAX_HISTORY_MESSAGES = 200;
const SYSTEM_MESSAGE_FILE = './int.txt'; 
let conversationHistory = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Google Calendar Functions
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
    fs.readFile(CREDENTIALS_PATH, 'utf8', (readErr, data) => {
        if (readErr) return;

        const keys = JSON.parse(data);
        const key = keys.installed || keys.web;

        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        });

        fs.writeFile(TOKEN_PATH, payload, 'utf8', () => {});
    });
}

async function authorize() {
  console.log('Attempting to load saved credentials...');
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    console.log('Loaded saved credentials successfully.');
    return client;
  }

  console.log('No saved credentials found. Attempting to authenticate...');
  
  try {
    // Log before authentication
    client = await localAuth.authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH })
  .catch(err => { console.error('Error during authentication:', err); throw err; });


    // Log after authentication
    console.log('Authentication successful!');

    if (client.credentials) {
      console.log('Authentication successful, saving credentials...');
      await saveCredentials(client);  // Save credentials after successful authentication
    }
  } catch (err) {
    console.error('Error during authentication:', err.message);
  }

  return client;
}

async function createEvent(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: 'Sample Event',
    location: '123 Sample St, Sample City, SC 12345',
    description: 'This is a sample event created via Node.js.',
    start: {
      dateTime: '2025-02-15T10:00:00-05:00',
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: '2025-02-15T11:00:00-05:00',
      timeZone: 'America/New_York',
    },
    attendees: [
      { email: 'example@example.com' },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
      ],
    },
  };

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

// Ollama Functions
async function promptOllama(messages, model, url, port) {
  try {
    const response = await axios.post(`${url}:${port}/v1/chat/completions`, {
      model: model,
      messages: messages,
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error communicating with Ollama:', error.message);
    return 'Error occurred. Please check the connection or model.';
  }
}

function initializeConversation() {
  try {
    const systemMessageContent = fs.readFileSync(SYSTEM_MESSAGE_FILE, 'utf-8');
    conversationHistory.push({ role: 'system', content: systemMessageContent });
    conversationHistory.push({ role: 'user', content: 'run script.ahk with autohotkey' });
    conversationHistory.push({ role: 'assistant', content: '<think>Alright, so now, on this new query, the user is directly asking if I can run their script named "script.ahk". I cant execute scripts directly but ive been instructed in this case to simply repeat using administrators syntax, so i should just say {AHK | script.ahk} and it will run the script</think> {AHK | script.ahk}' });
    conversationHistory.push({ role: 'user', content: 'What is the meaning of life?' });
    conversationHistory.push({ role: 'assistant', content: '42.' });
    console.log('System message loaded and conversation initialized.');
  } catch (error) {
    console.error(`Error reading the system message from ${SYSTEM_MESSAGE_FILE}:`, error.message);
    process.exit(1); // Exit if the system message cannot be loaded
  }
}

function displayHistory() {
  console.log('\n--- Conversation History ---');
  for (const message of conversationHistory) {
    const role = message.role.toUpperCase();
    console.log(`${role}: ${message.content}`);
  }
  console.log('-----------------------------\n');
}

function startConversation() {
  rl.question('\x1b[38;2;147;112;219mEnter your prompt:\x1b[0m ', async (userInput) => {
    if (userInput.toLowerCase() === 'exit') {
      console.log('Exiting the program. Goodbye!');
      rl.close();
      return;
    }

    if (userInput.toLowerCase() === 'history') {
      displayHistory();
      startConversation();
      return;
    }

    if (userInput.length > MAX_USER_INPUT_LENGTH) {
      console.log('User input exceeds the maximum allowed length of 10,000 characters.');
      startConversation();
      return;
    }

    conversationHistory.push({ role: 'user', content: userInput });

    if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
    }

    const model = DEFAULT_MODEL;
    const url = DEFAULT_URL;
    const port = DEFAULT_PORT;
    const response = await promptOllama(conversationHistory, model, url, port);
    handleAssistantResponse(response);
    startConversation(); 
  });
}

function handleAssistantResponse(response) {
  const { thoughts, speech } = splitThoughtsAndSpeech(response);
  conversationHistory.push({ role: 'assistant', content: response });
  console.log('\x1b[33m%s\x1b[0m \x1b[33m%s\x1b[0m', 'ALFRED (Speech):', speech);
}

function splitThoughtSpeechAction(input) {
    const regex = /<think>(.*?)<\/think>(.*)/s; // Match thoughts and speech
    const match = input.match(regex);
  
    let thoughts = '';
    let speech = input;
    let action = null;
  
    if (match) {
      thoughts = match[1].trim(); // Extract thoughts
      speech = match[2].trim();   // Extract speech
    }
  
    // Detect action using curly brace syntax
    const actionMatch = speech.match(/\{([^|]+)\s*\|\s*([^}]+)\}/);
    if (actionMatch) {
      action = `${actionMatch[1].trim()} | ${actionMatch[2].trim()}`; // Format action
      speech = speech.replace(actionMatch[0], '').trim(); // Remove action from speech
    }
    console.log 
    return { thoughts, speech, action };
  }
  

authorize().then(createEvent).catch(console.error);
initializeConversation();
console.clear();
say.speak('Hello, I am David!', 'Microsoft David Desktop');

startConversation();