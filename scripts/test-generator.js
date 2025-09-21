const { execSync } = require('child_process');
const fs = require('fs').promises;

async function testGenerator() {
  console.log('🧪 Testing reto generator...');
  
  try {
    // Test date generation
    const testDate = '2025-12-31';
    console.log(`📅 Testing generation for ${testDate}`);
    
    // Generate test reto
    execSync(`node scripts/generate-daily-reto.js ${testDate} --force`, { stdio: 'inherit' });
    
    // Validate it was created correctly
    const reto = JSON.parse(await fs.readFile('reto.json', 'utf8'));
    
    if (reto.fecha !== testDate) {
      throw new Error('Generated reto has wrong date');
    }
    
    console.log('✅ Generator test passed');
    
    // Restore original reto.json if it existed
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      execSync(`node scripts/generate-daily-reto.js ${todayDate}`, { stdio: 'inherit' });
    } catch (e) {
      // Ignore restore errors
    }
    
  } catch (error) {
    console.error('❌ Generator test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testGenerator();
}