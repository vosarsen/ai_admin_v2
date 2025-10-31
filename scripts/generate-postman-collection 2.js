#!/usr/bin/env node

// scripts/generate-postman-collection.js
const fs = require('fs').promises;
const path = require('path');
const YAML = require('yamljs');

/**
 * Генерирует Postman коллекцию из OpenAPI спецификации
 */
async function generatePostmanCollection() {
  try {
    console.log('📄 Loading OpenAPI specification...');
    
    // Загружаем OpenAPI документ
    const openapiPath = path.join(__dirname, '../openapi.yaml');
    const openapi = YAML.load(openapiPath);
    
    // Создаем базовую структуру Postman коллекции
    const collection = {
      info: {
        name: openapi.info.title,
        description: openapi.info.description,
        version: openapi.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'apikey',
        apikey: [{
          key: 'key',
          value: 'X-API-Key',
          type: 'string'
        }, {
          key: 'value',
          value: '{{api_key}}',
          type: 'string'
        }]
      },
      variable: [
        {
          key: 'base_url',
          value: openapi.servers[0].url,
          type: 'string'
        },
        {
          key: 'api_key',
          value: 'your-api-key-here',
          type: 'string'
        },
        {
          key: 'hmac_signature',
          value: 'your-hmac-signature',
          type: 'string'
        }
      ],
      item: []
    };
    
    // Группируем endpoints по тегам
    const folders = {};
    
    // Обрабатываем каждый path
    for (const [path, pathItem] of Object.entries(openapi.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const tag = operation.tags?.[0] || 'Other';
          
          if (!folders[tag]) {
            folders[tag] = {
              name: tag,
              item: []
            };
          }
          
          // Создаем Postman request
          const request = createPostmanRequest(path, method, operation, openapi);
          folders[tag].item.push(request);
        }
      }
    }
    
    // Добавляем папки в коллекцию
    collection.item = Object.values(folders);
    
    // Сохраняем коллекцию
    const outputPath = path.join(__dirname, '../postman-collection.json');
    await fs.writeFile(outputPath, JSON.stringify(collection, null, 2));
    
    console.log('✅ Postman collection generated successfully!');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log('\n📌 Import this file in Postman to start testing the API');
    
  } catch (error) {
    console.error('❌ Error generating Postman collection:', error);
    process.exit(1);
  }
}

/**
 * Создает Postman request из OpenAPI operation
 */
function createPostmanRequest(path, method, operation, openapi) {
  const request = {
    name: operation.summary || `${method.toUpperCase()} ${path}`,
    request: {
      method: method.toUpperCase(),
      header: [],
      url: {
        raw: `{{base_url}}${path}`,
        host: ['{{base_url}}'],
        path: path.split('/').filter(p => p).map(segment => {
          // Преобразуем параметры пути в Postman формат
          if (segment.startsWith('{') && segment.endsWith('}')) {
            return `:${segment.slice(1, -1)}`;
          }
          return segment;
        })
      }
    }
  };
  
  // Добавляем описание
  if (operation.description) {
    request.request.description = operation.description;
  }
  
  // Добавляем параметры
  if (operation.parameters) {
    const queryParams = [];
    const variables = [];
    
    for (const param of operation.parameters) {
      if (param.in === 'query') {
        queryParams.push({
          key: param.name,
          value: param.example || '',
          description: param.description,
          disabled: !param.required
        });
      } else if (param.in === 'path') {
        variables.push({
          key: param.name,
          value: param.example || ''
        });
      } else if (param.in === 'header') {
        request.request.header.push({
          key: param.name,
          value: param.example || '',
          description: param.description
        });
      }
    }
    
    if (queryParams.length > 0) {
      request.request.url.query = queryParams;
    }
    
    if (variables.length > 0) {
      request.request.url.variable = variables;
    }
  }
  
  // Добавляем тело запроса
  if (operation.requestBody) {
    const content = operation.requestBody.content;
    if (content && content['application/json']) {
      request.request.header.push({
        key: 'Content-Type',
        value: 'application/json'
      });
      
      // Используем примеры если есть
      let body = {};
      const schema = content['application/json'];
      
      if (schema.examples) {
        const firstExample = Object.values(schema.examples)[0];
        body = firstExample.value;
      } else if (schema.example) {
        body = schema.example;
      } else if (schema.schema) {
        body = generateExampleFromSchema(schema.schema, openapi);
      }
      
      request.request.body = {
        mode: 'raw',
        raw: JSON.stringify(body, null, 2),
        options: {
          raw: {
            language: 'json'
          }
        }
      };
    }
  }
  
  // Добавляем аутентификацию
  if (operation.security) {
    const securityReq = operation.security[0];
    const securityType = Object.keys(securityReq)[0];
    
    if (securityType === 'hmacSignature') {
      request.request.header.push({
        key: 'X-Hub-Signature',
        value: '{{hmac_signature}}',
        description: 'HMAC-SHA256 signature'
      });
      request.request.auth = { type: 'noauth' };
    } else if (securityType === 'bearerAuth') {
      request.request.auth = {
        type: 'bearer',
        bearer: [{
          key: 'token',
          value: '{{bearer_token}}',
          type: 'string'
        }]
      };
    }
    // apiKey наследуется от коллекции
  } else {
    // Если нет security, отключаем auth
    request.request.auth = { type: 'noauth' };
  }
  
  // Добавляем примеры ответов
  if (operation.responses) {
    request.response = [];
    
    for (const [status, response] of Object.entries(operation.responses)) {
      if (response.content?.['application/json']?.example) {
        request.response.push({
          name: response.description || `${status} Response`,
          originalRequest: request.request,
          status: response.description,
          code: parseInt(status),
          header: [
            { key: 'Content-Type', value: 'application/json' }
          ],
          body: JSON.stringify(response.content['application/json'].example, null, 2)
        });
      }
    }
  }
  
  return request;
}

/**
 * Генерирует пример из JSON Schema
 */
function generateExampleFromSchema(schema, openapi) {
  if (schema.$ref) {
    const refPath = schema.$ref.split('/').slice(1);
    let refSchema = openapi;
    for (const part of refPath) {
      refSchema = refSchema[part];
    }
    return generateExampleFromSchema(refSchema, openapi);
  }
  
  if (schema.example !== undefined) {
    return schema.example;
  }
  
  switch (schema.type) {
    case 'object':
      const obj = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(prop, openapi);
        }
      }
      return obj;
      
    case 'array':
      return [generateExampleFromSchema(schema.items, openapi)];
      
    case 'string':
      if (schema.enum) {
        return schema.enum[0];
      }
      if (schema.format === 'date-time') {
        return new Date().toISOString();
      }
      if (schema.pattern) {
        return 'string matching pattern';
      }
      return schema.example || 'string';
      
    case 'integer':
    case 'number':
      return schema.example || (schema.minimum || 0);
      
    case 'boolean':
      return schema.example || true;
      
    default:
      return null;
  }
}

// Запуск генератора
if (require.main === module) {
  generatePostmanCollection();
}

module.exports = { generatePostmanCollection };