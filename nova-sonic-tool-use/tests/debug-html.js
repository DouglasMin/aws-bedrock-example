/**
 * Debug script to see DuckDuckGo HTML structure
 */

async function debugHTML() {
  const query = 'JavaScript programming language';
  
  console.log('🔍 Fetching DuckDuckGo HTML for:', query);
  console.log('─'.repeat(50));
  
  const response = await fetch(
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
  );
  
  const html = await response.text();
  
  console.log('\n📄 HTML Length:', html.length);
  console.log('\n📄 First 2000 characters of HTML:\n');
  console.log(html.substring(0, 2000));
  console.log('\n...\n');
  
  // Check for specific patterns
  console.log('🔎 Checking for patterns:');
  console.log('  - Contains "result-link":', html.includes('result-link'));
  console.log('  - Contains "result-snippet":', html.includes('result-snippet'));
  console.log('  - Contains <a rel="nofollow":', html.includes('<a rel="nofollow"'));
  console.log('  - Contains <table:', html.includes('<table'));
}

debugHTML();
