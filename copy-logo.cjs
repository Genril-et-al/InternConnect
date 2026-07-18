const fs = require('fs');
const sourceFile = 'C:\\Users\\Faith\\.gemini\\antigravity\\brain\\231b6103-5dd1-415f-a12c-934ffae5643a\\media__1784354728970.png';
const destFile = 'D:\\dev\\internconnect\\public\\logo.png';
try {
    fs.copyFileSync(sourceFile, destFile);
    console.log('Copy complete!');
} catch (e) {
    console.error(e);
}
