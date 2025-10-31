// src/services/vector-memory/vector-memory-service.js
/**
 * Сервис векторной памяти для семантического поиска
 * Использует OpenAI embeddings и PostgreSQL pgvector
 */

const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require('openai');
const logger = require('../../utils/logger').child({ module: 'vector-memory' });

class VectorMemoryService {
  constructor() {
    // Supabase для векторного хранилища
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // OpenAI для создания embeddings
    this.openai = new OpenAIApi(new Configuration({
      apiKey: process.env.OPENAI_API_KEY
    }));
    
    this.embeddingModel = 'text-embedding-ada-002';
    this.vectorDimension = 1536; // Размерность для ada-002
  }

  /**
   * Создать векторное представление текста
   */
  async createEmbedding(text) {
    try {
      const response = await this.openai.createEmbedding({
        model: this.embeddingModel,
        input: text
      });
      
      return response.data.data[0].embedding;
    } catch (error) {
      logger.error('Error creating embedding:', error);
      throw error;
    }
  }

  /**
   * Сохранить сообщение в векторную память
   */
  async saveMessage(phone, companyId, message, metadata = {}) {
    try {
      // Создаем embedding для сообщения
      const embedding = await this.createEmbedding(message.content);
      
      // Сохраняем в векторную таблицу
      const { data, error } = await this.supabase
        .from('vector_memories')
        .insert({
          phone,
          company_id: companyId,
          content: message.content,
          role: message.role,
          embedding: embedding,
          metadata: {
            ...metadata,
            timestamp: message.timestamp || new Date().toISOString(),
            messageType: this.detectMessageType(message.content)
          }
        });
      
      if (error) throw error;
      
      logger.info('Message saved to vector memory');
      return data;
    } catch (error) {
      logger.error('Error saving to vector memory:', error);
      throw error;
    }
  }

  /**
   * Семантический поиск по истории
   */
  async semanticSearch(phone, companyId, query, limit = 5) {
    try {
      // Создаем embedding для запроса
      const queryEmbedding = await this.createEmbedding(query);
      
      // Поиск похожих векторов через SQL функцию
      const { data, error } = await this.supabase
        .rpc('search_memories', {
          query_embedding: queryEmbedding,
          match_phone: phone,
          match_company: companyId,
          match_count: limit
        });
      
      if (error) throw error;
      
      return data.map(item => ({
        content: item.content,
        similarity: item.similarity,
        metadata: item.metadata,
        timestamp: item.created_at
      }));
    } catch (error) {
      logger.error('Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Анализ паттернов клиента
   */
  async analyzeClientPatterns(phone, companyId) {
    try {
      // Получаем все векторы клиента
      const { data: memories } = await this.supabase
        .from('vector_memories')
        .select('content, embedding, metadata')
        .eq('phone', phone)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!memories || memories.length === 0) {
        return null;
      }
      
      // Кластеризация тем (упрощенная версия)
      const topics = await this.clusterTopics(memories);
      
      // Определение стиля общения
      const communicationStyle = this.analyzeCommunicationStyle(memories);
      
      // Частые запросы
      const frequentRequests = await this.findFrequentPatterns(memories);
      
      return {
        topics,
        communicationStyle,
        frequentRequests,
        totalInteractions: memories.length,
        firstInteraction: memories[memories.length - 1].metadata?.timestamp,
        lastInteraction: memories[0].metadata?.timestamp
      };
    } catch (error) {
      logger.error('Error analyzing patterns:', error);
      return null;
    }
  }

  /**
   * Найти релевантный контекст для текущего сообщения
   */
  async findRelevantContext(phone, companyId, currentMessage, limit = 3) {
    try {
      // Ищем семантически похожие прошлые диалоги
      const similar = await this.semanticSearch(
        phone,
        companyId,
        currentMessage,
        limit
      );
      
      // Фильтруем по релевантности (similarity > 0.7)
      const relevant = similar.filter(item => item.similarity > 0.7);
      
      if (relevant.length === 0) {
        return null;
      }
      
      // Формируем контекст для AI
      return {
        hasRelevantHistory: true,
        relatedConversations: relevant,
        summary: await this.summarizeContext(relevant),
        suggestedResponse: await this.suggestResponse(relevant, currentMessage)
      };
    } catch (error) {
      logger.error('Error finding relevant context:', error);
      return null;
    }
  }

  /**
   * Определение типа сообщения
   */
  detectMessageType(content) {
    const lower = content.toLowerCase();
    
    if (lower.includes('записаться') || lower.includes('запись')) {
      return 'booking_request';
    }
    if (lower.includes('отменить') || lower.includes('перенести')) {
      return 'modification_request';
    }
    if (lower.includes('сколько стоит') || lower.includes('цена')) {
      return 'price_inquiry';
    }
    if (lower.includes('работаете') || lower.includes('график')) {
      return 'schedule_inquiry';
    }
    
    return 'general';
  }

  /**
   * Упрощенная кластеризация тем
   */
  async clusterTopics(memories) {
    const topics = {};
    
    for (const memory of memories) {
      const type = memory.metadata?.messageType || 'general';
      topics[type] = (topics[type] || 0) + 1;
    }
    
    return Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: Math.round((count / memories.length) * 100)
      }));
  }

  /**
   * Анализ стиля общения
   */
  analyzeCommunicationStyle(memories) {
    const messages = memories.map(m => m.content);
    
    // Средняя длина сообщений
    const avgLength = messages.reduce((sum, msg) => sum + msg.length, 0) / messages.length;
    
    // Формальность (наличие "пожалуйста", "спасибо", etc)
    const formalWords = ['пожалуйста', 'спасибо', 'добрый день', 'здравствуйте'];
    const formalCount = messages.filter(msg => 
      formalWords.some(word => msg.toLowerCase().includes(word))
    ).length;
    
    return {
      style: avgLength < 50 ? 'краткий' : 'подробный',
      formality: formalCount > messages.length * 0.3 ? 'формальный' : 'неформальный',
      avgMessageLength: Math.round(avgLength),
      preferredGreeting: this.detectPreferredGreeting(messages)
    };
  }

  /**
   * Определение предпочитаемого приветствия
   */
  detectPreferredGreeting(messages) {
    const greetings = {
      'привет': 0,
      'здравствуйте': 0,
      'добрый день': 0,
      'добрый вечер': 0,
      'hi': 0,
      'hello': 0
    };
    
    for (const msg of messages) {
      const lower = msg.toLowerCase();
      for (const greeting in greetings) {
        if (lower.includes(greeting)) {
          greetings[greeting]++;
        }
      }
    }
    
    const [preferred] = Object.entries(greetings)
      .sort(([,a], [,b]) => b - a);
    
    return preferred[1] > 0 ? preferred[0] : null;
  }

  /**
   * Поиск частых паттернов
   */
  async findFrequentPatterns(memories) {
    const patterns = {};
    
    // Анализируем метаданные
    for (const memory of memories) {
      const meta = memory.metadata || {};
      
      // Время записи
      if (meta.timestamp) {
        const hour = new Date(meta.timestamp).getHours();
        const period = hour < 12 ? 'утро' : hour < 17 ? 'день' : 'вечер';
        patterns[`preferred_time_${period}`] = (patterns[`preferred_time_${period}`] || 0) + 1;
      }
      
      // Тип запроса
      if (meta.messageType) {
        patterns[`request_${meta.messageType}`] = (patterns[`request_${meta.messageType}`] || 0) + 1;
      }
    }
    
    return patterns;
  }

  /**
   * Суммаризация контекста для AI
   */
  async summarizeContext(relevant) {
    if (!relevant || relevant.length === 0) return '';
    
    const summary = relevant.map((item, i) => 
      `${i + 1}. ${item.content} (похожесть: ${Math.round(item.similarity * 100)}%)`
    ).join('\n');
    
    return `Найдены похожие диалоги:\n${summary}`;
  }

  /**
   * Предложение ответа на основе истории
   */
  async suggestResponse(relevant, currentMessage) {
    // Здесь можно добавить логику генерации предложений
    // на основе успешных прошлых ответов
    return null;
  }

  /**
   * Создание таблицы в Supabase (выполнить один раз)
   */
  async createVectorTable() {
    const sql = `
      -- Включаем расширение pgvector
      CREATE EXTENSION IF NOT EXISTS vector;
      
      -- Создаем таблицу для векторной памяти
      CREATE TABLE IF NOT EXISTS vector_memories (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        company_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        role VARCHAR(20) NOT NULL,
        embedding vector(1536),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Индексы для поиска
        INDEX idx_phone_company (phone, company_id),
        INDEX idx_created_at (created_at DESC)
      );
      
      -- Создаем индекс для векторного поиска
      CREATE INDEX IF NOT EXISTS idx_embedding 
      ON vector_memories 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
      
      -- Функция для семантического поиска
      CREATE OR REPLACE FUNCTION search_memories(
        query_embedding vector(1536),
        match_phone VARCHAR,
        match_company INTEGER,
        match_count INTEGER DEFAULT 5
      )
      RETURNS TABLE(
        id INTEGER,
        content TEXT,
        role VARCHAR,
        metadata JSONB,
        similarity FLOAT,
        created_at TIMESTAMPTZ
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          vm.id,
          vm.content,
          vm.role,
          vm.metadata,
          1 - (vm.embedding <=> query_embedding) as similarity,
          vm.created_at
        FROM vector_memories vm
        WHERE vm.phone = match_phone 
          AND vm.company_id = match_company
        ORDER BY vm.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `;
    
    logger.info('Vector table SQL created. Execute in Supabase SQL editor.');
    return sql;
  }
}

module.exports = new VectorMemoryService();