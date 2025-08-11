const { exec } = require('child_process');

console.log('🔄 Restarting ConnectGlobal backend server...');

// Kill any existing Node processes
exec('taskkill /F /IM node.exe', (error) => {
  if (error && !error.message.includes('not found')) {
    console.log('No existing Node processes found');
  } else {
    console.log('✅ Stopped existing server');
  }
  
  // Wait a moment then start the new server
  setTimeout(() => {
    console.log('🚀 Starting server with SQLite database...');
    
    const server = exec('cd backend && npm start', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Server start failed:', error.message);
        return;
      }
    });
    
    server.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    server.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
  }, 2000);
});