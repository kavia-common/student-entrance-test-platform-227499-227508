const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Student Entrance Test Platform API',
      version: '1.0.0',
      description:
        'Express backend for authentication, quiz management, question bank, attempt submission, and results. ' +
        'Persistence is currently in-memory and is designed to be replaced with the quiz_database container.',
    },
    tags: [
      { name: 'Health', description: 'Service health check' },
      { name: 'Auth', description: 'User authentication endpoints' },
      { name: 'Quizzes', description: 'Quiz management and attempt start' },
      { name: 'Questions', description: 'Question management and retrieval' },
      { name: 'Results', description: 'Attempt submission and results retrieval' },
    ],
  },
  apis: ['./src/routes/*.js'], // Scan all routes for JSDoc swagger blocks
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
