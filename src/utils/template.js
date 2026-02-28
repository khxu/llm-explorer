export function interpolate(template, data) {
  if (!template) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return key in data ? data[key] : match;
  });
}

export function extractPlaceholders(template) {
  if (!template) return [];
  const matches = [];
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}
