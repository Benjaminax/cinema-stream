// Test parsing logic for the new filename
function testParsing() {
  const filename = '[1080p]Transformers revenge of fallen  2009  BluRay.mkv';
  console.log('Testing filename:', filename);

  // Simulate the parsing logic
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  console.log('Name without extension:', nameWithoutExt);

  // Remove content inside square brackets or parentheses at the beginning
  const cleanedName = nameWithoutExt.replace(/^\s*[\[\(][^\]\)]*[\]\)]\s*/, '');
  console.log('Cleaned name:', cleanedName);

  // Now try to find year
  const parts = cleanedName.split(/\s+/);
  console.log('Parts:', parts);

  let title = '';
  let year = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/^\d{4}$/.test(part)) {
      const potentialYear = parseInt(part);
      if (potentialYear >= 1900 && potentialYear <= 2100) {
        year = potentialYear;
        title = parts.slice(0, i).join(' ');
        break;
      }
    }
  }

  console.log('Parsed title:', title);
  console.log('Parsed year:', year);

  if (title && year) {
    console.log('Searching TMDB for:', title, 'year:', year);
    const https = require('https');
    const API_KEY = '875bd4ff3b965afae93faa3d789f6d7e';
    const query = title;
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&year=${year}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('TMDB Results:');
          console.log('- Total results:', result.total_results);
          if (result.results && result.results.length > 0) {
            const movie = result.results[0];
            console.log('- Title:', movie.title);
            console.log('- Poster path:', movie.poster_path);
            console.log('- Has poster:', !!movie.poster_path);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      });
    }).on('error', (e) => {
      console.error('Request error:', e);
    });
  }
}

testParsing();