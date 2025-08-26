const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: ["http://localhost:5173",
      "https://deploy-the-cat.vercel.app"
  ],
  methods: ["GET","POST"]
}
      // "https://deploy-the-p43xk61nk-rogerbaps-projects.vercel.app"], methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '🐱 Deploy the Cat server running!' });
});

io.on('connection', (socket) => {
  console.log('🎮 Player connected:', socket.id);
  
  // Add ping/pong for testing
  socket.on('ping', (data) => {
    console.log('📡 Received ping from:', socket.id, data);
    socket.emit('pong', { 
      message: 'pong received!', 
      timestamp: Date.now(),
      originalData: data 
    });
  });
  
  socket.on('deploymentStart', async (data) => {
    console.log('🚀 Starting deployment for:', socket.id, 'Force failure:', data.forceFailure);
    console.log('📊 Deployment data:', JSON.stringify(data, null, 2));
    
    try {
      // Send immediate acknowledgment
      socket.emit('deploymentLog', { 
        message: '🎮 Deployment request received! Starting pipeline...', 
        level: 'info',
        timestamp: new Date().toISOString()
      });
      
      await simulateDeployment(socket, data.forceFailure || false);
    } catch (error) {
      console.error('❌ Deployment failed for:', socket.id, error);
      
      // Send error completion event
      socket.emit('deploymentComplete', {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Log all events for debugging
  socket.onAny((eventName, ...args) => {
    console.log(`🔍 Event from ${socket.id}: ${eventName}`, args);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('👋 Player disconnected:', socket.id, 'Reason:', reason);
  });
});

async function simulateDeployment(socket, shouldFail = false) {
  console.log(`🎯 Simulating deployment - shouldFail: ${shouldFail}`);
  
  const successSteps = [
    { message: '🚀 Starting deployment pipeline...', level: 'info' },
    { message: '📦 Installing dependencies...', level: 'info' },
    { message: '✅ Dependencies installed successfully', level: 'success' },
    { message: '🔨 Building application...', level: 'info' },
    { message: '✅ Build completed successfully', level: 'success' },
    { message: '🧪 Running unit tests...', level: 'info' },
    { message: '✅ All tests passed (247/247)', level: 'success' },
    { message: '🚀 Deploying to production...', level: 'info' },
    { message: '✅ Deployment successful!', level: 'success' }
  ];

  const failureScenarios = [
    {
      failAt: 3,
      steps: [
        { message: '🚀 Starting deployment pipeline...', level: 'info' },
        { message: '📦 Installing dependencies...', level: 'info' },
        { message: '❌ Dependency conflict detected!', level: 'error' },
        { message: '💥 Build failed - incompatible package versions', level: 'error' }
      ]
    },
    {
      failAt: 6,
      steps: [
        { message: '🚀 Starting deployment pipeline...', level: 'info' },
        { message: '📦 Installing dependencies...', level: 'info' },
        { message: '✅ Dependencies installed successfully', level: 'success' },
        { message: '🔨 Building application...', level: 'info' },
        { message: '✅ Build completed successfully', level: 'success' },
        { message: '🧪 Running unit tests...', level: 'info' },
        { message: '❌ Tests failed: 12 failures, 235 passed', level: 'error' },
        { message: '💥 Deployment aborted due to test failures', level: 'error' }
      ]
    },
    {
      failAt: 8,
      steps: [
        { message: '🚀 Starting deployment pipeline...', level: 'info' },
        { message: '📦 Installing dependencies...', level: 'info' },
        { message: '✅ Dependencies installed successfully', level: 'success' },
        { message: '🔨 Building application...', level: 'info' },
        { message: '✅ Build completed successfully', level: 'success' },
        { message: '🧪 Running unit tests...', level: 'info' },
        { message: '✅ All tests passed (247/247)', level: 'success' },
        { message: '🚀 Deploying to production...', level: 'info' },
        { message: '❌ Deployment failed - server timeout', level: 'error' },
        { message: '🔄 Rolling back to previous version...', level: 'warning' },
        { message: '✅ Rollback completed', level: 'info' }
      ]
    }
  ];

  let stepsToExecute;
  let willSucceed = true;

  if (shouldFail) {
    const scenario = failureScenarios[Math.floor(Math.random() * failureScenarios.length)];
    stepsToExecute = scenario.steps;
    willSucceed = false;
    console.log(`🎭 Selected failure scenario with ${scenario.steps.length} steps`);
  } else {
    stepsToExecute = successSteps;
    console.log(`✅ Selected success scenario with ${successSteps.length} steps`);
  }

  for (let i = 0; i < stepsToExecute.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 800)); // Reduced delay for faster testing
    
    const log = {
      message: stepsToExecute[i].message,
      timestamp: new Date().toISOString(),
      level: stepsToExecute[i].level,
      step: i + 1,
      totalSteps: stepsToExecute.length
    };
    
    console.log(`📤 Sending log ${i + 1}/${stepsToExecute.length}:`, log.message);
    socket.emit('deploymentLog', log);
  }

  // Add a small delay before sending completion
  await new Promise(resolve => setTimeout(resolve, 500));

  // Send completion event
  const completionEvent = { 
    success: willSucceed, 
    timestamp: new Date().toISOString(),
    totalSteps: stepsToExecute.length,
    duration: stepsToExecute.length * 800 + 500
  };
  
  console.log('📤 Sending deployment completion:', completionEvent);
  socket.emit('deploymentComplete', completionEvent);
  
  console.log(`🏁 Deployment simulation completed for ${socket.id} - Success: ${willSucceed}`);
}

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Socket.IO ready for connections from http://localhost:5173`);
});

// Add graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
  });
});

// Log server stats every 30 seconds
setInterval(() => {
  const connectedSockets = io.engine.clientsCount;
  console.log(`📊 Server status - Connected clients: ${connectedSockets}`);
}, 30000);