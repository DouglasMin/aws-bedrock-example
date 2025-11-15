/**
 * Debug script to see actual result structure
 */

const cheerio = require('cheerio');

async function debugHTML() {
  const query = 'JavaScript';
  
  console.log('🔍 Fetching DuckDuckGo HTML for:', query);
  
  const response = await fetch(
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
  );
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n📊 Analysis:');
  console.log('  - Total <a> tags:', $('a').length);
  console.log('  - <a> with rel="nofollow":', $('a[rel="nofollow"]').length);
  console.log('  - <a> with class="result-link":', $('a.result-link').length);
  console.log('  - <td> with class="result-snippet":', $('td.result-snippet').length);
  console.log('  - Total <tr> tags:', $('tr').length);
  
  console.log('\n📝 First 3 links with rel="nofollow":');
  $('a[rel="nofollow"]').slice(0, 3).each((i, el) => {
    const $el = $(el);
    console.log(`\n  Link ${i + 1}:`);
    console.log('    href:', $el.attr('href'));
    console.log('    text:', $el.text().trim());
    console.log('    class:', $el.attr('class'));
  });
  
  console.log('\n📝 First result table row structure:');
  const $firstResultRow = $('tr').eq(5); // Skip header rows
  console.log($firstResultRow.html());
}

debugHTML();
