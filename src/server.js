const express = require('express');
const dotenv = require('dotenv');
const { redisClient } = require('./api/services/redisClient'); // Import Redis client
const jsonRoutes = require('./api/routes/jsonRoutes');
const { createIndexIfNotExists } = require('./api/services/elasticService');

dotenv.config(); // Load environment variables from .env file

const app = express(); // Create an Express application
app.use(express.json()); // To parse JSON
app.use('/api/v1/plan',jsonRoutes); 




// Connect to Redis
redisClient.connect()
  .then(async () => {
    console.log('✅ Connected to Redis');

    // Ensure Elasticsearch index exists
    try {
      await createIndexIfNotExists();
      console.log('✅ Elasticsearch index is ready');
    } catch (err) {
      console.error('❌ Failed to set up Elasticsearch index:', err);
      process.exit(1);
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to Redis:', err);
    process.exit(1);
  });

app.locals.redis = redisClient;