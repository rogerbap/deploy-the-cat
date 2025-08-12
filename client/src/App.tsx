import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

type ComponentType = 'build' | 'test' | 'deploy';

interface ComponentState {
  placed: boolean;
}

interface ComponentStates {
  build: ComponentState;
  test: ComponentState;
  deploy: ComponentState;
}

interface GameStats {
  score: number;
  deployments: number;
  sabotages: number;
  timeSpent: number;
  failedDeployments: number;
  streak: number;
}

function App() {
  const [gameStats, setGameStats] = useState<GameStats>({
    score: 0,
    deployments: 0,
    sabotages: 0,
    timeSpent: 0,
    failedDeployments: 0,
    streak: 0
  });
  
  const [componentStates, setComponentStates] = useState<ComponentStates>({
    build: { placed: false },
    test: { placed: false },
    deploy: { placed: false }
  });
  
  const [logs, setLogs] = useState<string[]>(['🎮 Deploy the Cat loaded! Drag components to start.']);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [catAnimation, setCatAnimation] = useState<'idle' | 'moving' | 'prowling'>('idle');
  const [gameStartTime] = useState(Date.now());
  const [forceUpdate, setForceUpdate] = useState(0);
  const [catAggression, setCatAggression] = useState(1);
  
  // New state for warning system and emergency fix
  const [shakingComponents, setShakingComponents] = useState<Set<ComponentType>>(new Set());
  const [pendingAttacks, setPendingAttacks] = useState<Set<ComponentType>>(new Set());
  const [isDeploymentInProgress, setIsDeploymentInProgress] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [socketEvents, setSocketEvents] = useState<string[]>([]);
  const [nextAttackTime, setNextAttackTime] = useState<number>(0);
  const [timeUntilAttack, setTimeUntilAttack] = useState<number>(0);
  const [sabotageTimeoutId, setSabotageTimeoutId] = useState<number | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const addDebugLog = useCallback((event: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = data ? `${event}: ${JSON.stringify(data)}` : event;
    setSocketEvents(prev => [...prev, `[${timestamp}] ${logMessage}`]);
    if (debugMode) {
      console.log(`[DEBUG ${timestamp}] ${logMessage}`);
    }
  }, [debugMode]);

  // Warning system - components shake before being knocked off
  const startComponentWarning = useCallback((targetComponent: ComponentType) => {
    setShakingComponents(prev => new Set(prev).add(targetComponent));
    setPendingAttacks(prev => new Set(prev).add(targetComponent));
    addLog(`⚠️ ${targetComponent.toUpperCase()} component is unstable! Cat is approaching!`);
    
    // Give player 5 seconds to react
    setTimeout(() => {
      setPendingAttacks(prev => {
        if (prev.has(targetComponent)) {
          // Attack wasn't cancelled, proceed with knocking off component
          setComponentStates(prevStates => {
            if (prevStates[targetComponent].placed) {
              addLog(`🐱 Cat knocked off the ${targetComponent.toUpperCase()} component!`);
              return {
                ...prevStates,
                [targetComponent]: { placed: false }
              };
            }
            return prevStates;
          });
        }
        
        // Remove from pending attacks
        const newPending = new Set(prev);
        newPending.delete(targetComponent);
        return newPending;
      });
      
      // Remove from shaking regardless
      setShakingComponents(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetComponent);
        return newSet;
      });
    }, 5000);
  }, [addLog]);

  // Enhanced cat sabotage with warning system
  const performCatSabotage = useCallback((placedComponents: ComponentType[]) => {
    setCatAnimation('moving');
    
    // Determine number of components to sabotage based on aggression
    let componentsToSabotage = 1;
    const aggressionRoll = Math.random();
    
    // Reduced multi-attack chances to make game more fair
    if (catAggression >= 3 && aggressionRoll < 0.2 && placedComponents.length >= 2) {
      componentsToSabotage = 2;
      addLog(`🐱 Cat is feeling extra mischievous - targeting multiple components!`);
    } else if (catAggression >= 5 && aggressionRoll < 0.1 && placedComponents.length >= 3) {
      componentsToSabotage = 3;
      addLog(`🐱 CAT RAMPAGE! All components are in danger!`);
    } else {
      const target = placedComponents[Math.floor(Math.random() * placedComponents.length)];
      addLog(`🐱 Cat is moving to sabotage the ${target.toUpperCase()} component!`);
    }
    
    // Randomly select components to sabotage
    const shuffledComponents = [...placedComponents].sort(() => Math.random() - 0.5);
    const targetsToSabotage = shuffledComponents.slice(0, Math.min(componentsToSabotage, placedComponents.length));
    
    // Start warning phase instead of immediate sabotage
    targetsToSabotage.forEach((target, index) => {
      setTimeout(() => {
        startComponentWarning(target);
      }, index * 1500);
    });
    
    setGameStats(prev => {
      const newStats = {
        ...prev,
        sabotages: prev.sabotages + targetsToSabotage.length
      };
      setForceUpdate(f => f + 1);
      return newStats;
    });
    
    setTimeout(() => setCatAnimation('idle'), 6000);
  }, [addLog, catAggression, startComponentWarning]);

  // Game timer with cat aggression scaling
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      
      // Increase cat aggression every 60 seconds
      const newAggression = Math.min(Math.floor(elapsed / 60) + 1, 5);
      if (newAggression !== catAggression) {
        setCatAggression(newAggression);
        addLog(`🐱 Cat is getting more aggressive! (Level ${newAggression})`);
      }
      
      setGameStats(prev => ({
        ...prev,
        timeSpent: elapsed
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStartTime, catAggression, addLog]);

  // Countdown display for next attack
  useEffect(() => {
    const interval = setInterval(() => {
      if (nextAttackTime > 0) {
        const remaining = Math.max(0, Math.ceil((nextAttackTime - Date.now()) / 1000));
        setTimeUntilAttack(remaining);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [nextAttackTime]);

  // Trigger to restart cat timer when needed
  useEffect(() => {
    const placedCount = Object.values(componentStates).filter(state => state.placed).length;
    
    if (placedCount > 0 && !isDeploymentInProgress && !sabotageTimeoutId) {
      // We have components but no timer running - start one
      const scheduleFirstAttack = () => {
        const baseTime = 30000; // 30 seconds base
        const aggressionReduction = (catAggression - 1) * 4000;
        const randomVariation = Math.random() * 10000;
        const nextInterval = Math.max(15000, baseTime - aggressionReduction + randomVariation);
        
        const attackTime = Date.now() + nextInterval;
        setNextAttackTime(attackTime);
        addLog(`🐱 Cat will attack in ${Math.round(nextInterval/1000)} seconds...`);
        
        const timeoutId = window.setTimeout(() => {
          const currentPlacedComponents = Object.entries(componentStates)
            .filter(([_, state]) => state.placed)
            .map(([type, _]) => type as ComponentType);
          
          if (currentPlacedComponents.length > 0 && !isDeploymentInProgress) {
            performCatSabotage(currentPlacedComponents);
          }
        }, nextInterval);
        
        setSabotageTimeoutId(timeoutId);
      };
      
      scheduleFirstAttack();
    }
  }, [componentStates, isDeploymentInProgress, sabotageTimeoutId, catAggression, addLog, performCatSabotage]);

  // Socket connection with debug support
  useEffect(() => {
    addDebugLog('Attempting socket connection to http://localhost:5000');
    
    const socketConnection = io('http://localhost:5000');
    setSocket(socketConnection);

    socketConnection.on('connect', () => {
      setIsConnected(true);
      addLog('🟢 Connected to server');
      addDebugLog('Socket connected', { id: socketConnection.id });
    });

    socketConnection.on('disconnect', () => {
      setIsConnected(false);
      addLog('🔴 Disconnected from server');
      addDebugLog('Socket disconnected');
    });

    // Add ping/pong for testing
    socketConnection.on('pong', (data) => {
      addDebugLog('Received pong from server', data);
      addLog('🏓 Server responded to ping!');
    });

    socketConnection.on('deploymentLog', (data: any) => {
      addLog(`${data.message}`);
      addDebugLog('Received deploymentLog', data);
    });

    socketConnection.on('deploymentComplete', (data: any) => {
      addDebugLog('Received deploymentComplete', data);
      setIsDeploymentInProgress(false);
      
      if (data.success) {
        setGameStats(prev => {
          const streakBonus = prev.streak >= 3 ? 50 : 0;
          const totalPoints = 100 + streakBonus;
          const newStats = {
            ...prev,
            score: prev.score + totalPoints,
            deployments: prev.deployments + 1,
            streak: prev.streak + 1
          };
          setForceUpdate(f => f + 1);
          return newStats;
        });
        
        addLog(`🎉 Deployment successful! +${100 + (gameStats.streak >= 3 ? 50 : 0)} points`);
        
        // Reset components after success
        setTimeout(() => {
          resetComponents();
          addLog('🔄 Pipeline reset for next deployment!');
        }, 2000);
      } else {
        setGameStats(prev => {
          const newStats = {
            ...prev,
            failedDeployments: prev.failedDeployments + 1,
            score: Math.max(0, prev.score - 25),
            streak: 0
          };
          setForceUpdate(f => f + 1);
          return newStats;
        });
        addLog('💥 Deployment failed! -25 points. Streak broken!');
        
        // Reset components after failure
        setTimeout(() => {
          resetComponents();
          addLog('🔄 Pipeline reset - try again!');
        }, 2000);
      }
    });

    return () => {
      socketConnection.disconnect();
    };
  }, [addLog, addDebugLog]);

  // More controlled cat AI - prevent multiple overlapping timers
  useEffect(() => {
    // Clear any existing timeout
    if (sabotageTimeoutId) {
      clearTimeout(sabotageTimeoutId);
    }

    const getIntervalTime = () => {
      const baseTime = 30000; // 30 seconds base
      const aggressionReduction = (catAggression - 1) * 4000; // 4 seconds faster per level
      const randomVariation = Math.random() * 10000; // 0-10 seconds random
      return Math.max(15000, baseTime - aggressionReduction + randomVariation); // Minimum 15 seconds
    };
    
    const scheduleNextSabotage = () => {
      const placedCount = Object.values(componentStates).filter(state => state.placed).length;
      
      if (placedCount === 0 || isDeploymentInProgress) {
        // Don't schedule if no components or deploying, try again in 5 seconds
        const timeoutId = window.setTimeout(scheduleNextSabotage, 5000);
        setSabotageTimeoutId(timeoutId);
        return;
      }

      const nextInterval = getIntervalTime();
      const attackTime = Date.now() + nextInterval;
      setNextAttackTime(attackTime);
      
      // Log when next attack will happen
      addLog(`🐱 Cat will attack in ${Math.round(nextInterval/1000)} seconds...`);
      
      const timeoutId = window.setTimeout(() => {
        const currentPlacedComponents = Object.entries(componentStates)
          .filter(([_, state]) => state.placed)
          .map(([type, _]) => type as ComponentType);
        
        if (currentPlacedComponents.length > 0 && !isDeploymentInProgress) {
          performCatSabotage(currentPlacedComponents);
        }
        
        // Schedule next attack
        scheduleNextSabotage();
      }, nextInterval);
      
      setSabotageTimeoutId(timeoutId);
    };
    
    // Only start scheduling if we have placed components and aren't deploying
    const placedCount = Object.values(componentStates).filter(state => state.placed).length;
    if (placedCount > 0 && !isDeploymentInProgress) {
      scheduleNextSabotage();
    }

    return () => {
      if (sabotageTimeoutId) {
        clearTimeout(sabotageTimeoutId);
      }
    };
  }, [catAggression, isDeploymentInProgress, componentStates, addLog, performCatSabotage]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const componentType = e.currentTarget.dataset.type as ComponentType;
    e.dataTransfer.setData('text/plain', componentType);
    addLog(`📦 Picked up ${componentType.toUpperCase()} component`);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData('text/plain') as ComponentType;
    const dropZoneType = e.currentTarget.dataset.type as ComponentType;

    if (componentType === dropZoneType) {
      setComponentStates(prev => {
        const newStates = {
          ...prev,
          [componentType]: { placed: true }
        };
        
        // Check if this is the first component placed
        const wasEmpty = Object.values(prev).every(state => !state.placed);
        const placedCount = Object.values(newStates).filter(state => state.placed).length;
        
        if (wasEmpty && placedCount === 1) {
          // First component placed - start the cat timer
          addLog('🐱 Cat has noticed your pipeline... timer started!');
        }
        
        return newStates;
      });
      
      // Stop shaking if component was being warned
      setShakingComponents(prev => {
        const newSet = new Set(prev);
        newSet.delete(componentType);
        return newSet;
      });
      
      addLog(`✅ ${componentType.toUpperCase()} component placed correctly!`);
    } else {
      addLog(`❌ ${componentType.toUpperCase()} must go in the ${componentType.toUpperCase()} slot!`);
    }
  };

  const startDeployment = () => {
    const allPlaced = Object.values(componentStates).every(state => state.placed);
    
    if (!allPlaced) {
      addLog('❌ All components must be placed before deployment!');
      return;
    }

    if (isDeploymentInProgress) {
      addLog('❌ Deployment already in progress!');
      return;
    }

    setIsDeploymentInProgress(true);

    // Calculate deployment failure chance based on various factors
    const baseFailureChance = 0.15; // 15% base failure rate
    const aggressionPenalty = (catAggression - 1) * 0.05; // +5% per aggression level
    const failureStreakPenalty = gameStats.failedDeployments * 0.02; // +2% per recent failure
    const successStreakBonus = gameStats.deployments * 0.01; // -1% per success (experience)
    const shakingPenalty = shakingComponents.size * 0.1; // +10% per shaking component
    
    const totalFailureChance = Math.max(0.05, Math.min(0.4, 
      baseFailureChance + aggressionPenalty + failureStreakPenalty + shakingPenalty - successStreakBonus
    ));
    
    const willFail = Math.random() < totalFailureChance;
    
    addLog(`🚀 Starting deployment... (${Math.round(totalFailureChance * 100)}% failure risk)`);
    addDebugLog('Starting deployment', { willFail, totalFailureChance });
    
    socket?.emit('deploymentStart', { 
      timestamp: new Date().toISOString(),
      forceFailure: willFail,
      failureChance: totalFailureChance
    });
  };

  const resetComponents = () => {
    setComponentStates({
      build: { placed: false },
      test: { placed: false },
      deploy: { placed: false }
    });
    setShakingComponents(new Set());
    setPendingAttacks(new Set());
    setSabotageTimeoutId(null); // Clear the timeout ID when resetting
    addLog('🔄 Components reset');
  };

  // Emergency fix button - costs points but saves shaking components
  const emergencyFix = () => {
    if (shakingComponents.size === 0) {
      addLog('❌ No components need emergency fixing!');
      return;
    }
    
    const cost = shakingComponents.size * 25;
    if (gameStats.score < cost) {
      addLog(`❌ Need ${cost} points for emergency fix! (Current: ${gameStats.score})`);
      return;
    }
    
    // Log which attacks we're cancelling for debugging
    const attacksBeingCancelled = Array.from(pendingAttacks);
    addDebugLog('Cancelling pending attacks', attacksBeingCancelled);
    
    // Cancel all pending attacks
    setPendingAttacks(new Set());
    
    setGameStats(prev => ({
      ...prev,
      score: prev.score - cost
    }));
    
    setShakingComponents(new Set());
    addLog(`🔧 Emergency fix applied! -${cost} points. Cancelled ${attacksBeingCancelled.length} pending attacks!`);
    setForceUpdate(f => f + 1);
  };

  const allComponentsPlaced = Object.values(componentStates).every(state => state.placed);

  return (
    <div className="app">
      <header className="header">
        <h1>🐱 Deploy the Cat</h1>
        <p>Drag CI/CD components into place before the mischievous cat sabotages your pipeline!</p>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Online' : '🔴 Offline'}
        </div>
        <div className="game-info">
          <span className="cat-aggression">
            Cat Level: {'🔥'.repeat(catAggression)}
          </span>
          <span className="streak">
            Streak: {gameStats.streak} 🔥
          </span>
          <span className="countdown">
            Next Attack: {timeUntilAttack > 0 ? `${timeUntilAttack}s` : 'Soon!'}
          </span>
        </div>
      </header>

      <div className="game-container">
        <div className="game-area">
          <div className="pipeline-area">
            <h2>CI/CD Pipeline</h2>
            
            <div className="drop-zones">
              {(['build', 'test', 'deploy'] as ComponentType[]).map((type, index) => (
                <div
                  key={type}
                  data-type={type}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`drop-zone ${componentStates[type].placed ? 'filled' : ''} ${shakingComponents.has(type) ? 'shaking' : ''}`}
                >
                  <div className="drop-zone-label">
                    {index + 1}. {type.toUpperCase()}
                  </div>
                  {componentStates[type].placed && (
                    <div className="check-mark">
                      {shakingComponents.has(type) ? '⚠️' : '✅'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className={`cat ${catAnimation} aggression-${catAggression}`} title={`Mischievous Cat (Level ${catAggression})`}>
              🐱
            </div>
            
            <div className="components-section">
              <h3>Drag Components from Here:</h3>
              <div className="components-container">
                {(['build', 'test', 'deploy'] as ComponentType[]).map((type) => {
                  if (componentStates[type].placed) return null;
                  
                  return (
                    <div
                      key={type}
                      data-type={type}
                      draggable
                      onDragStart={handleDragStart}
                      className={`component component-${type}`}
                    >
                      {type.toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="stats-panel" key={forceUpdate}>
            <h3>Game Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value stat-score">{gameStats.score}</div>
                <div className="stat-label">Score</div>
              </div>
              <div className="stat-item">
                <div className="stat-value stat-deployments">{gameStats.deployments}</div>
                <div className="stat-label">Successful</div>
              </div>
              <div className="stat-item">
                <div className="stat-value stat-failures">{gameStats.failedDeployments}</div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value stat-sabotages">{gameStats.sabotages}</div>
                <div className="stat-label">Sabotages</div>
              </div>
            </div>
            <div className="stat-time">
              Time: {Math.floor(gameStats.timeSpent / 60)}m {gameStats.timeSpent % 60}s
            </div>
          </div>

          <div className="controls">
            <button
              onClick={startDeployment}
              disabled={!allComponentsPlaced || isDeploymentInProgress}
              className={`btn ${allComponentsPlaced && !isDeploymentInProgress ? 'btn-success' : 'btn-disabled'}`}
            >
              {isDeploymentInProgress ? 'Deploying...' : `Deploy! (Risk: ${Math.round((0.15 + (catAggression - 1) * 0.05) * 100)}%)`}
            </button>
            <button onClick={resetComponents} className="btn btn-primary">
              Reset
            </button>
            {shakingComponents.size > 0 && (
              <button onClick={emergencyFix} className="btn btn-warning">
                🔧 Emergency Fix ({shakingComponents.size * 25} pts)
              </button>
            )}
            {/* Debug controls - hidden by default for clean portfolio demo */}
            {process.env.NODE_ENV === 'development' && (
              <>
                <button 
                  onClick={() => setDebugMode(!debugMode)} 
                  className={`btn ${debugMode ? 'btn-warning' : 'btn-secondary'}`}
                >
                  {debugMode ? '🐛 Debug ON' : '🔧 Debug OFF'}
                </button>
                {debugMode && (
                  <button 
                    onClick={() => {
                      addDebugLog('Testing socket connection...');
                      if (socket) {
                        socket.emit('ping', { message: 'test ping', timestamp: Date.now() });
                        addDebugLog('Sent ping to server');
                      } else {
                        addDebugLog('No socket available for ping test');
                      }
                    }}
                    className="btn btn-info"
                  >
                    🏓 Test Socket
                  </button>
                )}
              </>
            )}
          </div>

          {/* Debug panel - only show in development */}
          {debugMode && process.env.NODE_ENV === 'development' && (
            <div className="debug-panel">
              <h3>🐛 Debug Information</h3>
              <div className="debug-info">
                <div className="debug-section">
                  <h4>Connection Status</h4>
                  <p>Socket Connected: {isConnected ? '✅' : '❌'}</p>
                  <p>Socket Object: {socket ? '✅' : '❌'}</p>
                  <p>Deployment In Progress: {isDeploymentInProgress ? '✅' : '❌'}</p>
                </div>
                
                <div className="debug-section">
                  <h4>Component States</h4>
                  <pre>{JSON.stringify(componentStates, null, 2)}</pre>
                  <h4>Shaking Components</h4>
                  <pre>{JSON.stringify(Array.from(shakingComponents), null, 2)}</pre>
                  <h4>Pending Attacks</h4>
                  <pre>{JSON.stringify(Array.from(pendingAttacks), null, 2)}</pre>
                </div>
                
                <div className="debug-section">
                  <h4>Game Stats</h4>
                  <pre>{JSON.stringify(gameStats, null, 2)}</pre>
                </div>
                
                <div className="debug-section">
                  <h4>Socket Events (Last 10)</h4>
                  <div className="socket-events">
                    {socketEvents.slice(-10).map((event, index) => (
                      <div key={index} className="socket-event">{event}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="logs-panel">
          <div className="logs-header">
            <h3>🚀 Deployment Logs</h3>
          </div>
          <div className="logs-content">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;