// One-off syntax check: compiles every .ejs file to catch template syntax errors early.
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const viewsDir = path.join(__dirname, '..', 'src', 'views');
let errors = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ejs')) {
      try {
        ejs.compile(fs.readFileSync(full, 'utf8'), { filename: full });
        console.log('OK  ', path.relative(viewsDir, full));
      } catch (e) {
        errors++;
        console.log('FAIL', path.relative(viewsDir, full), '-', e.message);
      }
    }
  }
}

walk(viewsDir);
console.log(errors ? `\n${errors} file(s) failed to compile.` : '\nAll EJS files compiled successfully.');
process.exit(errors ? 1 : 0);
