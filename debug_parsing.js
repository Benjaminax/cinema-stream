// Debug No Strings Attached parsing
function parseMediaFilename(filename) {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

  // Handle parentheses format first (e.g., "Movie (2011)")
  const parensMatch = nameWithoutExt.match(/^(.+?)\s*\((\d{4})\)/);
  if (parensMatch) {
    const title = parensMatch[1].trim();
    const year = parseInt(parensMatch[2]);
    if (year >= 1900 && year <= 2100) {
      return { title: title.replace(/\./g, ' ').replace(/_/g, ' '), year };
    }
  }

  // Handle dot-separated format (e.g., "Iron.Man.2.2010")
  const dotParts = nameWithoutExt.split('.');
  for (let i = dotParts.length - 1; i >= 0; i--) {
    const part = dotParts[i];
    if (/^\d{4}$/.test(part)) {
      const year = parseInt(part);
      if (year >= 1900 && year <= 2100) {
        const titleParts = dotParts.slice(0, i);
        const title = titleParts.join(' ').replace(/_/g, ' ');
        return { title, year };
      }
    }
  }

  // Handle underscore-separated format (e.g., "The_Mask_of_Zorro_1998")
  const underscoreParts = nameWithoutExt.split('_');
  for (let i = underscoreParts.length - 1; i >= 0; i--) {
    const part = underscoreParts[i];
    if (/^\d{4}$/.test(part)) {
      const year = parseInt(part);
      if (year >= 1900 && year <= 2100) {
        const titleParts = underscoreParts.slice(0, i);
        const title = titleParts.join(' ').replace(/\./g, ' ');
        return { title, year };
      }
    }
  }

  // Fallback: no year found
  return {
    title: nameWithoutExt.replace(/\./g, ' ').replace(/_/g, ' '),
    year: null
  };
}

const testFilename = 'No Strings Attached (2011) 720p Bluray ×264.mp4';
console.log('Testing filename:', testFilename);
const result = parseMediaFilename(testFilename);
console.log('Parsed result:', JSON.stringify(result, null, 2));