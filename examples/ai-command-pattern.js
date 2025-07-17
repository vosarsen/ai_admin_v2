/**
 * AI Command Pattern Example
 * 
 * This pattern shows how AI Admin v2 uses embedded commands in responses
 * to trigger specific actions in the system.
 */

// Example 1: Command Extraction
const extractCommands = (aiResponse) => {
  const commands = [];
  
  // Pattern for finding commands in square brackets
  const commandRegex = /\[([A-Z_]+)(?::([^\]]+))?\]/g;
  let match;
  
  while ((match = commandRegex.exec(aiResponse)) !== null) {
    commands.push({
      command: match[1],
      params: match[2] ? match[2].split(',').map(p => p.trim()) : []
    });
  }
  
  return commands;
};

// Example 2: Command Execution
const executeCommand = async (command, context) => {
  switch (command.command) {
    case 'SEARCH_SLOTS':
      const [serviceIds, staffId, date] = command.params;
      return await searchAvailableSlots(context.companyId, {
        service_ids: serviceIds,
        staff_id: staffId || 0,
        date: date || new Date().toISOString().split('T')[0]
      });
      
    case 'CREATE_BOOKING':
      const [service, staff, datetime] = command.params;
      return await createBooking(context.companyId, {
        services: [service],
        staff_id: staff,
        datetime: datetime,
        client: context.client
      });
      
    case 'SHOW_PRICES':
      return formatServicePrices(context.services);
      
    default:
      logger.warn(`Unknown command: ${command.command}`);
      return null;
  }
};

// Example 3: AI Response with Commands
const aiResponseExample = `
Конечно! Я помогу вам записаться на стрижку. 

[SEARCH_SLOTS:15031280,0,2024-07-20]

Вот доступные времена на 20 июля:
- 10:00 - мастер Сергей
- 11:30 - мастер Богдан  
- 14:00 - мастер Рауф

Какое время вам подходит?
`;

// Example 4: Full Processing Flow
const processAIResponse = async (aiResponse, context) => {
  // Extract all commands
  const commands = extractCommands(aiResponse);
  
  // Execute commands in sequence
  const results = [];
  for (const command of commands) {
    const result = await executeCommand(command, context);
    results.push({ command: command.command, result });
  }
  
  // Clean response from command markers
  let cleanResponse = aiResponse.replace(/\[[A-Z_]+(?::[^\]]+)?\]/g, '');
  
  // Insert command results into response
  // This is where you'd replace placeholders with actual data
  
  return {
    response: cleanResponse.trim(),
    executedCommands: results
  };
};

// Example 5: Command Definitions
const AVAILABLE_COMMANDS = {
  SEARCH_SLOTS: {
    description: 'Search for available time slots',
    params: ['service_ids', 'staff_id', 'date'],
    example: '[SEARCH_SLOTS:15031280,0,2024-07-20]'
  },
  CREATE_BOOKING: {
    description: 'Create a new booking',
    params: ['service_id', 'staff_id', 'datetime'],
    example: '[CREATE_BOOKING:15031280,2895125,2024-07-20T10:00:00]'
  },
  SHOW_PRICES: {
    description: 'Display service prices',
    params: [],
    example: '[SHOW_PRICES]'
  },
  SHOW_PORTFOLIO: {
    description: 'Show portfolio images',
    params: ['category'],
    example: '[SHOW_PORTFOLIO:haircuts]'
  },
  CHECK_BOOKING: {
    description: 'Check existing booking status',
    params: ['booking_id'],
    example: '[CHECK_BOOKING:12345]'
  }
};

module.exports = {
  extractCommands,
  executeCommand,
  processAIResponse,
  AVAILABLE_COMMANDS
};