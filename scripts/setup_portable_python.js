// setup_portable_python.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function setup() {
  const targetDir = path.join(process.cwd(), 'python_portable');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }

  const zipUrl = 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip';
  const zipPath = path.join(process.cwd(), 'python_portable.zip');

  console.log('Downloading portable Python 3.11.9 zip...');
  try {
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(zipPath, buffer);
    console.log('Download complete.');
  } catch (err) {
    console.error('Failed to download python zip:', err.message);
    return;
  }

  console.log('Extracting Python zip...');
  try {
    // Windows 10+ includes tar natively
    execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'inherit' });
    console.log('Extraction complete.');
    fs.unlinkSync(zipPath);
  } catch (err) {
    console.error('Extraction failed:', err.message);
    return;
  }

  // Uncomment "import site" to allow package imports and pip installation
  const pthPath = path.join(targetDir, 'python311._pth');
  if (fs.existsSync(pthPath)) {
    console.log('Enabling pip support in python311._pth...');
    let content = fs.readFileSync(pthPath, 'utf8');
    content = content.replace('#import site', 'import site');
    // Ensure import site is present
    if (!content.includes('import site')) {
      content += '\nimport site\n';
    }
    fs.writeFileSync(pthPath, content, 'utf8');
  }

  console.log('Downloading get-pip.py...');
  const pipScriptUrl = 'https://bootstrap.pypa.io/get-pip.py';
  const pipScriptPath = path.join(targetDir, 'get-pip.py');
  try {
    const res = await fetch(pipScriptUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(pipScriptPath, buffer);
    console.log('get-pip.py download complete.');
  } catch (err) {
    console.error('Failed to download get-pip.py:', err.message);
    return;
  }

  console.log('Installing pip inside portable environment...');
  try {
    execSync(`"${path.join(targetDir, 'python.exe')}" "${pipScriptPath}"`, { stdio: 'inherit' });
    console.log('pip installed successfully!');
    fs.unlinkSync(pipScriptPath);
  } catch (err) {
    console.error('pip installation failed:', err.message);
    return;
  }

  console.log('\n🎉 Portable Python setup completed successfully!');
  console.log(`Executable is located at: ${path.join(targetDir, 'python.exe')}`);
}

setup();
