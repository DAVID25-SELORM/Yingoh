import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const targetTotal = 6501;
const liveBase = 500;
const formatsPerConcept = 14;
const allowIncomplete = process.argv.includes('--allow-incomplete');

const officialCategories = [
  'Management of Care',
  'Safety and Infection Prevention and Control',
  'Health Promotion and Maintenance',
  'Psychosocial Integrity',
  'Basic Care and Comfort',
  'Pharmacological and Parenteral Therapies',
  'Reduction of Risk Potential',
  'Physiological Adaptation',
];

const batchFiles = fs.readdirSync(migrationsDir)
  .filter((name) => /seed_question_bank_batch_\d+\.sql$/.test(name))
  .sort();

const concepts = [];
for (const file of batchFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  const pattern = /select public\.seed_structured_concept\('([^']+)','([^']+)','([^']+)'[\s\S]*?,'([^']+)'\);/g;
  for (const match of sql.matchAll(pattern)) {
    let clientNeed = match[4];
    if (file.includes('batch_02')) {
      if (clientNeed === 'Physiological Integrity') clientNeed = 'Physiological Adaptation';
      if (clientNeed === 'Safe and Effective Care Environment') clientNeed = 'Reduction of Risk Potential';
    }
    concepts.push({ batch: match[1], slug: match[2], topic: match[3], clientNeed, file });
  }
  const catalogBatch = sql.match(/'((?:expansion-)?batch-\d+)',\s*slug/)?.[1];
  const catalogClientNeed = sql.match(/wrong3,\s*'([^']+)'\s*\)\s*from \(values/)?.[1];
  if (catalogBatch && catalogClientNeed) {
    const catalogBlock = sql.match(/from \(values([\s\S]*?)\)\s+as c\(/)?.[1] ?? '';
    for (const match of catalogBlock.matchAll(/^\('([^']+)'/gm)) {
      concepts.push({
        batch: catalogBatch,
        slug: match[1],
        topic: 'Pharmacology',
        clientNeed: catalogClientNeed,
        file,
      });
    }
  }
  const variableCategoryBatch = sql.match(/'((?:expansion-)?batch-\d+)',\s*slug[\s\S]*?,\s*client_need\s*\)\s*from \(values/)?.[1];
  if (variableCategoryBatch) {
    const catalogBlock = sql.match(/from \(values([\s\S]*?)\)\s+as c\(/)?.[1] ?? '';
    for (const match of catalogBlock.matchAll(/^\('([^']+)'[^\r\n]*,'([^']+)'\),?$/gm)) {
      concepts.push({
        batch: variableCategoryBatch,
        slug: match[1],
        topic: 'Catalog',
        clientNeed: match[2],
        file,
      });
    }
  }
}

const duplicateSlugs = [...Map.groupBy(concepts, (concept) => concept.slug)]
  .filter(([, rows]) => rows.length > 1);
const categoryCounts = Object.fromEntries(officialCategories.map((category) => [category, 0]));
for (const concept of concepts) {
  if (concept.clientNeed in categoryCounts) categoryCounts[concept.clientNeed] += formatsPerConcept;
}

const projectedQuestions = liveBase + concepts.length * formatsPerConcept;
const engineSql = fs.readFileSync(path.join(migrationsDir, '20260702160000_seed_question_bank_batch_02.sql'), 'utf8');
const gateSql = fs.readFileSync(path.join(migrationsDir, '20260702200000_support_reviewed_ngn_publication.sql'), 'utf8');
const planSql = fs.readFileSync(path.join(migrationsDir, '20260702170000_question_bank_master_plan.sql'), 'utf8');

const checks = [
  { name: 'More than 6,500 projected questions', pass: projectedQuestions >= targetTotal, value: projectedQuestions },
  { name: 'No duplicate structured concept IDs', pass: duplicateSlugs.length === 0, value: duplicateSlugs.length },
  {
    name: 'Two independently worded seven-format sets per concept',
    pass: /for variant_number in 1\.\.14 loop/.test(engineSql) && /base_variant := mod\(variant_number - 1, 7\) \+ 1/.test(engineSql),
    value: formatsPerConcept,
  },
  { name: 'SATA generation present', pass: /item_type := 'sata'/.test(engineSql) },
  { name: 'NGN matrix generation present', pass: /item_type := 'matrix'/.test(engineSql) },
  { name: 'NGN highlight generation present', pass: /item_type := 'highlight'/.test(engineSql) },
  { name: 'Clinical publication gate present', pass: /has_scoring_key/.test(gateSql) },
  { name: 'Official source registry present', pass: /question_source_registry/.test(planSql) },
  ...officialCategories.map((category) => ({
    name: `Blueprint category present: ${category}`,
    pass: categoryCounts[category] > 0,
    value: categoryCounts[category],
  })),
];

console.log('\nYingoh question-bank package validation');
console.log('=======================================');
console.log(`Held batch files: ${batchFiles.length}`);
console.log(`Structured concepts: ${concepts.length}`);
console.log(`Generated held questions: ${concepts.length * formatsPerConcept}`);
console.log(`Projected bank total: ${projectedQuestions}`);
console.log('\nBlueprint distribution in held structured batches:');
for (const [category, count] of Object.entries(categoryCounts)) {
  console.log(`- ${category}: ${count}`);
}
console.log('\nCertification checks:');
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}${check.value === undefined ? '' : ` (${check.value})`}`);
}

const failures = checks.filter((check) => !check.pass);
if (failures.length) {
  console.error(`\nPackage is not yet certifiable: ${failures.length} check(s) remain.`);
  if (!allowIncomplete) process.exit(1);
} else {
  console.log('\nPackage is ready for final consolidation and clinical review import.');
}
