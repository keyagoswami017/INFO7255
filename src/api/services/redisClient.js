const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();
const redisClient = redis.createClient({
    url: process.env.REDIS_URL 
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));


module.exports = { redisClient };