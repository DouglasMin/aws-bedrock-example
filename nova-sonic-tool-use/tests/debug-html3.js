/**
 * Debug script to see complete result structure
 */

const cheerio = require('cheerio');

async function debugHTML() {
  const query = 'JavaScript';
  
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
  
  console.log('📝 First 3 result-link elements and their context:\n');
  
  $('a.result-link').slice(0, 3).each((i, el) => {
    const $link = $(el);
    console.log(`Result ${i + 1}:`);
    console.log('  Title:', $link.text().trim());
    console.log('  URL:', $link.attr('href'));
    
    // Get parent structure
    const $td = $link.closest('td');
    const $tr = $link.closest('tr');
    
    console.log('  Parent <td> class:', $td.attr('class'));
    console.log('  Parent <tr> index:', $('tr').index($tr));
    
    // Try to find snippet in various ways
    const $nextTr = $tr.next('tr');
    const snippet1 = $nextTr.find('td.result-snippet').text().trim();
    const snippet2 = $tr.find('td.result-snippet').text().trim();
    
    console.log('  Snippet (next tr):', snippet1.substring(0, 100));
    console.log('  Snippet (same tr):', snippet2.substring(0, 100));
    console.log('');
  });
}

debugHTML();
