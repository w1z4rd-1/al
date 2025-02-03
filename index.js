import axios from 'axios';
import readline from 'readline';
import path from 'path';
import process from 'process';
import { google } from 'googleapis';
import * as localAuth from '@google-cloud/local-auth';
import fs from 'fs';
import { promises as fsp } from 'fs';
import say from 'say'; // switch to better TTS later
import { tools, availableFunctions } from './tools.js';




console.log(say.getInstalledVoices())

// Difine global vars so we can fuck with them later
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = 'C:\\Users\\Terac\\ALFRED\\creds.json';
const TOKEN_PATH = 'C:\\Users\\Terac\\ALFRED\\token.json';
const DEFAULT_MODEL = 'qwen2.5:7b';
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
    // Read the token file
    const content = await fsp.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials); // Return the authenticated client
  } catch (err) {
    console.error('Error loading saved credentials:', err.message);
    return null; // Return null if token file doesn't exist or an error occurs
  }
}


async function saveCredentials(client) {
  try {
    // Read credentials.json to extract client_id and client_secret
    const data = await fsp.readFile(CREDENTIALS_PATH, 'utf8');
    const keys = JSON.parse(data);
    const key = keys.installed || keys.web;

    // Construct the token payload
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });

    // Save the token to TOKEN_PATH
    await fsp.writeFile(TOKEN_PATH, payload, 'utf8');
    console.log('Credentials saved successfully.');
  } catch (err) {
    console.error('Error saving credentials:', err.message);
  }
}

async function authorize() {
  console.log('Attempting to load saved credentials...');
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    console.log('Loaded saved credentials successfully.');
    global.auth = client; // Assign the client to global.auth immediately after loading saved credentials
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

    global.auth = client; // Assign the authenticated client to global.auth
  } catch (err) {
    console.error('Error during authentication:', err.message);
  }

  return client;
}




// Ollama Functions
async function promptOllama(messages, model, url, port, tools) {
  try {
    const response = await axios.post(`${url}:${port}/v1/chat/completions`, {
      model: model,
      messages: messages,
      tools: tools, // Include the tools array in the request body
    });

    const result = response.data.choices[0].message;

    // Handle tool calls if present
    if (result.tool_calls) {
      for (const tool of result.tool_calls) {
        const functionToCall = availableFunctions[tool.function.name];
        if (functionToCall) {
          console.log('Calling function:', tool.function.name);
          console.log('Arguments:', tool.function.arguments);

          // Call the function with its arguments
          const output = functionToCall(tool.function.arguments);
          console.log('Function output:', output);

          // Add tool output to the conversation history
          messages.push({ role: 'assistant', content: result.content });
          messages.push({ role: 'tool', content: output.toString() });

          // Re-prompt the model with the updated messages
          return await promptOllama(messages, model, url, port, tools);
        } else {
          console.error('Function not found:', tool.function.name);
        }
      }
    }

    // Return the final response if no tool calls are needed
    return result.content;
  } catch (error) {
    console.error('Error communicating with Ollama:', error.message);
    return 'Error occurred. Please check the connection or model.';
  }
}


function initializeConversation() {
  try {
    const systemMessageContent = fs.readFileSync(SYSTEM_MESSAGE_FILE, 'utf-8');
    conversationHistory.push({ role: 'system', content: systemMessageContent });;
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

    // Pass the global tools array to promptOllama
    const response = await promptOllama(conversationHistory, model, url, port, tools);

    handleAssistantResponse(response);
    startConversation(); 
  });
}

function handleAssistantResponse(response) {
  const { thoughts, speech } = splitThoughtsAndSpeech(response);
  conversationHistory.push({ role: 'assistant', content: response });
  console.log('\x1b[33m%s\x1b[0m \x1b[33m%s\x1b[0m', 'ALFRED (Speech):', speech);
}

function splitThoughtsAndSpeech(input) {
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
authorize()
initializeConversation();
console.clear();
startConversation();