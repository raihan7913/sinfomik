#!/usr/bin/env node
// Quick script to convert ? placeholders to $1, $2, etc for PostgreSQL
// Usage: node convert-placeholders.js

const fs = require('fs');
const path = require('path');

const controllerDir = path.join(__dirname, 'src/controllers');
const files = fs.readdirSync(controllerDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(controllerDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find all SQL strings and convert ? to numbered placeholders
    let modified = false;
    
    // Replace in query definitions
    content = content.replace(/(`[^`]*\?[^`]*`|"[^"]*\?[^"]*"|'[^']*\?[^']*')/g, (match) => {
        let counter = 0;
        const result = match.replace(/\?/g, () => {
            counter++;
            return `$${counter}`;
        });
        if (counter > 0) {
            modified = true;
        }
        return result;
    });
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Converted ${file} - ${content.match(/\$\d+/g)?.length || 0} placeholders updated`);
    } else {
        console.log(`⏭️  No changes needed in ${file}`);
    }
});

console.log('\n✅ Done! All files converted.');
