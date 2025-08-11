const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🌟 Setting up ConnectGlobal Open Source Stack...\n');

const services = [
  { name: 'PostgreSQL', port: 5432, url: 'postgresql://postgres:password@localhost:5432/connectglobal_dev' },
  { name: 'Redis', port: 6379, url: 'redis://localhost:6379' },
  { name: 'MinIO', port: 9000, url: 'http://localhost:9001' },
  { name: 'PostgREST API', port: 8000, url: 'http://localhost:8000' },
  { name: 'Supabase Studio', port: 3001, url: 'http://localhost:3001' },
  { name: 'Grafana', port: 3002, url: 'http://localhost:3002' },
  { name: 'Prometheus', port: 9090, url: 'http://localhost:9090' },
  { name: 'Jitsi Meet', port: 8080, url: 'http://localhost:8080' },
  { name: 'MeiliSearch', port: 7700, url: 'http://localhost:7700' },
  { name: 'Plausible Analytics', port: 8001, url: 'http://localhost:8001' }
];

// Check if Docker is available
function checkDocker() {
  return new Promise((resolve, reject) => {
    exec('docker --version', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Docker not found. Please install Docker Desktop first.');
        console.log('Download from: https://www.docker.com/products/docker-desktop');
        reject(error);
      } else {
        console.log('✅ Docker found:', stdout.trim());
        resolve(true);
      }
    });
  });
}

// Check if Docker Compose is available
function checkDockerCompose() {
  return new Promise((resolve, reject) => {
    exec('docker-compose --version', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Docker Compose not found.');
        reject(error);
      } else {
        console.log('✅ Docker Compose found:', stdout.trim());
        resolve(true);
      }
    });
  });
}

// Start the open source stack
function startStack() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting open source services...');
    
    const dockerProcess = exec('docker-compose up -d', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Failed to start services:', error.message);
        reject(error);
      } else {
        console.log('✅ All services started successfully!');
        resolve(true);
      }
    });

    // Show real-time output
    dockerProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    dockerProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

// Wait for services to be ready
function waitForServices() {
  return new Promise((resolve) => {
    console.log('⏳ Waiting for services to initialize...');
    setTimeout(() => {
      console.log('✅ Services should be ready now!');
      resolve(true);
    }, 30000); // Wait 30 seconds
  });
}

// Display service URLs
function displayServiceInfo() {
  console.log('\n🎉 ConnectGlobal Open Source Stack is Ready!\n');
  console.log('📋 Available Services:');
  console.log('=' .repeat(60));
  
  services.forEach(service => {
    console.log(`${service.name.padEnd(20)} | ${service.url}`);
  });
  
  console.log('=' .repeat(60));
  console.log('\n🔑 Default Credentials:');
  console.log('PostgreSQL    | User: postgres, Password: password');
  console.log('MinIO         | User: minioadmin, Password: minioadmin123');
  console.log('Grafana       | User: admin, Password: admin123');
  console.log('Supabase      | Access via Studio at localhost:3001');
  
  console.log('\n🛠️  Development URLs:');
  console.log('Backend API   | http://localhost:3000');
  console.log('Database API  | http://localhost:8000');
  console.log('Admin Panel   | http://localhost:3001');
  console.log('Analytics     | http://localhost:3002');
  console.log('Video Calls   | http://localhost:8080');
  
  console.log('\n📚 Quick Commands:');
  console.log('Stop services | docker-compose down');
  console.log('View logs     | docker-compose logs -f');
  console.log('Restart       | docker-compose restart');
  console.log('Update images | docker-compose pull');
}

// Create MinIO buckets
function setupMinIO() {
  return new Promise((resolve) => {
    console.log('🪣 Setting up MinIO buckets...');
    
    // Commands to create buckets
    const commands = [
      'docker-compose exec -T minio mc alias set local http://localhost:9000 minioadmin minioadmin123',
      'docker-compose exec -T minio mc mb local/user-photos',
      'docker-compose exec -T minio mc mb local/user-videos',
      'docker-compose exec -T minio mc mb local/app-assets',
      'docker-compose exec -T minio mc policy set public local/user-photos',
      'docker-compose exec -T minio mc policy set public local/user-videos'
    ];
    
    let completed = 0;
    commands.forEach(command => {
      exec(command, (error) => {
        completed++;
        if (completed === commands.length) {
          console.log('✅ MinIO buckets configured');
          resolve(true);
        }
      });
    });
  });
}

// Main setup function
async function setupOpenSourceStack() {
  try {
    console.log('🔍 Checking prerequisites...');
    await checkDocker();
    await checkDockerCompose();
    
    console.log('\n🚀 Starting services...');
    await startStack();
    
    console.log('\n⏳ Initializing services...');
    await waitForServices();
    
    console.log('\n🔧 Configuring services...');
    await setupMinIO();
    
    displayServiceInfo();
    
    console.log('\n✨ Next Steps:');
    console.log('1. Update .env file with Supabase credentials from localhost:3001');
    console.log('2. Run database migrations in Supabase Studio');
    console.log('3. Start your ConnectGlobal backend: npm run backend:dev');
    console.log('4. Start React Native app: npm start');
    
    console.log('\n🎯 You now have a complete open source dating app stack!');
    
  } catch (error) {
    console.log('\n❌ Setup failed. Manual steps:');
    console.log('1. Install Docker Desktop: https://www.docker.com/products/docker-desktop');
    console.log('2. Run: docker-compose up -d');
    console.log('3. Wait for services to start');
    console.log('4. Access Supabase Studio at http://localhost:3001');
  }
}

// Run setup
setupOpenSourceStack();