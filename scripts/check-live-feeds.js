const { aggregateNews } = require('../server');
(async () => {
  const data = await aggregateNews();
  console.log(JSON.stringify({ generatedAt: data.generatedAt, count: data.items.length, sources: [...new Set(data.items.map(i=>i.source))], errors: data.errors, sample: data.items.slice(0,2) }, null, 2));
  if (!data.items.length || data.errors.length) process.exitCode = 1;
})();
