import { checkMongoConfig, sanitizeMongoError } from '../lib/mongodb.ts';

console.log('Testing MongoDB configuration validation & error sanitization...\n');

let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

// 1. Missing / Empty MONGODB_URI
process.env.MONGODB_URI = '';
const emptyCheck = checkMongoConfig();
assert(emptyCheck.configured === false, 'Detects empty MONGODB_URI as unconfigured');
assert(emptyCheck.message.includes('MONGODB_URI is not defined'), 'Provides clear guidance when MONGODB_URI is not defined');

// 2. Placeholder MONGODB_URI
process.env.MONGODB_URI = '<MY_MONGODB_ATLAS_CONNECTION_STRING>';
const placeholderCheck = checkMongoConfig();
assert(placeholderCheck.configured === false, 'Detects <MY_MONGODB_ATLAS_CONNECTION_STRING> as unconfigured placeholder');
assert(placeholderCheck.message.includes("placeholder '<MY_MONGODB_ATLAS_CONNECTION_STRING>'"), 'Identifies placeholder in error message');

// 3. Angle bracket placeholder e.g. <connection_string>
process.env.MONGODB_URI = '<your-atlas-uri-here>';
const bracketCheck = checkMongoConfig();
assert(bracketCheck.configured === false, 'Detects angle-bracket placeholder');

// 4. Invalid scheme
process.env.MONGODB_URI = 'postgres://user:pass@localhost:5432/db';
const schemeCheck = checkMongoConfig();
assert(schemeCheck.configured === false, 'Detects invalid non-mongo scheme');
assert(schemeCheck.message.includes('must start with "mongodb://" or "mongodb+srv://"'), 'Mentions valid mongodb:// or mongodb+srv:// schemes');

// 5. Valid MongoDB Atlas scheme
process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster0.abcde.mongodb.net/fromex?retryWrites=true&w=majority';
const validCheck = checkMongoConfig();
assert(validCheck.configured === true, 'Accepts valid mongodb+srv URI');

// 6. Error sanitization (Redacting credentials)
const rawError = new Error('MongoServerSelectionError: connection to mongodb+srv://superAdmin:SecretPassword123@cluster0.2gpqlsb.mongodb.net/fromex closed');
const sanitized = sanitizeMongoError(rawError);
assert(!sanitized.includes('SecretPassword123'), 'Sanitized error NEVER contains SecretPassword123');
assert(!sanitized.includes('superAdmin'), 'Sanitized error NEVER contains username');
assert(sanitized.includes('[REDACTED_CREDENTIALS]'), 'Replaces credentials with [REDACTED_CREDENTIALS]');

console.log('\nResult: ' + (failed === 0 ? 'ALL CONFIG & SANITIZATION TESTS PASSED!' : `${failed} TESTS FAILED`));
if (failed > 0) process.exit(1);
