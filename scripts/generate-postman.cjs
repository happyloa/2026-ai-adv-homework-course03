const fs = require('fs');
const path = require('path');
const converter = require('openapi-to-postmanv2');

const projectRoot = path.resolve(__dirname, '..');
const openapiPath = path.join(projectRoot, 'openapi.json');
const outputDirectory = path.join(projectRoot, 'postman');
const outputPath = path.join(outputDirectory, 'flower-shop.postman_collection.json');

function visitRequests(items, callback) {
  for (const item of items || []) {
    if (Array.isArray(item.item)) {
      visitRequests(item.item, callback);
    } else if (item.request) {
      callback(item);
    }
  }
}

function getRequestPath(request) {
  const rawUrl = typeof request.url === 'string' ? request.url : request.url?.raw;
  if (!rawUrl) {
    const pathParts = request.url?.path;
    return Array.isArray(pathParts) ? `/${pathParts.join('/')}` : '';
  }

  try {
    return new URL(rawUrl).pathname;
  } catch (_) {
    return rawUrl.replace(/^\{\{baseUrl\}\}/, '').split('?')[0];
  }
}

function useBaseUrlVariable(request) {
  const rawUrl = typeof request.url === 'string' ? request.url : request.url?.raw;
  let route;

  if (rawUrl) {
    route = rawUrl;
    try {
      const url = new URL(rawUrl);
      route = `${url.pathname}${url.search}`;
    } catch (_) {
      route = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    }
  } else {
    const pathParts = request.url?.path;
    if (!Array.isArray(pathParts)) return;
    route = `/${pathParts.join('/')}`;
  }

  const raw = `{{baseUrl}}${route.startsWith('/') ? route : `/${route}`}`;
  request.url = {
    raw,
    host: ['{{baseUrl}}'],
    path: route.replace(/^\//, '').split('?')[0].split('/').filter(Boolean)
  };
}

function addHeader(request, key, value) {
  request.header = request.header || [];
  if (!request.header.some(header => header.key.toLowerCase() === key.toLowerCase())) {
    request.header.push({ key, value, type: 'text' });
  }
}

function setNoAuth(request) {
  request.auth = { type: 'noauth' };
}

function saveTokenAfterLogin(item) {
  item.event = item.event || [];
  item.event.push({
    listen: 'test',
    script: {
      type: 'text/javascript',
      exec: [
        'const body = pm.response.json();',
        'if (body.data && body.data.token) {',
        "  pm.collectionVariables.set('token', body.data.token);",
        '}'
      ]
    }
  });
}

function configureCollection(collection) {
  collection.info.name = '花漾生活 API Collection';
  collection.variable = collection.variable || [];
  const variables = [
    ['baseUrl', 'http://localhost:3001'],
    ['token', ''],
    ['sessionId', '']
  ];

  for (const [key, value] of variables) {
    const existing = collection.variable.find(variable => variable.key === key);
    if (existing) {
      existing.value = value;
    } else {
      collection.variable.push({ key, value, type: 'string' });
    }
  }

  collection.auth = {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{token}}', type: 'string' }]
  };

  visitRequests(collection.item, item => {
    const requestPath = getRequestPath(item.request);
    useBaseUrlVariable(item.request);

    if (requestPath === '/api/auth/login') {
      setNoAuth(item.request);
      saveTokenAfterLogin(item);
    } else if (requestPath === '/api/auth/register') {
      setNoAuth(item.request);
    } else if (requestPath.startsWith('/api/cart')) {
      // Cart supports a guest session. Authentication-only APIs retain the
      // collection-level Bearer token configured above.
      setNoAuth(item.request);
      addHeader(item.request, 'X-Session-Id', '{{sessionId}}');
    } else if (item.request.auth?.type === 'bearer') {
      item.request.auth.bearer = [{ key: 'token', value: '{{token}}', type: 'string' }];
    }
  });
}

function normalizeGeneratedMetadata(value) {
  if (Array.isArray(value)) {
    value.forEach(normalizeGeneratedMetadata);
    return;
  }

  if (!value || typeof value !== 'object') return;

  // The converter assigns UUIDs and random example responses on every run.
  // Neither is needed by Postman to execute this collection, so remove them
  // to keep the committed artifact deterministic and reviewable.
  delete value.id;
  delete value._postman_id;
  if (Array.isArray(value.response)) value.response = [];
  Object.values(value).forEach(normalizeGeneratedMetadata);
}

function writeCollection(collection) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const serialized = `${JSON.stringify(collection, null, 2)}\n`;
  JSON.parse(serialized);
  fs.writeFileSync(outputPath, serialized, 'utf8');
  console.log(`已產生 Postman Collection：${path.relative(projectRoot, outputPath)}`);
}

function main() {
  if (!fs.existsSync(openapiPath)) {
    throw new Error('找不到 openapi.json，請先執行 npm run openapi');
  }

  const specification = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
  converter.convert({ type: 'json', data: specification }, {}, (error, result) => {
    try {
      if (error) throw error;
      if (!result?.result || !result.output?.[0]?.data) {
        throw new Error(result?.reason || 'OpenAPI 轉換 Postman Collection 失敗');
      }

      configureCollection(result.output[0].data);
      normalizeGeneratedMetadata(result.output[0].data);
      writeCollection(result.output[0].data);
    } catch (conversionError) {
      console.error(`產生 Postman Collection 失敗：${conversionError.message}`);
      process.exitCode = 1;
    }
  });
}

try {
  main();
} catch (error) {
  console.error(`產生 Postman Collection 失敗：${error.message}`);
  process.exitCode = 1;
}
