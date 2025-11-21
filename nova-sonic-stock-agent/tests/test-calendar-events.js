/**
 * Google Calendar Events Test
 * Run with: node tests/test-calendar-events.js
 * 
 * Prerequisites: 
 * - credentials.json in project root
 * - token.json created (run test-calendar-auth.js first)
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

/**
 * Load and authorize
 */
async function authorize() {
  try {
    const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    const token = JSON.parse(await fs.readFile(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    
    return oAuth2Client;
  } catch (error) {
    console.error('❌ Authorization failed. Run test-calendar-auth.js first.');
    throw error;
  }
}

/**
 * Get events for this week
 */
async function getThisWeekEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  // Calculate this week's date range
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  
  console.log(`📅 Fetching events from ${startOfWeek.toLocaleDateString()} to ${endOfWeek.toLocaleDateString()}\n`);
  
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfWeek.toISOString(),
    timeMax: endOfWeek.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
}

/**
 * Get today's events
 */
async function getTodayEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  console.log(`📅 Fetching today's events (${today.toLocaleDateString()})\n`);
  
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: today.toISOString(),
    timeMax: tomorrow.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
}

/**
 * Get upcoming events (next 10)
 */
async function getUpcomingEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  console.log('📅 Fetching next 10 upcoming events\n');
  
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
}

/**
 * Format events for display
 */
function formatEvents(events) {
  if (events.length === 0) {
    return 'No events found.';
  }

  let output = '';
  events.forEach((event, i) => {
    const start = event.start.dateTime || event.start.date;
    const startDate = new Date(start);
    const timeStr = event.start.dateTime 
      ? startDate.toLocaleString('ko-KR', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : startDate.toLocaleDateString('ko-KR');
    
    output += `${i + 1}. [${timeStr}] ${event.summary}\n`;
    if (event.location) {
      output += `   📍 ${event.location}\n`;
    }
  });
  
  return output;
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('🔐 Google Calendar Events Test\n');
    
    const auth = await authorize();
    console.log('✅ Authorized\n');
    
    // Test 1: Today's events
    console.log('=== TEST 1: 오늘 일정 ===');
    const todayEvents = await getTodayEvents(auth);
    console.log(formatEvents(todayEvents));
    console.log('');
    
    // Test 2: This week's events
    console.log('=== TEST 2: 이번 주 일정 ===');
    const weekEvents = await getThisWeekEvents(auth);
    console.log(formatEvents(weekEvents));
    console.log('');
    
    // Test 3: Upcoming events
    console.log('=== TEST 3: 다가오는 일정 (10개) ===');
    const upcomingEvents = await getUpcomingEvents(auth);
    console.log(formatEvents(upcomingEvents));
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
