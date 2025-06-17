// Debug script to understand the avatar not found issue

console.log('=== Avatar Debug Script ===\n');

// 1. Check what's in the trial.html file
console.log('1. Avatar ID used in trial.html:');
console.log('   Line 279: avatarName: "avatar_d77dc4afc71e4a5ebdcd1d3bab6ca71e"');

// 2. Check what's in index.html
console.log('\n2. Avatar ID used in index.html:');
console.log('   Line 262: avatarName: "default"');

// 3. Common avatar IDs from HeyGen
console.log('\n3. Common HeyGen avatar IDs:');
console.log('   - default');
console.log('   - avatar_default');
console.log('   - josh_lite3_20230714');
console.log('   - anna_public_3_20240108');

// 4. The error message
console.log('\n4. Error Analysis:');
console.log('   The "avatar not found" error typically means:');
console.log('   a) The avatar ID is incorrect');
console.log('   b) The trial token doesn\'t have access to that specific avatar');
console.log('   c) The avatar ID format is wrong');

// 5. Solution
console.log('\n5. Recommended Fix:');
console.log('   Change line 279 in trial.html from:');
console.log('     avatarName: "avatar_d77dc4afc71e4a5ebdcd1d3bab6ca71e"');
console.log('   To one of these:');
console.log('     avatarName: "josh_lite3_20230714"  // Most common trial avatar');
console.log('     avatarName: "anna_public_3_20240108"  // Alternative trial avatar');
console.log('     avatarName: undefined  // Let HeyGen choose default');

// 6. Check server issues
console.log('\n6. Server Issue:');
console.log('   The server error "Cannot destructure property \'token\' of \'req.body\' as it is undefined"');
console.log('   This happens because the express.json() middleware is after express-ws()');
console.log('   Fix: Move app.use(express.json()) before expressWs(app)');

console.log('\n=== End Debug ===');