const { aggregateNews } = require('../server');
(async () => {
  const data = await aggregateNews();
  const sources = [...new Set(data.items.map(i=>i.source))];
  console.log(JSON.stringify({ generatedAt: data.generatedAt, count: data.items.length, sources, sourceStatus: data.sourceStatus, errors: data.errors, sample: data.items.slice(0,2) }, null, 2));
  if (data.items.length < 100 || sources.length < 20 || !sources.includes('Drudge Report')) process.exitCode = 1;
})();
