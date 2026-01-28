const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const CONFIG = {
    piUser: 'csmith',
    piHost: '192.168.1.63', // Update this
    piTargetDir: '/opt/makerspace-kiln',
    packageName: 'kiln-release.tar.gz'
};

const DIRS = {
    root: __dirname,
    client: path.join(__dirname, 'client'),
    service: path.join(__dirname, 'service'),
    stage: path.join(__dirname, 'stage') // Temporary staging area
};

// --- Helpers ---
function run(cmd, cwd) {
    console.log(`> ${cmd}`);
    execSync(cmd, { cwd: cwd || DIRS.root, stdio: 'inherit' });
}

try {
    console.log('🔥 STARTING KILN DEPLOYMENT 🔥');

    // 1. Clean Staging
    if (fs.existsSync(DIRS.stage)) fs.rmSync(DIRS.stage, { recursive: true });
    fs.mkdirSync(DIRS.stage);

    // 2. Build Client
    console.log('\n📦 Building Frontend...');
    run('npm install', DIRS.client);
    run('npm run build', DIRS.client);

    // 3. Build Service
    console.log('\n⚙️  Building Service...');
    run('npm install', DIRS.service);
    run('npm run build', DIRS.service); // This runs the simplified vite config

    // 4. Assemble Package in Staging
    console.log('\n🧩 Assembling Package...');
    
    // Copy Service Build (the code)
    fs.cpSync(path.join(DIRS.service, 'build', 'index.js'), path.join(DIRS.stage, 'index.js'));
    
    // Copy Package.json (deps)
    fs.cpSync(path.join(DIRS.service, 'package.json'), path.join(DIRS.stage, 'package.json'));
    
    // Copy Client Build (static files) to public/
    fs.cpSync(path.join(DIRS.client, 'dist'), path.join(DIRS.stage, 'public'), { recursive: true });

    // Copy System Configs (systemd, etc) from your source set
    // Assuming you kept the structure created in the previous turn
    const sysDist = path.join(DIRS.service, 'dist');
    if (fs.existsSync(sysDist)) {
        fs.cpSync(sysDist, DIRS.stage, { recursive: true });
    }

    // 5. Compress
    console.log('\n🗜️  Compressing...');
    run(`tar -czf ${CONFIG.packageName} -C stage .`);

    // 6. Upload
    console.log(`\n🚀 Uploading to ${CONFIG.piHost}...`);
    run(`scp ${CONFIG.packageName} ${CONFIG.piUser}@${CONFIG.piHost}:~/`);

    console.log(`\n✅ DEPLOYMENT SENT.`);
    console.log(`   Run on Pi:`);
    console.log(`   sudo tar -xzf ${CONFIG.packageName} -C ${CONFIG.piTargetDir}`);
    console.log(`   cd ${CONFIG.piTargetDir} && npm install --omit=dev && sudo systemctl restart kiln-controller`);

} catch (e) {
    console.error('\n❌ FAILED:', e.message);
    process.exit(1);
}