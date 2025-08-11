const { exec } = require('child_process');

console.log('🪣 Setting up MinIO storage buckets...\n');

const buckets = [
  { name: 'user-photos', policy: 'public' },
  { name: 'user-videos', policy: 'public' },
  { name: 'app-assets', policy: 'public' },
  { name: 'user-documents', policy: 'private' },
  { name: 'system-backups', policy: 'private' }
];

async function setupMinIOBuckets() {
  try {
    // Wait for MinIO to be ready
    console.log('⏳ Waiting for MinIO to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Set up alias
    console.log('🔗 Setting up MinIO alias...');
    await execCommand('docker-compose exec -T minio mc alias set local http://localhost:9000 minioadmin minioadmin123');

    // Create buckets
    for (const bucket of buckets) {
      console.log(`📦 Creating bucket: ${bucket.name}`);
      await execCommand(`docker-compose exec -T minio mc mb local/${bucket.name}`);
      
      if (bucket.policy === 'public') {
        console.log(`🔓 Setting public policy for: ${bucket.name}`);
        await execCommand(`docker-compose exec -T minio mc policy set public local/${bucket.name}`);
      }
    }

    console.log('\n✅ MinIO buckets configured successfully!');
    console.log('\n📋 Available buckets:');
    buckets.forEach(bucket => {
      console.log(`  • ${bucket.name} (${bucket.policy})`);
    });

    console.log('\n🔗 MinIO Console: http://localhost:9001');
    console.log('   Username: minioadmin');
    console.log('   Password: minioadmin123');

  } catch (error) {
    console.error('\n❌ MinIO setup failed:', error.message);
    console.log('\n📝 Manual setup:');
    console.log('1. Access MinIO Console at http://localhost:9001');
    console.log('2. Login with minioadmin/minioadmin123');
    console.log('3. Create buckets manually from the web interface');
  }
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

setupMinIOBuckets();