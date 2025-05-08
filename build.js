const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC_DIR = 'src';
const OUT_DIR = 'docs';
const assetMap = {};
const buildVersion = Date.now().toString(); // Generate build version up front
const isGitHubPages = process.env.GITHUB_PAGES === 'true'; // You can set this in your build process
const BASE_PATH = isGitHubPages ? '/GLTP' : '';

console.log('Starting build process...');

// First pass: Process all files and build assetMap
const processDir = (srcPath, outPath) => {
  console.log(`Processing directory: ${srcPath} -> ${outPath}`);
  fs.mkdirSync(outPath, { recursive: true });

  const entries = fs.readdirSync(srcPath, { withFileTypes: true });

  for (const entry of entries) {
    const srcFile = path.join(srcPath, entry.name);
    const outFile = path.join(outPath, entry.name);

    if (entry.isDirectory()) {
      processDir(srcFile, outFile);
    } else {
      console.log(`Found file: ${srcFile}`);
      const ext = path.extname(entry.name);
      if (ext === '.js' || ext === '.css') {
        console.log(`Processing ${ext} file: ${srcFile}`);
        const content = fs.readFileSync(srcFile, 'utf-8');
        const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
        const base = path.basename(entry.name, ext);
        const hashedName = `${base}.${hash}${ext}`;
        const outHashedPath = path.join(outPath, hashedName);

        console.log(`Creating hashed file: ${outHashedPath}`);

        // For now, just copy the content
        fs.writeFileSync(outHashedPath, content);

        const relPath = path.relative(SRC_DIR, srcFile).replace(/\\/g, '/');
        const hashedRelPath = path.relative(SRC_DIR, path.join(srcPath, hashedName)).replace(/\\/g, '/');
        assetMap[relPath] = hashedRelPath;
        console.log(`Added to assetMap: ${relPath} -> ${hashedRelPath}`);
      } else {
        // Copy other files directly
        console.log(`Copying file: ${srcFile} -> ${outFile}`);
        fs.copyFileSync(srcFile, outFile);
      }
    }
  }
};

// Function to replace references in a file
const replaceRefsInFile = (filePath, content) => {
  console.log(`Processing file: ${filePath}`);
  let updatedContent = content;

  // Inject inline build version if it's an HTML file
  if (filePath.endsWith('.html')) {
    updatedContent = updatedContent.replace(/{{BUILD_VERSION}}/g, buildVersion);
    
    // Handle CSS links in HTML files - match both with and without leading slash
    updatedContent = updatedContent.replace(
      /href=['"](?:\/)?(css)\/([^'"]+)['"]/g,
      `href="${BASE_PATH}/$1/$2"`
    );
  }

  for (const [orig, hashed] of Object.entries(assetMap)) {
    const origFileName = path.basename(orig);
    const hashedFileName = path.basename(hashed);

    console.log(`Replacing in ${filePath}: ${orig} -> ${hashed}`);
    
    // Replace full paths
    updatedContent = updatedContent.replace(
      new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      hashed
    );
    
    // Replace just filenames
    updatedContent = updatedContent.replace(
      new RegExp(origFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      hashedFileName
    );

    // For JavaScript files, also handle import statements and fetch paths
    if (filePath.endsWith('.js')) {
      // Handle import statements
      updatedContent = updatedContent.replace(
        new RegExp(`from ['"]${orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
        `from '${hashed}'`
      );
      updatedContent = updatedContent.replace(
        new RegExp(`from ['"]${origFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
        `from '${hashedFileName}'`
      );

      // Handle fetch paths for HTML files - match both with and without leading slash
      updatedContent = updatedContent.replace(
        /fetch\(['"](?:\/)?(html|css)\/([^'"]+)['"]\)/g,
        `fetch('${BASE_PATH}/$1/$2')`
      );
    }
  }

  return updatedContent;
};

// Walk through directory and process files
const walkAndProcessFiles = (dir) => {
  console.log(`Walking directory: ${dir}`);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndProcessFiles(fullPath);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const updatedContent = replaceRefsInFile(fullPath, content);
      if (updatedContent !== content) {
        console.log(`Writing updated content to ${fullPath}`);
        fs.writeFileSync(fullPath, updatedContent);
      }
    }
  }
};

// Clear output dir
console.log(`Clearing output directory: ${OUT_DIR}`);
fs.rmSync(OUT_DIR, { recursive: true, force: true });

// First pass: Process all files
console.log('Starting first pass...');
processDir(SRC_DIR, OUT_DIR);

// Second pass: Update all files with correct references
console.log('Starting second pass...');
walkAndProcessFiles(OUT_DIR);

console.log('Asset Map:', assetMap);
console.log('✅ Build complete. Files cache-busted and copied to docs/');
