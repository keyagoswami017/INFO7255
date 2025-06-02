const redis = require('redis');
const redisClient = redis.createClient();

redisClient.on('error', (err) => console.error('Redis Client Error', err));
//
redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('ready', () => console.log('Redis ready'));
redisClient.on('reconnecting', () => console.log('Redis reconnecting'));
redisClient.on('end', () => console.log('Redis connection ended'));

module.exports = { redisClient };