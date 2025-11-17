/**
 * Google Calendar OAuth2 Authentication Test
 * Run with: node tests/test-calendar-auth.js
 * 
 * This script will:
 * 1. Read credentials.json
 * 2. Open browser for Google login
 * 3. Save token for future use
 */

const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const { exec } = require('child_process');

// OAuth2 설정
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

/**
 * Load credentials from file
 */
async function loadCredentials() {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH);
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error loading credentials.json');
    console.error('Please download credentials.json from Google Cloud Console');
    console.error('and place it in the nova-sonic-tool-use/ directory');
    throw error;
  }
}

/**
 * Create OAuth2 client
 */
function createOAuth2Client(credentials) {
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

/**
 * Get new token by opening browser
 */
async function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('🔐 Opening browser for authorization...');
    console.log('If browser doesn\'t open, visit this URL:');
    console.log(authUrl);

    // Create local server to receive callback
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/oauth2callback') > -1) {
          const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
          const code = qs.get('code');
          
          res.end('✅ Authentication successful! You can close this window.');
          server.close();

          // Get token
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          
          // Save token
          await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
          console.log('✅ Token saved to', TOKEN_PATH);
          
          resolve(oAuth2Client);
        }
      } catch (error) {
        reject(error);
      }
    }).listen(3000, () => {
      // Open browser (macOS)
      exec(`open "${authUrl}"`, (error) => {
        if (error) {
          console.log('⚠️ Could not open browser automatically');
        }
      });
    });
  });
}

/**
 * Load saved token or get new one
 */
async function authorize() {
  const credentials = await loadCredentials();
  const oAuth2Client = createOAuth2Client(credentials);

  try {
    // Try to load saved token
    const token = await fs.readFile(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    console.log('✅ Using saved token');
    return oAuth2Client;
  } catch (error) {
    // No saved token, get new one
    console.log('📝 No saved token found, requesting new authorization...');
    return getNewToken(oAuth2Client);
  }
}

/**
 * List upcoming events
 */
async function listEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  console.log('\n📅 Fetching upcoming events...\n');
  
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items;
  
  if (!events || events.length === 0) {
    console.log('No upcoming events found.');
    return;
  }

  console.log('Upcoming events:');
  events.forEach((event, i) => {
    const start = event.start.dateTime || event.start.date;
    console.log(`${i + 1}. ${start} - ${event.summary}`);
  });
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🔐 Google Calendar Authentication Test\n');
    
    const auth = await authorize();
    console.log('✅ Authentication successful!\n');
    
    await listEvents(auth);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
