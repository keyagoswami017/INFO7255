const express = require('express');
const dotenv = require('dotenv');
const { redisClient } = require('./api/services/redisClient'); // Import Redis client
const jsonRoutes = require('./api/routes/jsonRoutes');

dotenv.config(); // Load environment variables from .env file

const app = express(); // Create an Express application
app.use(express.json()); // To parse JSON
app.use('/api/v1/plan',jsonRoutes); 


// Connect to Redis
redisClient.connect()
  .then(() => console.log('✅ Connected to Redis'))
  .catch((err) => {
    console.error('❌ Failed to connect to Redis:', err);
    process.exit(1); // Exit if Redis connection fails
  });

app.locals.redis = redisClient; // Make Redis client available in app locals

//const PORT =  3001;
const PORT = process.env.PORT || 3000; // Set the port from environment variable or default to 3000
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});






 
