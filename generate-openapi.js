const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerOptions = require('./swagger-config');

const specification = swaggerJsdoc(swaggerOptions);
const outputPath = path.join(__dirname, 'openapi.json');

fs.writeFileSync(outputPath, `${JSON.stringify(specification, null, 2)}\n`, 'utf8');
console.log('已產生 openapi.json');
