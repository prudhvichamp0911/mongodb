require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { faker } = require('@faker-js/faker');
const { connectDB, getContactsCollection, closeDB } = require('../db');

const CSV_PATH = path.join(__dirname, '..', 'data', 'contacts.csv');

// Map many possible Kaggle CSV header spellings -> our canonical fields
const HEADER_ALIASES = {
  firstName: ['first name', 'first_name', 'firstname', 'first', 'given name', 'contact first name', 'primary contact first name'],
  lastName: ['last name', 'last_name', 'lastname', 'last', 'surname', 'family name', 'contact last name', 'primary contact last name'],
  fullName: ['contact name', 'full name', 'full_name', 'name', 'contact_name', 'person name'],
  email: ['email', 'e-mail', 'email address', 'email_address', 'business email', 'work email', 'email 1', 'email1', 'primary email'],
  phone: ['phone', 'phone number', 'phone_number', 'telephone', 'mobile', 'phone 1', 'phone1', 'direct phone', 'business phone', 'contact number'],
  company: ['company', 'company name', 'company_name', 'organization', 'organisation', 'account name', 'employer', 'business name'],
  title: ['title', 'job title', 'job_title', 'jobtitle', 'position', 'role', 'designation', 'job role', 'decision maker title'],
  industry: ['industry', 'sector', 'sic', 'sic code', 'industry name'],
  country: ['country', 'country name', 'nation', 'location country', 'geo'],
};

function normalizeHeader(h) {
  return String(h).trim().toLowerCase().replace(/[\s\-_()\/]+/g, ' ').trim();
}

function buildColumnMap(headers) {
  const normalized = headers.map((h) => normalizeHeader(h));
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalized.findIndex((h) => h === alias || h.includes(alias));
      if (idx !== -1) {
        map[field] = headers[idx];
        break;
      }
    }
  }
  return map;
}

function clean(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v === '' || v.toLowerCase() === 'n/a' || v === '-' ? null : v;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    console.error('Download the dataset from Kaggle (leadsblue/b2b-contact-database-sample-dataset),');
    console.error('unzip it, and save the CSV as data/contacts.csv, then re-run: npm run import');
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (records.length === 0) {
    console.error('CSV parsed but contained 0 data rows.');
    process.exit(1);
  }

  const headers = Object.keys(records[0]);
  console.log('CSV headers found:', headers.join(' | '));

  const col = buildColumnMap(headers);
  console.log('Column mapping:', JSON.stringify(col, null, 2));

  if (!col.email && !col.fullName && !col.firstName) {
    console.error('Could not identify name/email columns in this CSV. Aborting.');
    process.exit(1);
  }

  const docs = records.map((row) => {
    let firstName = col.firstName ? clean(row[col.firstName]) : null;
    let lastName = col.lastName ? clean(row[col.lastName]) : null;

    // If only a combined name column exists, split it
    if ((!firstName || !lastName) && col.fullName) {
      const full = clean(row[col.fullName]);
      if (full) {
        const parts = full.split(/\s+/);
        if (!firstName) firstName = parts[0] || null;
        if (!lastName) lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
      }
    }

    return {
      firstName: firstName || null,
      lastName: lastName || null,
      email: col.email ? clean(row[col.email]) : null,
      phone: col.phone ? clean(row[col.phone]) : null,
      company: col.company ? clean(row[col.company]) : null,
      // Fill missing titles with a realistic fake one so queries on title always work
      title: (col.title ? clean(row[col.title]) : null) || faker.person.jobTitle(),
      industry: col.industry ? clean(row[col.industry]) : null,
      country: col.country ? clean(row[col.country]) : null,
    };
  });

  console.log(`Prepared ${docs.length} documents. Sample:`);
  console.log(JSON.stringify(docs[0], null, 2));

  if (process.argv.includes('--dry-run')) {
    console.log('Dry run — skipping database import. Mapping looks good? Then run: npm run import');
    return;
  }

  await connectDB();
  const contacts = getContactsCollection();

  await contacts.deleteMany({});
  const result = await contacts.insertMany(docs, { ordered: false });
  console.log(`Inserted ${result.insertedCount} documents into contactsdb.contacts`);

  await contacts.createIndex({ email: 1 });
  await contacts.createIndex({ lastName: 1 });
  await contacts.createIndex({ company: 1 });
  await contacts.createIndex({ title: 1 });
  await contacts.createIndex({ industry: 1 });
  await contacts.createIndex({ country: 1 });
  console.log('Indexes created: email, lastName, company, title, industry, country');

  await closeDB();
  console.log('Import complete.');
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
